import { ImageResponse } from "next/og";

// Icône affichée sur l'écran d'accueil iOS quand quelqu'un ajoute le site —
// même logique que icon.tsx, juste plus grande et sans coins arrondis (iOS
// applique déjà son propre masque arrondi automatiquement).

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #ff4d8d, #7c5cff)",
        }}
      >
        <span
          style={{
            fontFamily: "sans-serif",
            fontSize: 108,
            fontWeight: 700,
            color: "#0a0a0f",
          }}
        >
          m
        </span>
      </div>
    ),
    { ...size }
  );
}
