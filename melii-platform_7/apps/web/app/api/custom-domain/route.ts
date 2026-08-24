import { NextRequest, NextResponse } from "next/server";
import { setCustomDomainPending } from "@melii/db";
import { getCurrentCreatorId } from "@/lib/auth";
import { challengeHostFor } from "@/lib/custom-domain";

const DOMAIN_FORMAT = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})+$/i;

export async function POST(req: NextRequest) {
  const creatorId = await getCurrentCreatorId();
  if (!creatorId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const domain = typeof body?.domain === "string" ? body.domain.trim().toLowerCase() : "";

  if (!DOMAIN_FORMAT.test(domain)) {
    return NextResponse.json({ error: "Nom de domaine invalide (ex : lunabot.com)." }, { status: 400 });
  }

  try {
    const creator = await setCustomDomainPending(creatorId, domain);
    return NextResponse.json({
      ok: true,
      customDomain: creator.customDomain,
      verifyToken: creator.customDomainVerifyToken,
      challengeHost: challengeHostFor(domain),
    });
  } catch (err) {
    // Contrainte UNIQUE sur custom_domain — une autre créatrice a déjà
    // revendiqué ce domaine. Message clair plutôt qu'un 500 générique.
    const message = err instanceof Error ? err.message : "";
    if (message.includes("duplicate key") || message.includes("unique constraint")) {
      return NextResponse.json(
        { error: "Ce domaine est déjà utilisé par une autre créatrice." },
        { status: 409 }
      );
    }
    throw err;
  }
}

export async function DELETE() {
  const creatorId = await getCurrentCreatorId();
  if (!creatorId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await setCustomDomainPending(creatorId, null);
  return NextResponse.json({ ok: true });
}
