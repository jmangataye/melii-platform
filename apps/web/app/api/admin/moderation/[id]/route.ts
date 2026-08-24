import { NextResponse } from "next/server";
import { getCreatorById, markFlagReviewed } from "@melii/db";
import { getCurrentCreatorId, isAdminEmail } from "@/lib/auth";

async function requireAdmin() {
  const creatorId = await getCurrentCreatorId();
  if (!creatorId) return null;
  const creator = await getCreatorById(creatorId);
  if (!creator || !isAdminEmail(creator.email)) return null;
  return creator;
}

export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "non autorisé" }, { status: 403 });

  const { id } = await params;
  const ok = await markFlagReviewed(id);
  if (!ok) return NextResponse.json({ error: "Message introuvable." }, { status: 404 });

  return NextResponse.json({ ok: true });
}
