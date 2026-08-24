"use client";

// Barre d'action collante en bas d'écran, mobile uniquement — apparaît une
// fois que le bouton "Créer mon bot" du hero sort du viewport, pour que
// l'appel à l'action reste toujours accessible pendant que quelqu'un
// parcourt la page sur son téléphone (là où on scrolle beaucoup plus avant
// de remonter en haut que sur desktop).

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export default function StickyMobileCTA({ heroCtaId }: { heroCtaId: string }) {
  const [visible, setVisible] = useState(false);
  const observedRef = useRef<Element | null>(null);

  useEffect(() => {
    const target = document.getElementById(heroCtaId);
    if (!target) return;
    observedRef.current = target;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { rootMargin: "0px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [heroCtaId]);

  return (
    <div
      className={`sm:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur px-4 py-3 transition-transform duration-200 ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <Link
        href="/signup"
        className="gradient-btn rounded-full px-6 py-3 font-medium text-white text-center block shadow-lg shadow-accent/20"
      >
        Créer mon bot
      </Link>
    </div>
  );
}
