import { NextResponse } from "next/server";
import { getCreatorById, getRecentMessages } from "@melii/db";
import { generateBotReply } from "@/lib/chat-engine";

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
