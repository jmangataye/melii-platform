import { NextRequest, NextResponse } from "next/server";
import { getCreatorById, getMessageContext } from "@melii/db";
import { getCurrentCreatorId, isAdminEmail } from "@/lib/auth";

async function requireAdmin() {
  const creatorId = await getCurrentCreatorId();
  if (!creatorId) return null;
  const creator = await getCreatorById(creatorId);
  if (!creator || !isAdminEmail(creator.email)) return null;
  return creator;
}

// Contexte autour d'un message signalé — appelé à la demande (bouton "Voir
// le contexte" dans ModerationPanel) plutôt que systématiquement à chaque
// chargement de la liste, pour ne pas alourdir le tableau de modération avec
// des requêtes supplémentaires sur des signalements qu'un admin ne va pas
// forcément tous ouvrir.
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "non autorisé" }, { status: 403 });

  const creatorId = req.nextUrl.searchParams.get("creatorId") || "";
  const chatId = req.nextUrl.searchParams.get("chatId") || "";
  const messageId = req.nextUrl.searchParams.get("messageId") || "";
  if (!creatorId || !chatId || !messageId) {
    return NextResponse.json({ error: "Paramètres manquants." }, { status: 400 });
  }

  const context = await getMessageContext(creatorId, chatId, messageId);
  return NextResponse.json({ context });
}
