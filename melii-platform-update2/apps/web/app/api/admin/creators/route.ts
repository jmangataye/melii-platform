import { NextResponse } from "next/server";
import { adminListCreators, COMMISSION_RATE, TRIAL_DAYS } from "@melii/db";
import { getCurrentCreatorId, isAdminEmail } from "@/lib/auth";
import { getCreatorById } from "@melii/db";

// Route protégée : réservée aux emails listés dans ADMIN_EMAILS. Contrairement
// aux routes créatrice, on vérifie ici l'email du compte connecté et pas
// seulement la présence d'une session — voir isAdminEmail().
async function requireAdmin() {
  const creatorId = await getCurrentCreatorId();
  if (!creatorId) return null;
  const creator = await getCreatorById(creatorId);
  if (!creator || !isAdminEmail(creator.email)) return null;
  return creator;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "non autorisé" }, { status: 403 });
  }

  const creators = await adminListCreators();

  const summary = creators.reduce(
    (acc, c) => {
      acc.totalCreators += 1;
      if (c.subscriptionStatus === "trial") acc.inTrial += 1;
      if (c.subscriptionStatus === "active") acc.active += 1;
      if (c.subscriptionStatus === "past_due" || c.subscriptionStatus === "canceled") acc.churnedOrPastDue += 1;
      acc.totalCommissionOwedCents += c.commissionOwedCents;
      acc.totalConversations30d += c.conversations30d;
      return acc;
    },
    { totalCreators: 0, inTrial: 0, active: 0, churnedOrPastDue: 0, totalCommissionOwedCents: 0, totalConversations30d: 0 }
  );

  return NextResponse.json({ creators, summary, commissionRate: COMMISSION_RATE, trialDays: TRIAL_DAYS });
}
