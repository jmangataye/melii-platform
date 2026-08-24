"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrCreateVisitorId } from "./visitor";

type Status = "checking" | "gate" | "confirming" | "declined" | "ok";

function storageKey(creatorId: string) {
  return `melii_age_ok_${creatorId}`;
}

// Écran de consentement affiché avant le tout premier message d'un
// visiteur. Deux choses distinctes, à ne pas confondre :
//  - le blocage réel se fait ICI, côté interface (rien de la conversation
//    n'est monté avant un clic explicite) ;
//  - l'appel à /api/consent (voir handleConfirm) n'est qu'une preuve
//    horodatée côté serveur, pas un verrou — chat_id est généré côté
//    client, donc falsifiable par construction. Voir schema.js.
export default function AgeGate({
  creatorId,
  displayName,
  avatarUrl,
  accentColor,
  children,
}: {
  creatorId: string;
  displayName: string;
  avatarUrl?: string | null;
  accentColor?: string | null;
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    try {
      const ok = window.localStorage.getItem(storageKey(creatorId));
      setStatus(ok ? "ok" : "gate");
    } catch {
      // localStorage indisponible : on ne peut pas mémoriser le choix d'une
      // visite à l'autre, mais on ne bloque pas — le visiteur reverra
      // l'écran au prochain chargement, ce qui reste acceptable.
      setStatus("gate");
    }
  }, [creatorId]);

  async function handleConfirm() {
    setStatus("confirming");
    try {
      window.localStorage.setItem(storageKey(creatorId), "1");
    } catch {
      // dégradation silencieuse, voir plus haut.
    }
    const chatId = getOrCreateVisitorId(creatorId);
    try {
      await fetch(`/api/consent/${creatorId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chatId }),
      });
    } catch {
      // Best-effort : une trace de consentement non enregistrée (réseau
      // instable) ne doit jamais empêcher le visiteur d'accéder au chat —
      // il a déjà cliqué "j'ai 18 ans ou plus", le blocage a fait son travail.
    }
    setStatus("ok");
  }

  if (status === "ok") return <>{children}</>;

  // "checking" : rien à l'écran plutôt qu'un flash du portail avant que le
  // localStorage confirme qu'il a déjà été franchi.
  if (status === "checking") return null;

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="card glow modal-in p-7 text-center relative overflow-hidden">
          <div
            aria-hidden
            className="absolute -top-24 -right-16 w-56 h-56 rounded-full opacity-20 blur-3xl pointer-events-none"
            style={{
              background: `radial-gradient(circle, ${accentColor || "var(--accent)"}, transparent 70%)`,
            }}
          />

          {status === "declined" ? (
            <div className="relative fade-in-up">
              <p className="text-sm text-muted leading-relaxed">
                Pas de souci — cet espace est réservé aux personnes majeures. Reviens
                quand tu le seras.
              </p>
            </div>
          ) : (
            <div className="relative space-y-5">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL externe fournie par la créatrice
                <img
                  src={avatarUrl}
                  alt=""
                  className="w-16 h-16 rounded-full object-cover mx-auto border border-border"
                />
              ) : (
                <div
                  className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-lg font-semibold text-white"
                  style={{
                    background: accentColor || "linear-gradient(135deg, var(--accent), var(--accent-2))",
                  }}
                >
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}

              <div>
                <p className="text-sm font-medium mb-1.5">Avant de discuter avec {displayName}</p>
                <p className="text-xs text-muted leading-relaxed">
                  Cet espace contient des échanges réservés aux adultes. En continuant,
                  tu confirmes avoir 18 ans ou plus.
                </p>
              </div>

              <button
                onClick={handleConfirm}
                disabled={status === "confirming"}
                className="gradient-btn w-full rounded-full py-2.5 text-sm font-medium text-white disabled:opacity-70"
                style={accentColor ? { background: accentColor } : undefined}
              >
                {status === "confirming" ? "..." : "J'ai 18 ans ou plus"}
              </button>
              <button
                onClick={() => setStatus("declined")}
                className="block w-full text-xs text-muted hover:text-foreground transition"
              >
                Je n&apos;ai pas 18 ans
              </button>

              <p className="text-[11px] text-muted pt-1">
                En continuant, tu acceptes nos{" "}
                <Link href="/terms" className="underline hover:text-foreground" target="_blank">
                  conditions d&apos;utilisation
                </Link>{" "}
                et notre{" "}
                <Link href="/privacy" className="underline hover:text-foreground" target="_blank">
                  politique de confidentialité
                </Link>
                .
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
