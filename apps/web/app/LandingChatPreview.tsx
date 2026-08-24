"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "bot" | "user"; text: string };

// Trois mini-scripts, un par ton proposé à l'inscription (voir TONES dans
// app/dashboard/DashboardApp.tsx) — pour donner un vrai aperçu de ce que ça
// donne concrètement avant même de créer un compte, plutôt qu'une capture
// d'écran statique unique.
const SCRIPTS: Record<string, Msg[]> = {
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

const TONE_TABS = [
  { key: "doux_complice", label: "Doux & complice" },
  { key: "direct_vendeur", label: "Direct & vendeur" },
  { key: "joueur_taquin", label: "Joueur & taquin" },
] as const;

/**
 * Aperçu interactif du bot sur la landing page, avant connexion — la
 * visiteuse peut changer de ton et voir l'échange se rejouer avec
 * l'indicateur de frappe animé, exactement comme le vrai chat public
 * (voir app/c/[creatorId]/ChatWidget.tsx pour le même .typing-dot).
 */
export default function LandingChatPreview() {
  const [tone, setTone] = useState<(typeof TONE_TABS)[number]["key"]>("doux_complice");
  const [visibleCount, setVisibleCount] = useState(0);
  const [typing, setTyping] = useState(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    setVisibleCount(0);
    setTyping(false);

    const script = SCRIPTS[tone];
    let delay = 500;
    script.forEach((msg, i) => {
      if (msg.role === "bot") {
        timeoutsRef.current.push(setTimeout(() => setTyping(true), delay));
        delay += 850;
        timeoutsRef.current.push(
          setTimeout(() => {
            setTyping(false);
            setVisibleCount(i + 1);
          }, delay)
        );
        delay += 300;
      } else {
        delay += 500;
        timeoutsRef.current.push(setTimeout(() => setVisibleCount(i + 1), delay));
      }
    });

    return () => {
      timeoutsRef.current.forEach(clearTimeout);
    };
  }, [tone]);

  const script = SCRIPTS[tone];

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

      <div className="card glow p-5">
        <div className="flex items-center gap-2.5 mb-4 pb-4 border-b border-border">
          <div className="w-9 h-9 rounded-full gradient-btn shrink-0" />
          <div>
            <p className="text-sm font-medium">Luna</p>
            <p className="text-xs text-emerald-300 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_1px_rgba(52,211,153,0.6)]" />
              en ligne
            </p>
          </div>
        </div>
        <div className="space-y-2.5 min-h-[230px] flex flex-col justify-end">
          {script.slice(0, visibleCount).map((m, i) => (
            <div
              key={i}
              className={`fade-in-up max-w-[85%] text-sm px-3.5 py-2 rounded-2xl ${
                m.role === "bot"
                  ? "bg-surface-2 rounded-bl-sm"
                  : "ml-auto gradient-btn text-white rounded-br-sm"
              }`}
            >
              {m.text}
            </div>
          ))}
          {typing && (
            <div className="fade-in-up bg-surface-2 rounded-2xl rounded-bl-sm px-3.5 py-2.5 inline-flex gap-1 w-fit">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
