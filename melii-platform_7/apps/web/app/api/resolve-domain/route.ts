import { NextRequest, NextResponse } from "next/server";
import { getCreatorByCustomDomain } from "@melii/db";

// Route interne, appelée uniquement par proxy.ts (voir le commentaire
// là-bas) — le driver PostgreSQL (`pg`) ne peut pas être importé directement
// dans proxy.ts : son bundle webpack échoue à résoudre les modules Node
// internes que `pg-connection-string` charge conditionnellement (`fs`),
// même si Proxy tourne bien sous le runtime Node.js. Faire l'appel DB ici,
// dans une route normale, et laisser proxy.ts se contenter d'un fetch
// interne contourne le problème sans rien perdre côté fonctionnalité.
export async function GET(req: NextRequest) {
  const host = req.nextUrl.searchParams.get("host");
  if (!host) return NextResponse.json({ creatorId: null });

  const creator = await getCreatorByCustomDomain(host);
  return NextResponse.json({ creatorId: creator?.id || null });
}
