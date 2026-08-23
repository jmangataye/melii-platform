/**
 * OPTIONNEL / NON UTILISÉ PAR LE DÉPLOIEMENT PAR DÉFAUT.
 *
 * Cette logique de webhook a été fusionnée dans apps/web
 * (app/api/telegram-webhook/[creatorId]/route.ts + lib/telegram.ts) pour
 * que tout tienne dans UN SEUL service déployable (important sur des PaaS
 * comme Render où un disque persistant n'est pas partagé entre plusieurs
 * services). Gardez ce fichier de côté si un jour le volume de messages
 * justifie de sortir les bots dans leur propre process — le code ci-dessous
 * fonctionne toujours, il n'est juste plus branché par défaut.
 *
 * Lancement : node src/server.js  (ou npm run dev)
 * Variables d'environnement requises : voir ../../.env.example
 */

const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");
const {
  getCreatorById,
  listTiers,
  appendMessage,
  getRecentMessages,
} = require("@melii/db");
const { buildSystemPrompt, containsSafetyKeyword, SAFE_FALLBACK_REPLY } = require("@melii/db/persona");

const PORT = process.env.BOT_RUNNER_PORT || 4001;
const PUBLIC_WEB_URL = process.env.PUBLIC_WEB_URL || "http://localhost:3000";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

// Telegram appelle cette route à chaque nouveau message reçu par le bot
// de la créatrice `creatorId`. On répond 200 tout de suite (Telegram exige
// une réponse rapide) puis on traite le message de façon asynchrone.
app.post("/webhook/:creatorId", async (req, res) => {
  const { creatorId } = req.params;
  const creator = getCreatorById(creatorId);

  if (!creator || !creator.telegramBotToken) {
    return res.status(404).send("unknown creator");
  }

  // Vérifie que l'appel vient bien de Telegram (secret_token configuré à
  // l'enregistrement du webhook, voir apps/web).
  const secretHeader = req.get("x-telegram-bot-api-secret-token");
  if (creator.telegramWebhookSecret && secretHeader !== creator.telegramWebhookSecret) {
    return res.status(401).send("invalid secret");
  }

  res.status(200).send("ok"); // ack immédiat

  try {
    await handleUpdate(creator, req.body);
  } catch (err) {
    console.error(`[${creator.displayName}] erreur traitement update:`, err);
  }
});

async function handleUpdate(creator, update) {
  const message = update && update.message;
  if (!message || typeof message.text !== "string") return;

  const chatId = message.chat.id;
  const userText = message.text;

  if (userText === "/start") {
    await sendTelegramMessage(
      creator.telegramBotToken,
      chatId,
      `Hey toi 😊 contente que tu sois là ! Raconte-moi un peu qui tu es, je suis ${creator.displayName}.`
    );
    return;
  }

  if (containsSafetyKeyword(userText)) {
    await sendTelegramMessage(creator.telegramBotToken, chatId, SAFE_FALLBACK_REPLY);
    return;
  }

  appendMessage({ creatorId: creator.id, chatId, role: "user", content: userText });

  const tiers = listTiers(creator.id).map((t) => ({
    ...t,
    shortUrl: `${PUBLIC_WEB_URL}/l/${creator.id}-${t.order}`,
  }));

  const systemPrompt = buildSystemPrompt({
    creatorName: creator.displayName,
    tone: creator.personaTone,
    bio: creator.personaBio,
    tiers,
  });

  const history = getRecentMessages({ creatorId: creator.id, chatId, limit: 20 });

  let replyText;
  try {
    const response = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 400,
      system: systemPrompt,
      messages: history,
    });
    replyText = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
  } catch (err) {
    console.error(`[${creator.displayName}] erreur API Claude:`, err);
    await sendTelegramMessage(creator.telegramBotToken, chatId, "Petit bug de mon côté, réessaie dans une minute 😅");
    return;
  }

  if (!replyText) replyText = "Dis-m'en un peu plus ? 😊";

  appendMessage({ creatorId: creator.id, chatId, role: "assistant", content: replyText });

  // NB : le clic réel (et donc la stat qui compte) est enregistré par
  // apps/web à la route /l/[code] quand la personne clique VRAIMENT sur le
  // lien — pas ici. Ça évite de confondre "lien envoyé" et "lien cliqué".

  await sendTelegramMessage(creator.telegramBotToken, chatId, replyText);
}

async function sendTelegramMessage(botToken, chatId, text) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("Échec envoi Telegram:", res.status, body);
  }
}

app.listen(PORT, () => {
  console.log(`bot-runner en écoute sur :${PORT}`);
});
