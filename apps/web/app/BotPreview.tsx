"use client";

// Carte d'aperçu du bot, animée (indicateur de frappe + apparition
// progressive des messages) — utilisée à trois endroits : la landing page
// (avant connexion, voir LandingChatPreview.tsx), l'onglet Personnalité du
// dashboard (aperçu en direct pendant qu'on règle le ton) et l'onglet Chat en
// ligne (aperçu du persona déjà enregistré). Un seul composant pour ces trois
// usages évite de dupliquer la logique d'animation à chaque fois.

import { useEffect, useRef, useState } from "react";
import { PREVIEW_SCRIPTS, PREVIEW_DEFAULT_TONE } from "./bot-scripts";

export default function BotPreview({
  tone,
  name,
  avatarUrl,
  accentColor,
}: {
  tone: string;
  name: string;
  avatarUrl?: string | null;
  accentColor?: string | null;
}) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [typing, setTyping] = useState(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const script = PREVIEW_SCRIPTS[tone] || PREVIEW_SCRIPTS[PREVIEW_DEFAULT_TONE];
  const validAccent = accentColor && /^#([0-9a-fA-F]{3}){1,2}$/.test(accentColor) ? accentColor : null;

  useEffect(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    setVisibleCount(0);
    setTyping(false);

    let delay = 400;
    script.forEach((msg, i) => {
      if (msg.role === "bot") {
        timeoutsRef.current.push(setTimeout(() => setTyping(true), delay));
        delay += 750;
        timeoutsRef.current.push(
          setTimeout(() => {
            setTyping(false);
            setVisibleCount(i + 1);
          }, delay)
        );
        delay += 250;
      } else {
        delay += 450;
        timeoutsRef.current.push(setTimeout(() => setVisibleCount(i + 1), delay));
      }
    });

    return () => {
      timeoutsRef.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `script` dérive de `tone`, le re-déclencher dessus suffit et évite une nouvelle identité de tableau à chaque render
  }, [tone]);

  const avatarStyle = validAccent ? { background: validAccent } : undefined;
  const bubbleStyle = validAccent ? { background: validAccent } : undefined;

  return (
    <div className="card glow p-5">
      <div className="flex items-center gap-2.5 mb-4 pb-4 border-b border-border">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL externe arbitraire fournie par la créatrice
          <img src={avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
        ) : (
          <div
            className={`w-9 h-9 rounded-full shrink-0 ${validAccent ? "" : "gradient-btn"}`}
            style={avatarStyle}
          />
        )}
        <div>
          <p className="text-sm font-medium">{name || "Votre bot"}</p>
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
                : `ml-auto text-white rounded-br-sm ${validAccent ? "" : "gradient-btn"}`
            }`}
            style={m.role === "user" ? bubbleStyle : undefined}
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
      <p className="text-[11px] text-muted mt-3 text-center">
        Aperçu illustratif — les vraies réponses varient selon la conversation.
      </p>
    </div>
  );
}
