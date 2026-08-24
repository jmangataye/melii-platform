import { NextResponse } from "next/server";
import { getCreatorById, recordAgeConsent } from "@melii/db";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

// Route publique (pas d'authentification), appelée une seule fois par
// AgeGate.tsx quand un visiteur confirme avoir 18 ans ou plus, avant son
// premier message. Ce n'est PAS un verrou de sécurité — chat_id est généré
// côté client et donc falsifiable — c'est un horodatage de preuve (voir le
// commentaire sur la table age_consents dans packages/db/schema.js). Le
// blocage réel du chat se fait côté interface, dans AgeGate lui-même.
export async function POST(req: Request, ctx: { params: Promise<{ creatorId: string }> }) {
  const { creatorId } = await ctx.params;

  const ip = clientIp(req);
  if (!checkRateLimit(`consent-ip:${ip}`, { limit: 20, windowMs: 60 * 1000 })) {
    return NextResponse.json({ error: "trop de requêtes" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const chatId = typeof body?.chatId === "string" ? body.chatId.slice(0, 200) : null;
  if (!chatId) {
    return NextResponse.json({ error: "chatId requis" }, { status: 400 });
  }

  const creator = await getCreatorById(creatorId);
  if (!creator) {
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }

  await recordAgeConsent(creator.id, chatId);
  return NextResponse.json({ ok: true });
}
