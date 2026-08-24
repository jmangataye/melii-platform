import { NextRequest, NextResponse } from "next/server";
import { createPasswordResetToken, getCreatorByEmail } from "@melii/db";
import { sendEmail } from "@/lib/email";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

function publicWebUrl() {
  return process.env.PUBLIC_WEB_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:3000";
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(`forgot-password:${clientIp(req)}`, { limit: 5, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json({
      message: "Si un compte existe avec cet email, un lien de réinitialisation vient d'être envoyé.",
    });
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";

  // Réponse identique que le compte existe ou non : évite de révéler quels
  // emails sont inscrits (énumération de comptes).
  const genericResponse = NextResponse.json({
    message: "Si un compte existe avec cet email, un lien de réinitialisation vient d'être envoyé.",
  });

  if (!email) return genericResponse;

  const creator = await getCreatorByEmail(email);
  if (!creator) return genericResponse;

  const token = await createPasswordResetToken(creator.id);
  const resetUrl = `${publicWebUrl()}/reset-password?token=${token}`;

  await sendEmail({
    to: creator.email,
    subject: "Réinitialisation de votre mot de passe Melii",
    text: `Bonjour,\n\nCliquez sur ce lien pour choisir un nouveau mot de passe (valable 30 minutes) :\n${resetUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
  });

  return genericResponse;
}
