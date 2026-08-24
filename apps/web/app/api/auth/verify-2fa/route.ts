import { NextRequest, NextResponse } from "next/server";
import { getCreatorById, getTotpSecretRaw, verifyTotpCode, consumeBackupCode } from "@melii/db";
import { setSessionCookie, verifyPending2faToken } from "@/lib/auth";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  if (!checkRateLimit(`verify-2fa:${clientIp(req)}`, { limit: 10, windowMs: 5 * 60 * 1000 })) {
    return NextResponse.json({ error: "Trop de tentatives, réessayez dans quelques minutes." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const pendingToken = typeof body?.pendingToken === "string" ? body.pendingToken : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";

  const creatorId = verifyPending2faToken(pendingToken);
  if (!creatorId) {
    return NextResponse.json({ error: "Session de connexion expirée, recommencez." }, { status: 401 });
  }

  const creator = await getCreatorById(creatorId);
  const totp = await getTotpSecretRaw(creatorId);
  if (!creator || !totp?.enabled || !totp.secret) {
    return NextResponse.json({ error: "2FA non activé sur ce compte." }, { status: 400 });
  }

  // Un code à 6 chiffres est un vrai code TOTP ; sinon on tente un code de
  // secours (8 caractères hex, généré à l'activation) — les deux formats ne
  // se chevauchent jamais donc pas d'ambiguïté possible.
  const isValid = /^\d{6}$/.test(code)
    ? verifyTotpCode(totp.secret, code)
    : await consumeBackupCode(creatorId, code);

  if (!isValid) {
    return NextResponse.json({ error: "Code incorrect." }, { status: 401 });
  }

  await setSessionCookie(creator.id);
  return NextResponse.json({ id: creator.id, email: creator.email });
}
