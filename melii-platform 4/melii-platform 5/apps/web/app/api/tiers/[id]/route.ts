import { NextResponse } from "next/server";
import { deleteTier } from "@melii/db";
import { getCurrentCreatorId } from "@/lib/auth";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const creatorId = await getCurrentCreatorId();
  if (!creatorId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  await deleteTier(creatorId, id);
  return NextResponse.json({ ok: true });
}
