import { NextRequest, NextResponse } from "next/server";
import { listSales, declareSale, getTierById } from "@melii/db";
import { getCurrentCreatorId } from "@/lib/auth";

export async function GET() {
  const creatorId = await getCurrentCreatorId();
  if (!creatorId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ sales: await listSales(creatorId) });
}

export async function POST(req: NextRequest) {
  const creatorId = await getCurrentCreatorId();
  if (!creatorId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const tierId = typeof body?.tierId === "string" ? body.tierId : "";
  const amountEuros = Number(body?.amountEuros);
  const note = typeof body?.note === "string" ? body.note.slice(0, 300) : "";

  const tier = await getTierById(tierId);
  if (!tier || tier.creatorId !== creatorId) {
    return NextResponse.json({ error: "Palier introuvable." }, { status: 404 });
  }
  if (!Number.isFinite(amountEuros) || amountEuros <= 0) {
    return NextResponse.json({ error: "Montant invalide." }, { status: 400 });
  }

  await declareSale({
    creatorId,
    tierId,
    amountCents: Math.round(amountEuros * 100),
    currency: "EUR",
    note,
  });

  return NextResponse.json({ ok: true });
}
