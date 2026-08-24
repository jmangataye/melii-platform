"use client";

import { useState } from "react";
import BotPreview from "./BotPreview";
import { PREVIEW_DEFAULT_TONE } from "./bot-scripts";

const TONE_TABS = [
  { key: "doux_complice", label: "Doux & complice" },
  { key: "direct_vendeur", label: "Direct & vendeur" },
  { key: "joueur_taquin", label: "Joueur & taquin" },
] as const;

/**
 * Aperçu interactif du bot sur la landing page, avant connexion — la
 * visiteuse peut changer de ton et voir l'échange se rejouer avec
 * l'indicateur de frappe animé, exactement comme le vrai chat public
 * (voir app/c/[creatorId]/ChatWidget.tsx pour le même .typing-dot). La carte
 * elle-même (animation, bulles) vit dans BotPreview.tsx, partagée avec les
 * aperçus en direct du dashboard.
 */
export default function LandingChatPreview() {
  const [tone, setTone] = useState<(typeof TONE_TABS)[number]["key"]>(PREVIEW_DEFAULT_TONE);

  return (
    <div className="w-full max-w-sm mx-auto lg:mx-0">
      <div className="flex gap-2 mb-4 justify-center lg:justify-start flex-wrap">
        {TONE_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTone(t.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium border transition ${
              tone === t.key
                ? "border-accent text-foreground bg-surface-2"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <BotPreview tone={tone} name="Luna" />
    </div>
  );
}
