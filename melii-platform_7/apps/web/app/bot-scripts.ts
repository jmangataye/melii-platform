// Mini-scripts de démonstration, un par ton disponible — partagés entre
// l'aperçu de la landing page (avant connexion) et les aperçus en direct du
// dashboard (onglets Chat en ligne / Personnalité), pour ne pas dupliquer ces
// textes à plusieurs endroits.

export type PreviewMsg = { role: "bot" | "user"; text: string };

export const PREVIEW_SCRIPTS: Record<string, PreviewMsg[]> = {
  doux_complice: [
    { role: "bot", text: "Hey toi 😊 contente que tu sois là, tu viens d'où ?" },
    { role: "user", text: "Instagram ! Je te suis depuis un moment" },
    { role: "bot", text: "Aww trop mignon 🥰 j'ai posté un truc que tu vas adorer aujourd'hui... je te montre ?" },
    { role: "user", text: "Oui carrément !" },
    { role: "bot", text: "Voilà, en douceur 💕 → Palier 1 — Photos exclusives (5 €)" },
  ],
  direct_vendeur: [
    { role: "bot", text: "Salut ! Prête à voir ce que j'ai de nouveau pour toi ?" },
    { role: "user", text: "Vas-y, montre-moi" },
    { role: "bot", text: "Palier 1 — Photos exclusives, 5 €. Direct au but 😏" },
    { role: "user", text: "Et ensuite ?" },
    { role: "bot", text: "Palier 2 débloque encore plus — on y va quand tu veux." },
  ],
  joueur_taquin: [
    { role: "bot", text: "Devine ce que j'ai fait aujourd'hui... 😏" },
    { role: "user", text: "Aucune idée, dis-moi !" },
    { role: "bot", text: "Mmh non, faut le mériter 😈 clique et tu sauras" },
    { role: "user", text: "T'es impossible 😂" },
    { role: "bot", text: "Je sais 😘 → Palier 1 juste ici" },
  ],
};

export const PREVIEW_DEFAULT_TONE = "doux_complice";
