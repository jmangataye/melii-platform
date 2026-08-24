import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { updateCreatorTelegram } from "@melii/db";
import { getCurrentCreatorId } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const creatorId = await getCurrentCreatorId();
  if (!creatorId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Token Telegram requis." }, { status: 400 });
  }

  // RENDER_EXTERNAL_URL est fourni automatiquement par Render — évite
  // d'avoir à connaître l'URL publique avant le premier déploiement.
  const publicUrl = process.env.PUBLIC_WEB_URL || process.env.RENDER_EXTERNAL_URL;
  if (!publicUrl) {
    return NextResponse.json(
      { error: "PUBLIC_WEB_URL n'est pas configuré côté serveur." },
      { status: 500 }
    );
  }

  // 1. Vérifie que le token est valide et récupère le username du bot.
  let username: string;
  try {
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const me = await meRes.json();
    if (!me.ok) {
      return NextResponse.json({ error: "Token Telegram invalide." }, { status: 400 });
    }
    username = me.result.username;
  } catch {
    return NextResponse.json(
      { error: "Impossible de joindre Telegram pour vérifier le token. Réessayez." },
      { status: 502 }
    );
  }

  // 2. Enregistre le webhook auprès de Telegram, avec un secret propre à
  // cette créatrice (vérifié à chaque appel entrant par
  // app/api/telegram-webhook/[creatorId]/route.ts).
  const webhookSecret = crypto.randomBytes(24).toString("hex");
  const webhookUrl = `${publicUrl.replace(/\/$/, "")}/api/telegram-webhook/${creatorId}`;

  try {
    const setRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: webhookUrl, secret_token: webhookSecret }),
    });
    const setJson = await setRes.json();
    if (!setJson.ok) {
      return NextResponse.json(
        { error: `Échec de l'enregistrement du webhook Telegram : ${setJson.description || "erreur inconnue"}` },
        { status: 502 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Impossible de joindre Telegram pour enregistrer le webhook. Réessayez." },
      { status: 502 }
    );
  }

  const creator = await updateCreatorTelegram(creatorId, {
    token,
    username,
    webhookSecret,
    webhookReady: true,
  });

  return NextResponse.json({
    ok: true,
    telegramBotUsername: creator.telegramBotUsername,
  });
}

export async function DELETE() {
  const creatorId = await getCurrentCreatorId();
  if (!creatorId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await updateCreatorTelegram(creatorId, {
    token: null,
    username: null,
    webhookSecret: null,
    webhookReady: false,
  });
  return NextResponse.json({ ok: true });
}
