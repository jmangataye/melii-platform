import { NextRequest, NextResponse } from "next/server";
import { listFanProfiles } from "@melii/db";
import { getCurrentCreatorId } from "@/lib/auth";

// Alimente l'onglet "Fans" du dashboard (mémoire légère par fan / CRM
// minimal) — voir listFanProfiles dans packages/db/index.js pour le détail
// de la jointure entre l'historique de conversation et les notes IA.
export async function GET(req: NextRequest) {
  const creatorId = await getCurrentCreatorId();
  if (!creatorId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rawLimit = Number(req.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 && rawLimit <= 200 ? rawLimit : 100;

  return NextResponse.json({ fans: await listFanProfiles(creatorId, limit) });
}
