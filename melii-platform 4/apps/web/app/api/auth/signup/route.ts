import { NextRequest, NextResponse } from "next/server";
import { createCreator, getCreatorByEmail } from "@melii/db";
import { setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Email invalide." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Le mot de passe doit faire au moins 8 caractères." },
      { status: 400 }
    );
  }
  if (!displayName) {
    return NextResponse.json({ error: "Le prénom affiché est requis." }, { status: 400 });
  }

  if (await getCreatorByEmail(email)) {
    return NextResponse.json({ error: "Un compte existe déjà avec cet email." }, { status: 409 });
  }

  const creator = await createCreator({ email, password, displayName });
  await setSessionCookie(creator.id);

  return NextResponse.json({ id: creator.id, email: creator.email });
}
