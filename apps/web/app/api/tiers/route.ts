import { NextRequest, NextResponse } from "next/server";
import { listTiers, upsertTier } from "@melii/db";
import { getCurrentCreatorId } from "@/lib/auth";

export async function GET() {
  const creatorId = await getCurrentCreatorId();
  if (!creatorId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ tiers: await listTiers(creatorId) });
}

export async function POST(req: NextRequest) {
  const creatorId = await getCurrentCreatorId();
  if (!creatorId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const order = Number(body?.order);
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  const priceEuros = Number(body?.priceEuros);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  // Optionnel : si absent du corps (ex. réordonnancement, qui ne renvoie pas
  // ce champ), upsertTier conserve la valeur déjà enregistrée plutôt que de
  // l'effacer — voir le commentaire dans packages/db/index.js.
  const sellAngle =
    typeof body?.sellAngle === "string" ? body.sellAngle.trim().slice(0, 400) : undefined;

  if (!Number.isInteger(order) || order < 1) {
    return NextResponse.json({ error: "Numéro de palier invalide." }, { status: 400 });
  }
  if (!label) {
    return NextResponse.json({ error: "Le libellé est requis." }, { status: 400 });
  }
  if (!Number.isFinite(priceEuros) || priceEuros <= 0) {
    return NextResponse.json({ error: "Prix invalide." }, { status: 400 });
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error("bad protocol");
  } catch {
    return NextResponse.json({ error: "Lien de paiement invalide." }, { status: 400 });
  }

  const tier = await upsertTier(creatorId, {
    order,
    label,
    priceCents: Math.round(priceEuros * 100),
    currency: "EUR",
    url: parsedUrl.toString(),
    sellAngle,
  });

  return NextResponse.json({ tier });
}
