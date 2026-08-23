import { NextRequest, NextResponse } from "next/server";
import { consumePasswordResetToken } from "@melii/db";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!token) {
    return NextResponse.json({ error: "Lien invalide." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Le mot de passe doit faire au moins 8 caractères." },
      { status: 400 }
    );
  }

  const ok = await consumePasswordResetToken(token, password);
  if (!ok) {
    return NextResponse.json(
      { error: "Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
