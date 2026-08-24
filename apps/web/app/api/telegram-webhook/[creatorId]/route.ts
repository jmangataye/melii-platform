import { NextResponse } from "next/server";
import { getCreatorById } from "@melii/db";
import { handleTelegramUpdate } from "@/lib/telegram";

// Telegram appelle cette route à chaque nouveau message reçu par le bot de
// la créatrice `creatorId`. On répond tout de suite (Telegram exige une
// réponse rapide) puis on traite le message en arrière-plan — possible ici
// parce que le site tourne en process Node persistant (ex. Render "Web
// Service"), pas en fonction serverless qui se couperait après la réponse.
export async function POST(
  req: Request,
  ctx: { params: Promise<{ creatorId: string }> }
) {
  const { creatorId } = await ctx.params;
  const creator = await getCreatorById(creatorId);

  if (!creator || !creator.telegramBotToken) {
    return NextResponse.json({ error: "unknown creator" }, { status: 404 });
  }

  // Fail-closed : si le secret n'est pas en base (ne devrait jamais arriver
  // tant qu'un bot est connecté — token et secret sont toujours écrits
  // ensemble, voir updateCreatorTelegram), on refuse plutôt que de traiter
  // l'update sans vérification. Un secret manquant ne doit jamais se
  // traduire par "tout accepter".
  const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
  if (!creator.telegramWebhookSecret || secretHeader !== creator.telegramWebhookSecret) {
    return NextResponse.json({ error: "invalid secret" }, { status: 401 });
  }

  const update = await req.json().catch(() => null);

  if (update) {
    handleTelegramUpdate(creator, update).catch((err) => {
      console.error(`[${creator.displayName}] erreur traitement update:`, err);
    });
  }

  return NextResponse.json({ ok: true });
}
