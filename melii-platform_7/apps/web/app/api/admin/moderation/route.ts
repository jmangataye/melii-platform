import { NextResponse } from "next/server";
import { getCreatorById, listFlaggedConversations } from "@melii/db";
import { getCurrentCreatorId, isAdminEmail } from "@/lib/auth";

async function requireAdmin() {
  const creatorId = await getCurrentCreatorId();
  if (!creatorId) return null;
  const creator = await getCreatorById(creatorId);
  if (!creator || !isAdminEmail(creator.email)) return null;
  return creator;
}

// Ne renvoie que les messages qui ont déclenché un mot-clé de sécurité — pas
// l'historique complet des conversations des créatrices (voir le commentaire
// sur listFlaggedConversations côté DB). C'est volontairement étroit : un
// signal à vérifier, pas une surveillance générale.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "non autorisé" }, { status: 403 });

  const flagged = await listFlaggedConversations();
  return NextResponse.json({ flagged });
}
