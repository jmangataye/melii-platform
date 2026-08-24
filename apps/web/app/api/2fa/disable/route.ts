import { NextRequest, NextResponse } from "next/server";
import { consumeBackupCode, disableTotp, getTotpSecretRaw, verifyTotpCode } from "@melii/db";
import { getCurrentCreatorId } from "@/lib/auth";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

// Désactiver le 2FA demande un code valide (ou un code de secours), pas
// seulement une session active — sinon quelqu'un qui met la main sur un
// appareil déjà connecté pourrait désactiver la protection sans rien
// connaître du compte.
//
// Rate-limité comme verify-2fa : sans ça, un cookie de session volé (XSS,
// appareil partagé) suffirait à essayer les ~10^6 codes à 6 chiffres en
// boucle jusqu'à désactiver le 2FA sans jamais avoir le vrai code. On limite
// à la fois par compte (résiste à la rotation d'IP) et par IP (résiste à un
// attaquant qui viserait plusieurs comptes depuis la même machine).
export async function POST(req: NextRequest) {
  const creatorId = await getCurrentCreatorId();
  if (!creatorId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (
    !checkRateLimit(`2fa-disable-creator:${creatorId}`, { limit: 5, windowMs: 15 * 60 * 1000 }) ||
    !checkRateLimit(`2fa-disable-ip:${clientIp(req)}`, { limit: 10, windowMs: 15 * 60 * 1000 })
  ) {
    return NextResponse.json({ error: "Trop de tentatives, réessayez dans quelques minutes." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.trim() : "";

  const totp = await getTotpSecretRaw(creatorId);
  if (!totp?.enabled || !totp.secret) {
    return NextResponse.json({ error: "Le 2FA n'est pas activé." }, { status: 400 });
  }

  const isValid = /^\d{6}$/.test(code) ? verifyTotpCode(totp.secret, code) : await consumeBackupCode(creatorId, code);
  if (!isValid) {
    return NextResponse.json({ error: "Code incorrect." }, { status: 401 });
  }

  await disableTotp(creatorId);
  return NextResponse.json({ ok: true });
}
