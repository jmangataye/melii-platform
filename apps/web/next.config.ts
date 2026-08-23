import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @melii/db (et son client PostgreSQL "pg") n'ont pas besoin d'être
  // passés par le bundler : ce sont des dépendances serveur pures.
  serverExternalPackages: ["@melii/db", "pg"],
};

export default nextConfig;
