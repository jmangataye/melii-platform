import { NextResponse } from "next/server";
import { listTiers, logClick } from "@melii/db";

// Format du code : "{creatorId}-{order}". creatorId est un UUID (contient
// des tirets), donc on coupe sur le DERNIER tiret plutôt que le premier.
function parseCode(code: string): { creatorId: string; order: number } | null {
  const idx = code.lastIndexOf("-");
  if (idx === -1) return null;
  const creatorId = code.slice(0, idx);
  const order = Number(code.slice(idx + 1));
  if (!creatorId || !Number.isInteger(order)) return null;
  return { creatorId, order };
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ code: string }> }
) {
  const { code } = await ctx.params;
  const parsed = parseCode(code);
  if (!parsed) {
    return NextResponse.json({ error: "Lien invalide." }, { status: 404 });
  }

  const tiers = await listTiers(parsed.creatorId);
  const tier = tiers.find((t) => t.order === parsed.order);
  if (!tier) {
    return NextResponse.json({ error: "Lien introuvable." }, { status: 404 });
  }

  const url = new URL(req.url);
  const telegramChatId = url.searchParams.get("chat") || undefined;

  await logClick({ creatorId: parsed.creatorId, tierId: tier.id, telegramChatId });

  return NextResponse.redirect(tier.url, { status: 302 });
}
