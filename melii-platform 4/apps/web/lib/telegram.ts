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

function publicWebUrl() {
  // RENDER_EXTERNAL_URL est fourni automatiquement par Render — évite
  // d'avoir à connaître l'URL publique avant le premier déploiement.
  return (
    process.env.PUBLIC_WEB_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    "http://localhost:3000"
  );
}

async function sendTelegramMessage(botToken: string, chatId: number | string, text: string) {
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

type TelegramUpdate = {
  message?: {
    chat: { id: number | string };
    text?: string;
  };
};

/**
 * Traite un update Telegram pour une créatrice donnée. Appelé sans être
 * attendu (fire-and-forget) par la route webhook, qui doit répondre à
 * Telegram en moins de quelques secondes — voir
 * app/api/telegram-webhook/[creatorId]/route.ts.
 */
export async function handleTelegramUpdate(creator: Creator, update: TelegramUpdate) {
  const message = update?.message;
  if (!message || typeof message.text !== "string" || !creator.telegramBotToken) return;

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

  await appendMessage({ creatorId: creator.id, chatId: String(chatId), role: "user", content: userText });

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

  const history = await getRecentMessages({ creatorId: creator.id, chatId: String(chatId), limit: 20 });

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
    await sendTelegramMessage(creator.telegramBotToken, chatId, "Petit bug de mon côté, réessaie dans une minute 😅");
    return;
  }

  if (!replyText) replyText = "Dis-m'en un peu plus ? 😊";

  await appendMessage({ creatorId: creator.id, chatId: String(chatId), role: "assistant", content: replyText });

  // NB : le clic réel (compté pour les stats/commission) est enregistré par
  // /l/[code] quand la personne clique VRAIMENT sur le lien, pas ici.

  await sendTelegramMessage(creator.telegramBotToken, chatId, replyText);
}
