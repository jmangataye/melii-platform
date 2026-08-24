import Anthropic from "@anthropic-ai/sdk";
import type { Creator } from "@melii/db";
import {
  appendMessage,
  getRecentMessages,
  listTiers,
  getFanProfile,
  getMessageCountForChat,
  upsertFanNotes,
} from "@melii/db";
import { buildSystemPrompt, containsSafetyKeyword, getSafeFallbackReply } from "@melii/db/persona";

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

// Modèle dédié au résumé fan — un appel court, peu fréquent (voir
// FAN_SUMMARY_INTERVAL_MESSAGES ci-dessous), pas besoin du modèle principal :
// un modèle plus petit/rapide suffit largement et garde le coût marginal.
const ANTHROPIC_FAN_SUMMARY_MODEL =
  process.env.ANTHROPIC_FAN_SUMMARY_MODEL || "claude-3-5-haiku-latest";

// On ne régénère les notes fan qu'une fois tous les N messages plutôt qu'à
// chaque échange — la mémoire n'a pas besoin d'être mise à jour message par
// message, et ça multiplierait par deux le nombre d'appels API pour un
// bénéfice marginal.
const FAN_SUMMARY_INTERVAL_MESSAGES = 8;

let _anthropic: Anthropic | null = null;
function anthropic() {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

export function publicWebUrl() {
  // RENDER_EXTERNAL_URL est fourni automatiquement par Render — évite
  // d'avoir à connaître l'URL publique avant le premier déploiement.
  return (
    process.env.PUBLIC_WEB_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    "http://localhost:3000"
  );
}

/**
 * Régénère (si besoin) la mémoire légère d'un fan : un résumé texte évolutif
 * ("notes") + une estimation de potentiel, à partir de l'historique complet
 * de la conversation. Fire-and-forget côté appelant — un échec ici ne doit
 * jamais faire échouer l'envoi de la réponse au fan, c'est une amélioration
 * secondaire, pas un chemin critique.
 *
 * Ne se déclenche que tous les FAN_SUMMARY_INTERVAL_MESSAGES messages (voir
 * summarized_through en base) pour garder le coût d'appel modèle sous
 * contrôle — pas besoin de re-résumer à chaque message.
 */
async function maybeUpdateFanProfile(creator: Creator, chatId: string): Promise<void> {
  try {
    const [profile, messageCount] = await Promise.all([
      getFanProfile(creator.id, chatId),
      getMessageCountForChat(creator.id, chatId),
    ]);
    const summarizedThrough = profile?.summarizedThrough || 0;
    if (messageCount - summarizedThrough < FAN_SUMMARY_INTERVAL_MESSAGES) return;

    const history = await getRecentMessages({ creatorId: creator.id, chatId, limit: 60 });
    if (history.length === 0) return;

    const transcript = history
      .map((m) => `${m.role === "user" ? "Fan" : creator.displayName}: ${m.content}`)
      .join("\n");

    const response = await anthropic().messages.create({
      model: ANTHROPIC_FAN_SUMMARY_MODEL,
      max_tokens: 300,
      system:
        `Tu analyses une conversation entre une créatrice de contenu (${creator.displayName}) ` +
        `et un de ses fans, pour l'aider à se souvenir de qui est ce fan et à mieux vendre ses ` +
        `offres. Notes précédentes sur ce fan (peuvent être vides) : "${profile?.notes || ""}".\n\n` +
        `Réponds UNIQUEMENT avec un objet JSON, sans texte autour, au format exact :\n` +
        `{"notes": "résumé factuel court (2-4 phrases) : prénom si connu, centres ` +
        `d'intérêt, ce qui l'engage, historique d'achat ou d'hésitation, éléments à ` +
        `retenir pour personnaliser la conversation", "potential": "faible" | "moyen" | "élevé"}\n\n` +
        `"potential" reflète la probabilité que ce fan achète une offre bientôt, d'après son ` +
        `engagement et ses signaux dans la conversation. Ne mentionne jamais qu'il s'agit d'une ` +
        `analyse automatisée dans le champ "notes" — écris-le comme une note interne factuelle.`,
      messages: [{ role: "user", content: transcript }],
    });

    const raw = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("")
      .trim();

    let parsed: { notes?: string; potential?: string } = {};
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(match ? match[0] : raw);
    } catch {
      // Réponse pas du JSON exploitable — on garde les notes précédentes
      // plutôt que d'écrire n'importe quoi en base.
      parsed = { notes: profile?.notes, potential: profile?.potential || undefined };
    }

    await upsertFanNotes(creator.id, chatId, {
      notes: parsed.notes || profile?.notes || "",
      potential: parsed.potential || profile?.potential || null,
      summarizedThrough: messageCount,
    });
  } catch (err) {
    console.error(`[${creator.displayName}] échec de la mise à jour du profil fan:`, err);
  }
}

