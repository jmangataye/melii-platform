import { ImageResponse } from "next/og";
import { getCreatorBySlugOrId } from "@melii/db";

// Surcharge l'image générique de app/opengraph-image.tsx ("Un bot IA à votre
// image...") pour ce segment de route précis : sans ce fichier, un lien
// /c/[creatorId] partagé sur Telegram/Instagram afficherait l'image
// générique du produit — qui mentionne "bot" en toutes lettres — avant même
// que la personne clique. Ici, l'image est personnalisée par créatrice (son
// prénom, sa couleur d'accent si définie) et ne mentionne jamais "bot".

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ creatorId: string }>;
}) {
  const { creatorId } = await params;
  const creator = await getCreatorBySlugOrId(creatorId);
  const name = creator?.displayName || "Melii";
  const accent = creator?.accentColor && /^#[0-9a-fA-F]{6}$/.test(creator.accentColor)
    ? creator.accentColor
    : "#ff4d8d";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(155deg, #1a0f1a 0%, #0a0a0f 45%, #120f1f 100%)",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 64,
              fontWeight: 700,
              color: "#f4f4f6",
              fontFamily: "sans-serif",
              textAlign: "center",
              maxWidth: 1000,
            }}
          >
            {name}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 20,
              fontSize: 28,
              fontWeight: 500,
              color: "#a0a0ac",
              fontFamily: "sans-serif",
            }}
          >
            Discute avec moi
          </div>
        </div>
        <div
          style={{
            display: "flex",
            width: "100%",
            height: 10,
            background: `linear-gradient(90deg, ${accent}, #7c5cff)`,
          }}
        />
      </div>
    ),
    { ...size }
  );
}
