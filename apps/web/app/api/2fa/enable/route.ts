import { NextRequest, NextResponse } from "next/server";
import { enableTotp, verifyTotpCode } from "@melii/db";
import { getCurrentCreatorId } from "@/lib/auth";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

// Étape 2/2 : la créatrice renvoie le secret reçu à l'étape /api/2fa/setup
// avec le code à 6 chiffres généré par son appli — on vérifie que le code
// correspond avant de persister quoi que ce soit, pour ne jamais activer un
// secret qu'elle n'a pas réussi à scanner correctement.
//
// Rate-limité par précaution (même logique que /2fa/disable) : cet appel
// vérifie aussi un code à 6 chiffres contre un secret connu du serveur.
export async function POST(req: NextRequest) {
  const creatorId = await getCurrentCreatorId();
  if (!creatorId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (
    !checkRateLimit(`2fa-enable-creator:${creatorId}`, { limit: 10, windowMs: 15 * 60 * 1000 }) ||
    !checkRateLimit(`2fa-enable-ip:${clientIp(req)}`, { limit: 20, windowMs: 15 * 60 * 1000 })
  ) {
    return NextResponse.json({ error: "Trop de tentatives, réessayez dans quelques minutes." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const secret = typeof body?.secret === "string" ? body.secret : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";

  if (!secret || !verifyTotpCode(secret, code)) {
    return NextResponse.json({ error: "Code incorrect. Vérifiez l'heure de votre téléphone et réessayez." }, { status: 400 });
  }

  const backupCodes = await enableTotp(creatorId, secret);
  return NextResponse.json({ ok: true, backupCodes });
}
