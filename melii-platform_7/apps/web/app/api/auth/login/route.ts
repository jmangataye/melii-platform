import { NextRequest, NextResponse } from "next/server";
import { getCreatorByEmail, verifyPassword } from "@melii/db";
import { setSessionCookie, createPending2faToken } from "@/lib/auth";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // 10 tentatives / 5 minutes / IP — assez pour un vrai oubli de mot de
  // passe, trop peu pour un bruteforce efficace.
  if (!checkRateLimit(`login:${clientIp(req)}`, { limit: 10, windowMs: 5 * 60 * 1000 })) {
    return NextResponse.json({ error: "Trop de tentatives, réessayez dans quelques minutes." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const creator = email ? await getCreatorByEmail(email) : null;
  if (!creator || !verifyPassword(password, creator.passwordHash)) {
    return NextResponse.json({ error: "Email ou mot de passe incorrect." }, { status: 401 });
  }

  // 2FA activé : mot de passe correct mais pas encore de session — un jeton
  // intermédiaire de 5 minutes autorise uniquement /api/auth/verify-2fa,
  // jamais l'accès direct au compte (voir lib/auth.ts).
  if (creator.totpEnabled) {
    return NextResponse.json({ needsTwoFactor: true, pendingToken: createPending2faToken(creator.id) });
  }

  await setSessionCookie(creator.id);
  return NextResponse.json({ id: creator.id, email: creator.email });
}
