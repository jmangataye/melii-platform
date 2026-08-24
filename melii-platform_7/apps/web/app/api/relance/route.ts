import { NextRequest, NextResponse } from "next/server";
import { updateCreatorRelance } from "@melii/db";
import { getCurrentCreatorId } from "@/lib/auth";

export async function PUT(req: NextRequest) {
  const creatorId = await getCurrentCreatorId();
  if (!creatorId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const enabled = body?.enabled === true;

  const creator = await updateCreatorRelance(creatorId, enabled);
  return NextResponse.json({ ok: true, relanceEnabled: creator.relanceEnabled });
}