/**
 * Génère (et enregistre en base) la réponse du bot à un message utilisateur,
 * quel que soit le canal d'où il vient (Telegram, chat web sur le site...).
 * `chatId` identifie la conversation côté canal — id de chat Telegram, ou id
 * de session visiteur pour le chat web — c'est ce qui sépare l'historique
 * d'une conversation à l'autre pour une même créatrice.
 *
 * Les deux règles [GARDE-FOU] de packages/db/persona.js s'appliquent ici,
 * identiquement quel que soit le canal.
 */
export async function generateBotReply(
  creator: Creator,
  chatId: string,
  userText: string
): Promise<string> {
  // Le message est marqué "flagged" plutôt que d'être écarté en silence :
  // ça alimente le tableau de modération admin (voir /admin, onglet
  // Modération) pour que Bryan puisse vérifier un vrai signal de détresse —
  // avant ce commentaire, ce message n'était JAMAIS enregistré du tout, ce
  // qui ne laissait aucune trace consultable en cas de besoin réel.
  const flagged = containsSafetyKeyword(userText);
  await appendMessage({ creatorId: creator.id, chatId, role: "user", content: userText, flagged });

  if (flagged) {
    const fallbackReply = getSafeFallbackReply(creator.personaLanguage);
    await appendMessage({
      creatorId: creator.id,
      chatId,
      role: "assistant",
      content: fallbackReply,
    });
    return fallbackReply;
  }

  const [rawTiers, fanProfile] = await Promise.all([
    listTiers(creator.id),
    getFanProfile(creator.id, chatId),
  ]);
  const tiers = rawTiers.map((t) => ({
    ...t,
    shortUrl: `${publicWebUrl()}/l/${creator.id}-${t.order}`,
  }));

  const systemPrompt = buildSystemPrompt({
    creatorName: creator.displayName,
    tone: creator.personaTone,
    bio: creator.personaBio,
    tiers,
    language: creator.personaLanguage,
    fanNotes: fanProfile?.notes || null,
    fanPotential: fanProfile?.potential || null,
  });

  const history = await getRecentMessages({ creatorId: creator.id, chatId, limit: 20 });

  let replyText: string;
  try {
    const response = await anthropic().messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 400,
      system: systemPrompt,
      messages: history as { role: "user" | "assistant"; content: string }[],
    });
    replyText = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("")
      .trim();
  } catch (err) {
    console.error(`[${creator.displayName}] erreur API Claude:`, err);
    return "Petit bug de mon côté, réessaie dans une minute 😅";
  }

  if (!replyText) replyText = "Dis-m'en un peu plus ? 😊";

  await appendMessage({ creatorId: creator.id, chatId, role: "assistant", content: replyText });

  // Fire-and-forget : la mise à jour de la mémoire fan ne doit jamais
  // retarder la réponse envoyée à la personne qui discute.
  maybeUpdateFanProfile(creator, chatId).catch(() => {});

  return replyText;
}
