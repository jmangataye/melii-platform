import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCreatorBySlugOrId, logLinkVisit } from "@melii/db";
import ChatWidget from "./ChatWidget";
import AgeGate from "./AgeGate";

// Sans ce generateMetadata, la page héritait du titre/description par défaut
// du layout racine ("Melii — bots IA pour créatrices" / "...un chatbot IA à
// votre image...") — visible dans l'onglet du navigateur ET dans l'aperçu de
// lien quand ce lien est collé sur Telegram/Instagram/etc., AVANT même que la
// personne ait cliqué. Ça grillait tout le soin mis à ne jamais exposer le
// mot "bot" une fois dans la conversation. Ici, le titre/l'aperçu sont
// personnalisés par créatrice et ne mentionnent jamais "bot"/"chatbot".
export async function generateMetadata({
  params,
}: {
  params: Promise<{ creatorId: string }>;
}): Promise<Metadata> {
  const { creatorId } = await params;
  const creator = await getCreatorBySlugOrId(creatorId);
  if (!creator) return {};

  const title = creator.displayName;
  const description = `Discute avec ${creator.displayName}.`;

  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

// Le "?src=" est du texte libre saisi par la créatrice (voir le générateur
// de liens tagués dans l'onglet Chat en ligne du dashboard) — on le borne et
// on le nettoie ici plutôt que de faire confiance à ce qui arrive dans
// l'URL, avant de l'enregistrer en base (voir logLinkVisit).
function sanitizeSource(raw: string | undefined): string {
  if (!raw) return "direct";
  const cleaned = raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  return cleaned || "direct";
}

// Page publique : c'est le lien que chaque créatrice partage (bio Instagram,
// Linktree, etc.) pour que sa communauté discute directement avec son bot,
// sans passer par Telegram. Pas d'inscription requise côté visiteur.
// `creatorId` dans l'URL peut être un slug lisible ("luna") ou, pour les
// anciens liens déjà partagés avant l'introduction des slugs, un id brut —
// getCreatorBySlugOrId résout les deux sans jamais casser un lien existant.
export default async function PublicChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ creatorId: string }>;
  searchParams: Promise<{ src?: string }>;
}) {
  const { creatorId } = await params;
  const { src } = await searchParams;
  const creator = await getCreatorBySlugOrId(creatorId);

  if (!creator) {
    notFound();
  }

  // Best-effort : une visite non comptabilisée (erreur DB transitoire) ne
  // doit jamais empêcher la page de chat de s'afficher — c'est une métrique
  // secondaire, pas une dépendance dure du parcours visiteur.
  logLinkVisit({ creatorId: creator.id, source: sanitizeSource(src) }).catch((err) => {
    console.error(`[${creator.displayName}] échec de l'enregistrement de la visite:`, err);
  });

  return (
    <main className="flex-1 flex flex-col">
      <header className="border-b border-border">
        <div className="mx-auto max-w-2xl px-6 py-5 flex items-center gap-3">
          {creator.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- URL externe arbitraire fournie par la créatrice, pas un asset local optimisable par next/image
            <img
              src={creator.avatarUrl}
              alt=""
              className="w-9 h-9 rounded-full object-cover border border-border shrink-0"
            />
          )}
          <span className="font-semibold tracking-tight">
            melii<span className="gradient-text">.</span>{" "}
            <span className="text-muted font-normal">/ {creator.displayName}</span>
          </span>
        </div>
      </header>

      {creator.galleryUrls.length > 0 && (
        <div className="border-b border-border bg-surface-2/30">
          <div className="mx-auto max-w-2xl px-4 py-3 flex gap-2 overflow-x-auto">
            {creator.galleryUrls.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element -- URLs externes fournies par la créatrice
              <img
                key={url + i}
                src={url}
                alt=""
                className="w-16 h-16 rounded-lg object-cover border border-border shrink-0"
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 mx-auto max-w-2xl w-full px-4 py-6 flex flex-col">
        <AgeGate
          creatorId={creator.id}
          displayName={creator.displayName}
          avatarUrl={creator.avatarUrl}
          accentColor={creator.accentColor}
        >
          <ChatWidget
            creatorId={creator.id}
            displayName={creator.displayName}
            accentColor={creator.accentColor}
          />
        </AgeGate>
      </div>
    </main>
  );
}
