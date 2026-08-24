"use client";

// Petits composants d'interface partagés entre le dashboard et l'admin —
// centralisés ici pour que toutes les actions (enregistrer, supprimer,
// copier un lien...) donnent le même type de retour visuel plutôt que
// chaque onglet invente sa propre variante.

import { createContext, useCallback, useContext, useRef, useState } from "react";

// --- Toasts ---------------------------------------------------------------
// Notification éphémère en bas de l'écran pour confirmer qu'une action a
// bien eu lieu (palier ajouté, domaine enregistré...). Avant ça, la plupart
// des actions se contentaient de rafraîchir l'état en silence — un clic sans
// retour visuel laisse toujours un doute sur "est-ce que ça a marché ?".

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; kind: ToastKind; message: string };

const ToastContext = createContext<((message: string, kind?: ToastKind) => void) | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const push = useCallback((message: string, kind: ToastKind = "success") => {
    const id = nextId.current++;
    setToasts((cur) => [...cur, { id, kind, message }]);
    setTimeout(() => {
      setToasts((cur) => cur.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fixed bottom-4 inset-x-0 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none sm:items-end sm:right-4 sm:inset-x-auto sm:left-auto">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`toast-in pointer-events-auto max-w-sm w-full sm:w-auto rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur ${
              t.kind === "success"
                ? "bg-[var(--success-bg)] border-[var(--success)]/30 text-[var(--success)]"
                : t.kind === "error"
                  ? "bg-[var(--danger-bg)] border-[var(--danger)]/30 text-[var(--danger)]"
                  : "bg-surface-2 border-border text-foreground"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Hook d'usage : const toast = useToast(); toast("Palier ajouté"); */
export function useToast() {
  const push = useContext(ToastContext);
  // Si jamais utilisé hors provider (ne devrait pas arriver), on retombe sur
  // un no-op plutôt que de planter tout l'écran pour une notification ratée.
  return push || (() => {});
}

// --- Confirmation modale ----------------------------------------------------
// Pour toute action destructive (supprimer un palier, un compte...). Avant
// ça, "Supprimer" agissait immédiatement au clic — un mis-clic ou un clic
// accidentel sur mobile n'avait aucun filet de sécurité.

export function useConfirm() {
  const [state, setState] = useState<{
    message: string;
    detail?: string;
    resolve: (ok: boolean) => void;
  } | null>(null);

  const confirm = useCallback((message: string, detail?: string) => {
    return new Promise<boolean>((resolve) => {
      setState({ message, detail, resolve });
    });
  }, []);

  function respond(ok: boolean) {
    state?.resolve(ok);
    setState(null);
  }

  const modal = state ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="modal-in card glow max-w-sm w-full p-6 space-y-4">
        <p id="confirm-modal-title" className="text-sm font-medium">
          {state.message}
        </p>
        {state.detail && <p className="text-sm text-muted">{state.detail}</p>}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={() => respond(false)}
            className="text-sm text-muted hover:text-foreground transition"
          >
            Annuler
          </button>
          <button
            onClick={() => respond(true)}
            className="rounded-full px-5 py-2 text-sm font-medium bg-[var(--danger)] text-black hover:brightness-95 transition"
          >
            Confirmer
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, modal };
}

// --- Bouton copier avec retour visuel --------------------------------------

export function CopyButton({ value, className = "" }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // presse-papiers indisponible : rien à faire, le champ reste sélectionnable.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={
        className ||
        "gradient-btn rounded-full px-5 py-2.5 text-sm font-medium text-white shrink-0"
      }
    >
      {copied ? "Copié !" : "Copier"}
    </button>
  );
}

// --- Pastille de statut -----------------------------------------------------

export function StatusPill({
  tone,
  children,
}: {
  tone: "success" | "warning" | "danger" | "neutral";
  children: React.ReactNode;
}) {
  const styles =
    tone === "success"
      ? "bg-[var(--success-bg)] text-[var(--success)]"
      : tone === "warning"
        ? "bg-[var(--warning-bg)] text-[var(--warning)]"
        : tone === "danger"
          ? "bg-[var(--danger-bg)] text-[var(--danger)]"
          : "bg-surface-2 text-muted";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${styles}`}>
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          tone === "success"
            ? "bg-[var(--success)]"
            : tone === "warning"
              ? "bg-[var(--warning)]"
              : tone === "danger"
                ? "bg-[var(--danger)]"
                : "bg-muted"
        }`}
      />
      {children}
    </span>
  );
}

// --- État vide réutilisable -------------------------------------------------

export function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border p-8 text-center">
      <div className="text-2xl mb-2 opacity-70">{icon}</div>
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="text-xs text-muted mt-1 max-w-xs mx-auto">{hint}</p>}
    </div>
  );
}
