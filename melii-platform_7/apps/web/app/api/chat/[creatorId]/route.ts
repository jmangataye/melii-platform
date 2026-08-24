import { NextResponse } from "next/server";
import { getCreatorById, getRecentMessages } from "@melii/db";
import { generateBotReply } from "@/lib/chat-engine";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

// Route publique (pas d'authentification) : c'est le chat que les visiteurs
// d'une créatrice utilisent directement depuis /c/[creatorId]. `chatId` est
// un identifiant de session généré côté navigateur (voir ChatWidget.tsx),
// pas un compte — ça garde le chat sans inscription pour le visiteur.

export async function GET(req: Request, ctx: { params: Promise<{ creatorId: string }> }) {
  const { creatorId } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const chatId = searchParams.get("chatId");

  if (!chatId) {
    return NextResponse.json({ error: "chatId requis" }, { status: 400 });
  }

  const creator = await getCreatorById(creatorId);
  if (!creator) {
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }

  const messages = await getRecentMessages({ creatorId, chatId, limit: 20 });
  return NextResponse.json({ displayName: creator.displayName, messages });
}

export async function POST(req: Request, ctx: { params: Promise<{ creatorId: string }> }) {
  const { creatorId } = await ctx.params;

  // Un appel Claude coûte de l'argent réel à chaque message : limite plus
  // stricte qu'un simple anti-bruteforce, par IP ET par créatrice visée
  // pour qu'un visiteur abusif sur un bot n'affecte pas les autres.
  const ip = clientIp(req);
  if (
    !checkRateLimit(`chat-ip:${ip}`, { limit: 30, windowMs: 60 * 1000 }) ||
    !checkRateLimit(`chat-creator:${creatorId}`, { limit: 120, windowMs: 60 * 1000 })
  ) {
    return NextResponse.json({ error: "Trop de messages, ralentis un peu 🙂" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const chatId = typeof body?.chatId === "string" ? body.chatId : null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!chatId || !message) {
    return NextResponse.json({ error: "requête invalide" }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: "message trop long" }, { status: 400 });
  }

  const creator = await getCreatorById(creatorId);
  if (!creator) {
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }

  const reply = await generateBotReply(creator, chatId, message);
  return NextResponse.json({ reply });
}
