import { NextRequest, NextResponse } from "next/server";
import { updateCreatorSlug, SlugTakenError } from "@melii/db";
import { getCurrentCreatorId } from "@/lib/auth";

export async function PUT(req: NextRequest) {
  const creatorId = await getCurrentCreatorId();
  if (!creatorId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
  if (!slug) {
    return NextResponse.json({ error: "Lien requis." }, { status: 400 });
  }

  try {
    const creator = await updateCreatorSlug(creatorId, slug);
    return NextResponse.json({ ok: true, slug: creator.slug });
  } catch (err) {
    if (err instanceof SlugTakenError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    const message = err instanceof Error ? err.message : "Erreur lors de la mise à jour du lien.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
