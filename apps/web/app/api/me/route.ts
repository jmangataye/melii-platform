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
      avatarUrl: creator.avatarUrl,
      accentColor: creator.accentColor,
      slug: creator.slug,
      galleryUrls: creator.galleryUrls,
      referralCode: creator.referralCode,
      totpEnabled: creator.totpEnabled,
      customDomain: creator.customDomain,
      customDomainVerifyToken: creator.customDomainVerifyToken,
      customDomainVerified: creator.customDomainVerified,
      relanceEnabled: creator.relanceEnabled,
    },
    isAdmin: isAdminEmail(creator.email),
    tiers,
    stats,
  });
}
