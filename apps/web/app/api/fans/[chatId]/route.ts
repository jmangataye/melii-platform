import { NextResponse } from "next/server";
import { deleteFanData } from "@melii/db";
import { getCurrentCreatorId } from "@/lib/auth";

// Supprime UNE conversation (messages, notes IA, trace de consentement
// d'âge) — pas tout le compte créatrice. Sert à honorer une demande de
// suppression de données faite par un fan précis (bouton "Supprimer" dans
// le panneau Fans, voir FansTab dans DashboardApp.tsx).
export async function DELETE(req: Request, ctx: { params: Promise<{ chatId: string }> }) {
  const creatorId = await getCurrentCreatorId();
  if (!creatorId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { chatId } = await ctx.params;
  if (!chatId) return NextResponse.json({ error: "chatId requis" }, { status: 400 });

  await deleteFanData(creatorId, decodeURIComponent(chatId));
  return NextResponse.json({ ok: true });
}
