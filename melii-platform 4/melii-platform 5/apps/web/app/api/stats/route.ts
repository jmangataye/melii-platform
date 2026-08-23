import { NextResponse } from "next/server";
import { getStats, listTiers } from "@melii/db";
import { getCurrentCreatorId } from "@/lib/auth";

export async function GET() {
  const creatorId = await getCurrentCreatorId();
  if (!creatorId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  return NextResponse.json({
    stats: await getStats(creatorId),
    tiers: await listTiers(creatorId),
  });
}
