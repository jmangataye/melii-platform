import { ImageResponse } from "next/og";

// Image affichée quand un lien vers le site est partagé (Telegram, Twitter/X,
// iMessage, Discord...). Générée au build à partir du même dégradé de marque
// que le reste du site plutôt qu'une capture d'écran figée à refaire à
// chaque changement de design.

export const alt = "Melii — bots IA pour créatrices";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
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
        {/* Superposition de couches flex normales plutôt que du positionnement
            absolu : la version de Satori embarquée par next/og ici n'a pas
            rendu les enfants "position: absolute" (testé — le raccourci CSS
            "inset" et les décalages top/left/right/bottom sur des éléments
            absolus produisaient un rendu identique à leur absence). Un flux
            normal reste simple et garanti de s'afficher. */}
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
              fontSize: 56,
              fontWeight: 700,
              color: "#f4f4f6",
              fontFamily: "sans-serif",
            }}
          >
            melii<span style={{ color: "#ff4d8d" }}>.</span>
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 28,
              fontSize: 34,
              fontWeight: 600,
              color: "#f4f4f6",
              fontFamily: "sans-serif",
              textAlign: "center",
              maxWidth: 900,
            }}
          >
            Un bot IA à votre image, qui vend votre contenu palier par palier
          </div>
        </div>
        <div
          style={{
            display: "flex",
            width: "100%",
            height: 10,
            background: "linear-gradient(90deg, #ff4d8d, #7c5cff)",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
