import { NextResponse } from "next/server";
import { deleteCreator, getCreatorById } from "@melii/db";
import { getCurrentCreatorId, isAdminEmail } from "@/lib/auth";

async function requireAdmin() {
  const creatorId = await getCurrentCreatorId();
  if (!creatorId) return null;
  const creator = await getCreatorById(creatorId);
  if (!creator || !isAdminEmail(creator.email)) return null;
  return creator;
}

// Suppression définitive d'un compte créatrice (données, paliers, ventes,
// messages — tout part avec, voir deleteCreator dans @melii/db). Réservé à
// l'admin, utilisé pour honorer une demande de suppression de données (voir
// /privacy §5). Pas de "corbeille" ni d'annulation possible après coup.
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "non autorisé" }, { status: 403 });
  }

  const { id: targetId } = await ctx.params;

  if (targetId === admin.id) {
    return NextResponse.json(
      { error: "Vous ne pouvez pas supprimer votre propre compte admin depuis cet écran." },
      { status: 400 }
    );
  }

  const deleted = await deleteCreator(targetId);
  if (!deleted) {
    return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
