import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @melii/db (et son client PostgreSQL "pg") n'ont pas besoin d'être
  // passés par le bundler : ce sont des dépendances serveur pures.
  serverExternalPackages: ["@melii/db", "pg"],

  async headers() {
    return [
      {
        // Toutes les routes : en-têtes de sécurité de base. Pas de CSP ici
        // volontairement — Next.js a besoin d'injecter des scripts/styles
        // inline au runtime, et une CSP mal calibrée casserait
        // silencieusement l'app plutôt que d'apporter une vraie protection
        // supplémentaire tant qu'elle n'est pas testée avec des nonces.
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
