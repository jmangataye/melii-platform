import { NextRequest, NextResponse } from "next/server";
import { updateCreatorPersona } from "@melii/db";
import { VALID_LANGUAGES } from "@melii/db/persona";
import { getCurrentCreatorId } from "@/lib/auth";

const VALID_TONES = ["doux_complice", "direct_vendeur", "joueur_taquin"];

export async function PUT(req: NextRequest) {
  const creatorId = await getCurrentCreatorId();
  if (!creatorId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const tone = typeof body?.tone === "string" ? body.tone : "";
  const bio = typeof body?.bio === "string" ? body.bio.slice(0, 800) : "";
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
  // Optionnel dans le body : un client qui n'envoie pas encore ce champ (ex.
  // ancien build en cache côté navigateur) ne doit pas se voir imposer 'fr'
  // silencieusement — updateCreatorPersona conserve la langue déjà en base
  // dans ce cas (voir index.js).
  const rawLanguage = typeof body?.language === "string" ? body.language : undefined;
  if (rawLanguage !== undefined && !VALID_LANGUAGES.includes(rawLanguage)) {
    return NextResponse.json({ error: "Langue invalide." }, { status: 400 });
  }

  if (!VALID_TONES.includes(tone)) {
    return NextResponse.json({ error: "Ton invalide." }, { status: 400 });
  }
  if (!displayName) {
    return NextResponse.json({ error: "Le prénom affiché est requis." }, { status: 400 });
  }

  const creator = await updateCreatorPersona(creatorId, { tone, bio, displayName, language: rawLanguage });
  return NextResponse.json({
    ok: true,
    creator: {
      id: creator.id,
      displayName: creator.displayName,
      personaTone: creator.personaTone,
      personaBio: creator.personaBio,
      personaLanguage: creator.personaLanguage,
    },
  });
}
