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

  // galleryUrls est optionnel dans le body : absent = on ne touche pas à la
  // galerie existante (voir le commentaire sur updateCreatorProfile côté DB),
  // tableau vide = on la vide vraiment.
  let galleryUrls: string[] | undefined = undefined;
  if (Array.isArray(body?.galleryUrls)) {
    const cleaned: string[] = [];
    for (const raw of body.galleryUrls) {
      if (typeof raw !== "string" || !raw.trim()) continue;
      try {
        const parsed = new URL(raw.trim());
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("bad protocol");
        cleaned.push(parsed.toString());
      } catch {
        return NextResponse.json({ error: "Une des URLs de la galerie est invalide." }, { status: 400 });
      }
    }
    if (cleaned.length > 8) {
      return NextResponse.json({ error: "8 photos maximum dans la galerie." }, { status: 400 });
    }
    galleryUrls = cleaned;
  }

  const creator = await updateCreatorProfile(creatorId, { avatarUrl, accentColor, galleryUrls });
  if (!creator) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  return NextResponse.json({
    ok: true,
    creator: {
      id: creator.id,
      avatarUrl: creator.avatarUrl,
      accentColor: creator.accentColor,
      galleryUrls: creator.galleryUrls,
    },
  });
}
