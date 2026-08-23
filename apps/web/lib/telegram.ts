import type { Creator } from "@melii/db";
import { generateBotReply } from "./chat-engine";

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
 *
 * La génération de réponse elle-même (persona, garde-fous, appel Claude,
 * historique) est partagée avec le chat web dans lib/chat-engine.ts — ce
 * fichier ne s'occupe que de la spécificité Telegram (update, /start, envoi).
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

  const replyText = await generateBotReply(creator, String(chatId), userText);

  // NB : le clic réel (compté pour les stats/commission) est enregistré par
  // /l/[code] quand la personne clique VRAIMENT sur le lien, pas ici.

  await sendTelegramMessage(creator.telegramBotToken, chatId, replyText);
}
