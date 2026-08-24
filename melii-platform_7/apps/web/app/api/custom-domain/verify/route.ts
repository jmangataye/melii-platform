import { NextResponse } from "next/server";
import { getCreatorById, markCustomDomainVerified } from "@melii/db";
import { getCurrentCreatorId } from "@/lib/auth";
import { verifyDomainToken } from "@/lib/custom-domain";

export async function POST() {
  const creatorId = await getCurrentCreatorId();
  if (!creatorId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const creator = await getCreatorById(creatorId);
  if (!creator?.customDomain || !creator.customDomainVerifyToken) {
    return NextResponse.json({ error: "Aucun domaine en attente de vérification." }, { status: 400 });
  }

  if (creator.customDomainVerified) {
    return NextResponse.json({ ok: true, verified: true });
  }

  const found = await verifyDomainToken(creator.customDomain, creator.customDomainVerifyToken);
  if (!found) {
    return NextResponse.json({
      ok: true,
      verified: false,
      error: "Enregistrement TXT introuvable — la propagation DNS peut prendre jusqu'à quelques heures.",
    });
  }

  await markCustomDomainVerified(creatorId);
  return NextResponse.json({ ok: true, verified: true });
}
