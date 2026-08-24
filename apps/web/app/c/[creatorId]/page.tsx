import { notFound } from "next/navigation";
import { getCreatorBySlugOrId } from "@melii/db";
import ChatWidget from "./ChatWidget";

// Page publique : c'est le lien que chaque créatrice partage (bio Instagram,
// Linktree, etc.) pour que sa communauté discute directement avec son bot,
// sans passer par Telegram. Pas d'inscription requise côté visiteur.
// `creatorId` dans l'URL peut être un slug lisible ("luna") ou, pour les
// anciens liens déjà partagés avant l'introduction des slugs, un id brut —
// getCreatorBySlugOrId résout les deux sans jamais casser un lien existant.
export default async function PublicChatPage({
  params,
}: {
  params: Promise<{ creatorId: string }>;
}) {
  const { creatorId } = await params;
  const creator = await getCreatorBySlugOrId(creatorId);

  if (!creator) {
    notFound();
  }

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
        <ChatWidget
          creatorId={creator.id}
          displayName={creator.displayName}
          accentColor={creator.accentColor}
        />
      </div>
    </main>
  );
}
