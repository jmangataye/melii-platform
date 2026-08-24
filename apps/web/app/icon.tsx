import { ImageResponse } from "next/og";

// Favicon généré au build à partir du dégradé de marque (rose → violet),
// plutôt qu'une image figée — pas besoin d'outil d'édition d'image, et il
// reste cohérent automatiquement si les couleurs de marque changent un jour
// (voir --accent / --accent-2 dans app/globals.css, dupliquées ici car ce
// fichier tourne dans le runtime image de Next, hors du CSS de la page).

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 7,
        }}
      >
        <span
          style={{
            fontFamily: "sans-serif",
            fontSize: 20,
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
