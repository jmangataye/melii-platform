"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Étape 2 (2FA) : n'apparaît que si /api/auth/login répond
  // needsTwoFactor=true — tant que pendingToken est vide on affiche
  // le formulaire email/mot de passe normal.
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [code, setCode] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Une erreur est survenue.");
        return;
      }
      if (json.needsTwoFactor) {
        setPendingToken(json.pendingToken);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function onSubmitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-2fa", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pendingToken, code }),
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
          {pendingToken ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setPendingToken(null);
                  setCode("");
                  setError(null);
                }}
                className="text-sm text-muted hover:text-foreground transition"
              >
                ← Retour
              </button>
              <h1 className="text-2xl font-semibold mt-4 mb-2">Vérification</h1>
              <p className="text-sm text-muted mb-8">
                Entrez le code à 6 chiffres de votre application d&apos;authentification, ou l&apos;un de vos codes de secours.
              </p>

              <form onSubmit={onSubmitCode} className="space-y-4">
                <label className="block">
                  <span className="block text-sm text-muted mb-1.5">Code</span>
                  <input
                    required
                    autoFocus
                    inputMode="numeric"
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="input tracking-[0.3em] text-center font-mono text-lg"
                  />
                </label>

                {error && <p className="text-sm text-red-400">{error}</p>}

                <button
                  disabled={loading}
                  className="w-full gradient-btn rounded-full px-6 py-3 font-medium text-white disabled:opacity-60"
                >
                  {loading ? "Vérification..." : "Valider"}
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/" className="text-sm text-muted hover:text-foreground transition">
                ← Retour
              </Link>
              <h1 className="text-2xl font-semibold mt-4 mb-8">Connexion</h1>

              <form onSubmit={onSubmit} className="space-y-4">
                <label className="block">
                  <span className="block text-sm text-muted mb-1.5">Email</span>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                  />
                </label>
                <label className="block">
                  <span className="block text-sm text-muted mb-1.5">Mot de passe</span>
                  <input
                    required
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input"
                  />
                </label>

                {error && <p className="text-sm text-red-400">{error}</p>}

                <button
                  disabled={loading}
                  className="w-full gradient-btn rounded-full px-6 py-3 font-medium text-white disabled:opacity-60"
                >
                  {loading ? "Connexion..." : "Se connecter"}
                </button>
              </form>

              <p className="text-sm text-muted mt-6">
                Pas encore de compte ?{" "}
                <Link href="/signup" className="text-foreground underline underline-offset-4">
                  Créer mon bot
                </Link>
              </p>
              <p className="text-sm text-muted mt-2">
                <Link href="/forgot-password" className="underline underline-offset-4">
                  Mot de passe oublié ?
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
