"use client";

// Accordéon de FAQ pour la landing page — questions qui reviennent le plus
// souvent avant inscription (prix, technique, Telegram, paiements, sécurité).
// Composant client isolé (page.tsx reste un composant serveur) car il n'a
// besoin que d'un état d'ouverture local, sans dépendance réseau.

import { useState } from "react";

const FAQ_ITEMS = [
  {
    q: "Combien ça coûte ?",
    a: "Aucun abonnement fixe. Melii se rémunère uniquement à la commission sur les ventes que vous déclarez (15 % par défaut), réductible jusqu'à -5 points grâce au parrainage entre créatrices. Pas de vente, pas de frais.",
  },
  {
    q: "Ai-je besoin de compétences techniques ?",
    a: "Non. La configuration se fait en quelques clics depuis votre tableau de bord — ton du bot, bio, paliers de liens. Aucune installation, aucun code.",
  },
  {
    q: "Telegram est-il obligatoire ?",
    a: "Non. Votre chat en ligne (un simple lien à partager) fonctionne immédiatement, sans rien connecter. Telegram reste une option en plus, si vous voulez aussi être jointe depuis l'app.",
  },
  {
    q: "Qui gère mes paiements ?",
    a: "Vous gardez vos liens de paiement habituels (Dropfans ou autre). Melii ne touche jamais à vos fonds ni à vos moyens de paiement — le bot se contente de guider vers vos liens.",
  },
  {
    q: "Le bot peut-il envoyer du contenu explicite ?",
    a: "Non. Deux règles de sécurité restent toujours actives, quel que soit le ton choisi : le bot reste honnête si on lui demande sincèrement s'il s'agit d'une IA, et ne génère jamais de contenu explicite dans la conversation.",
  },
  {
    q: "Puis-je changer le ton ou les paliers plus tard ?",
    a: "Oui, à tout moment depuis votre tableau de bord — le bot applique les changements immédiatement, sans interruption pour votre communauté.",
  },
];

export default function LandingFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-3 max-w-2xl mx-auto">
      {FAQ_ITEMS.map((item, i) => {
        const open = openIndex === i;
        return (
          <div key={item.q} className="card overflow-hidden">
            <button
              onClick={() => setOpenIndex(open ? null : i)}
              className="w-full flex items-center justify-between gap-4 text-left px-5 py-4"
              aria-expanded={open}
            >
              <span className="text-sm font-medium">{item.q}</span>
              <span className={`text-muted shrink-0 transition-transform ${open ? "rotate-45" : ""}`} aria-hidden="true">
                +
              </span>
            </button>
            {open && (
              <div className="px-5 pb-4 -mt-1">
                <p className="text-sm text-muted leading-relaxed">{item.a}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
