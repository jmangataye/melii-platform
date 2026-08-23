import { NextRequest, NextResponse } from "next/server";
import { updateCreatorProfile } from "@melii/db";
import { getCurrentCreatorId } from "@/lib/auth";

// Couleurs hexadécimales à 3 ou 6 chiffres seulement (#f4a, #ff44aa) — pas
// de noms CSS ni de fonctions (rgb(), var(), etc.) pour éviter d'injecter
// n'importe quoi dans un attribut style rendu côté client.
const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export async function PUT(req: NextRequest) {
  const creatorId = await getCurrentCreatorId();
  if (!creatorId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const avatarUrlRaw = typeof body?.avatarUrl === "string" ? body.avatarUrl.trim() : "";
  const accentColorRaw = typeof body?.accentColor === "string" ? body.accentColor.trim() : "";

  let avatarUrl: string | null = null;
  if (avatarUrlRaw) {
    try {
      const parsed = new URL(avatarUrlRaw);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("bad protocol");
      avatarUrl = parsed.toString();
    } catch {
      return NextResponse.json({ error: "URL de photo invalide." }, { status: 400 });
    }
  }

  let accentColor: string | null = null;
  if (accentColorRaw) {
    if (!HEX_COLOR.test(accentColorRaw)) {
      return NextResponse.json(
        { error: "Couleur invalide (format attendu : #ff4d8d)." },
        { status: 400 }
      );
    }
    accentColor = accentColorRaw;
  }

  const creator = await updateCreatorProfile(creatorId, { avatarUrl, accentColor });
  return NextResponse.json({
    ok: true,
    creator: {
      id: creator.id,
      avatarUrl: creator.avatarUrl,
      accentColor: creator.accentColor,
    },
  });
}
