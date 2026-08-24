"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Code de parrainage capturé depuis ?ref=CODE dans l'URL (lien partagé par
  // une créatrice — voir l'onglet Compte du dashboard). Lu directement sur
  // window.location plutôt que via useSearchParams, pour ne pas avoir à
  // envelopper toute la page dans un Suspense juste pour ça.
  const [referralCode, setReferralCode] = useState<string | null>(null);

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) setReferralCode(ref);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!ageConfirmed) {
      setError("Vous devez confirmer avoir 18 ans ou plus pour continuer.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName, email, password, ageConfirmed, referralCode }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Une erreur est survenue.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="inline-block font-semibold tracking-tight mb-8">
          melii<span className="gradient-text">.</span>
        </Link>

        <div className="card glow p-7">
          <Link href="/" className="text-sm text-muted hover:text-foreground transition">
            ← Retour
          </Link>
          <h1 className="text-2xl font-semibold mt-4 mb-1">Créer votre bot</h1>
          <p className="text-sm text-muted mb-8">Deux minutes suffisent pour démarrer.</p>

          {referralCode && (
            <p className="text-xs mb-6 rounded-lg bg-surface-2 px-3 py-2 text-muted">
              Vous arrivez via le lien de parrainage d&apos;une créatrice 🎉
            </p>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Prénom affiché">
              <input
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Meely"
                className="input"
              />
            </Field>
            <Field label="Email">
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                className="input"
              />
            </Field>
            <Field label="Mot de passe">
              <input
                required
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8 caractères minimum"
                className="input"
              />
            </Field>

            <label className="flex items-start gap-2.5 text-sm text-muted">
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={(e) => setAgeConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
              />
              <span>
                Je confirme avoir 18 ans ou plus et j&apos;accepte les{" "}
                <Link href="/terms" className="underline underline-offset-4" target="_blank">
                  conditions d&apos;utilisation
                </Link>
                .
              </span>
            </label>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              disabled={loading || !ageConfirmed}
              className="w-full gradient-btn rounded-full px-6 py-3 font-medium text-white disabled:opacity-60"
            >
              {loading ? "Création..." : "Créer mon compte"}
            </button>
          </form>

          <p className="text-sm text-muted mt-6">
            Déjà un compte ?{" "}
            <Link href="/login" className="text-foreground underline underline-offset-4">
              Se connecter
            </Link>
          </p>
          <p className="text-sm text-muted mt-2">
            Mot de passe oublié ?{" "}
            <Link href="/forgot-password" className="text-foreground underline underline-offset-4">
              Réinitialiser
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm text-muted mb-1.5">{label}</span>
      {children}
    </label>
  );
}
