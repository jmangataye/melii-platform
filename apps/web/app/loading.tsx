"use client";

// Écran de chargement générique affiché par Next.js (React Suspense) pendant
// que le contenu d'une page qui dépend de données serveur (ex. /c/[creatorId])
// finit de charger — voir le commentaire dans globals.css sur .loading-logo.
// Les pages qui ont leur propre état de chargement plus riche (dashboard,
// avec DashboardSkeleton) le gèrent elles-mêmes côté client et ne dépendent
// pas de ce fichier.
//
// Le service tourne sur le plan gratuit de Render, qui se met en veille
// après une période d'inactivité : la toute première requête après une
// veille peut prendre 30 à 60 secondes avant que quoi que ce soit ne
// s'affiche. Rien de côté client ne peut intercepter ce délai initial (le
// process n'écoute même pas encore), mais une fois que ce fallback est
// monté et reste affiché plus de quelques secondes, on peut au moins
// rassurer plutôt que laisser un logo figé sans explication.
import { useEffect, useState } from "react";

export default function Loading() {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] gap-3 px-6 text-center">
      <span className="loading-logo font-semibold tracking-tight text-2xl">
        melii<span className="gradient-text">.</span>
      </span>
      {slow && (
        <p className="fade-in-up text-sm text-muted max-w-xs">
          Ça prend un peu plus longtemps que d&apos;habitude — le service se
          réveille après une période d&apos;inactivité, ça ne devrait plus être long.
        </p>
      )}
    </div>
  );
}
