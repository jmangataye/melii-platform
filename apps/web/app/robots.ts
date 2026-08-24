import type { MetadataRoute } from "next";

const SITE_URL = "https://melii-foor.onrender.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Dashboard/admin sont derrière une session — inutile et non
      // souhaitable de laisser un crawler tenter de les indexer. Les pages
      // de chat publiques par créatrice ne sont pas de bons résultats de
      // recherche génériques non plus (contenu très répétitif d'une
      // créatrice à l'autre) donc on les exclut aussi.
      disallow: ["/dashboard", "/admin", "/api", "/c/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
