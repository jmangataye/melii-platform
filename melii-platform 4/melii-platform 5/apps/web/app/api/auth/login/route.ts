import { NextRequest, NextResponse } from "next/server";
import { getCreatorByEmail, verifyPassword } from "@melii/db";
import { setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const creator = email ? await getCreatorByEmail(email) : null;
  if (!creator || !verifyPassword(password, creator.passwordHash)) {
    return NextResponse.json({ error: "Email ou mot de passe incorrect." }, { status: 401 });
  }

  await setSessionCookie(creator.id);
  return NextResponse.json({ id: creator.id, email: creator.email });
}
