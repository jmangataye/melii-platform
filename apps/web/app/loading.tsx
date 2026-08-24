// Écran de chargement générique affiché par Next.js (React Suspense) pendant
// que le contenu d'une page qui dépend de données serveur (ex. /c/[creatorId])
// finit de charger — voir le commentaire dans globals.css sur .loading-logo.
// Les pages qui ont leur propre état de chargement plus riche (dashboard,
// avec DashboardSkeleton) le gèrent elles-mêmes côté client et ne dépendent
// pas de ce fichier.
export default function Loading() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[50vh]">
      <span className="loading-logo font-semibold tracking-tight text-2xl">
        melii<span className="gradient-text">.</span>
      </span>
    </div>
  );
}
