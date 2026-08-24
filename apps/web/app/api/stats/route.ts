import { NextRequest, NextResponse } from "next/server";
import { getStats, listTiers } from "@melii/db";
import { getCurrentCreatorId } from "@/lib/auth";

const ALLOWED_WINDOWS = [7, 30, 90];

export async function GET(req: NextRequest) {
  const creatorId = await getCurrentCreatorId();
  if (!creatorId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Sélecteur de période côté onglet Statistiques — on ne fait confiance
  // qu'à un ensemble restreint de valeurs plutôt qu'à un nombre arbitraire
  // fourni par le client, pour éviter une requête coûteuse sur une fenêtre
  // absurde (ex. ?days=999999999).
  const rawDays = Number(req.nextUrl.searchParams.get("days"));
  const days = ALLOWED_WINDOWS.includes(rawDays) ? rawDays : 14;

  return NextResponse.json({
    stats: await getStats(creatorId, days),
    tiers: await listTiers(creatorId),
  });
}
