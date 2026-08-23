import Anthropic from "@anthropic-ai/sdk";
import type { Creator } from "@melii/db";
import { appendMessage, getRecentMessages, listTiers } from "@melii/db";
import { buildSystemPrompt, containsSafetyKeyword, SAFE_FALLBACK_REPLY } from "@melii/db/persona";

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

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
  if (containsSafetyKeyword(userText)) {
    return SAFE_FALLBACK_REPLY;
  }

  await appendMessage({ creatorId: creator.id, chatId, role: "user", content: userText });

  const rawTiers = await listTiers(creator.id);
  const tiers = rawTiers.map((t) => ({
    ...t,
    shortUrl: `${publicWebUrl()}/l/${creator.id}-${t.order}`,
  }));

  const systemPrompt = buildSystemPrompt({
    creatorName: creator.displayName,
    tone: creator.personaTone,
    bio: creator.personaBio,
    tiers,
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

  return replyText;
}
