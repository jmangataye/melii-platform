import { NextResponse } from "next/server";
import { getCreatorById, listTiers, getStats } from "@melii/db";
import { getCurrentCreatorId, isAdminEmail } from "@/lib/auth";

export async function GET() {
  const creatorId = await getCurrentCreatorId();
  if (!creatorId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const creator = await getCreatorById(creatorId);
  if (!creator) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const tiers = await listTiers(creatorId);
  const stats = await getStats(creatorId);

  return NextResponse.json({
    creator: {
      id: creator.id,
      email: creator.email,
      displayName: creator.displayName,
      personaTone: creator.personaTone,
      personaBio: creator.personaBio,
      telegramBotUsername: creator.telegramBotUsername,
      telegramWebhookReady: creator.telegramWebhookReady,
      hasTelegramToken: !!creator.telegramBotToken,
    },
    isAdmin: isAdminEmail(creator.email),
    tiers,
    stats,
  });
}
