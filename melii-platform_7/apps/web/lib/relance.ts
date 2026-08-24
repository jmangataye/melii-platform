import { findStalledTelegramConversations, getTierById, recordRelanceSent } from "@melii/db";
import { sendTelegramMessage } from "./telegram";

// Nombre max de relances envoyées par exécution du job — un lot volontairement
// petit : le job tourne toutes les heures (voir instrumentation.ts), donc pas
// besoin de tout traiter d'un coup, et ça limite le risque en cas de bug.
const RELANCE_BATCH_LIMIT = 20;

/**
 * Envoie une relance unique aux conversations Telegram "abandonnées"
 * éligibles (voir les garde-fous dans findStalledTelegramConversations côté
 * DB : opt-in par créatrice, une seule fois par conversation, jamais sur une
 * conversation signalée). Message volontairement court, chaleureux, sans
 * pression — pas de compte à rebours ni de relance en cascade.
 */
export async function runRelanceJob(): Promise<number> {
  const stalled = await findStalledTelegramConversations(RELANCE_BATCH_LIMIT);
  let sent = 0;

  for (const conv of stalled) {
    if (!conv.telegramBotToken) continue;

    const tier = conv.tierId ? await getTierById(conv.tierId) : null;
    const message = tier
      ? `Hey, petit coucou 😊 je voulais juste prendre de tes nouvelles — tu avais jeté un œil à "${tier.label}", n'hésite pas si tu as des questions, je suis toujours là !`
      : `Hey, petit coucou 😊 je suis toujours là si tu veux qu'on continue notre discussion !`;

    try {
      await sendTelegramMessage(conv.telegramBotToken, conv.chatId, message);
      await recordRelanceSent({ creatorId: conv.creatorId, chatId: conv.chatId, tierId: conv.tierId });
      sent++;
    } catch (err) {
      console.error(`[relance] échec d'envoi pour ${conv.creatorId}/${conv.chatId}:`, err);
    }
  }

  return sent;
}
