"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Une erreur est survenue.");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <p className="text-sm text-muted">
          Lien invalide. <Link href="/forgot-password" className="underline underline-offset-4">Demandez-en un nouveau</Link>.
        </p>
      </main>
    );
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="inline-block font-semibold tracking-tight mb-8">
          melii<span className="gradient-text">.</span>
        </Link>

        <div className="card glow p-7">
          <h1 className="text-2xl font-semibold mb-1">Nouveau mot de passe</h1>
          <p className="text-sm text-muted mb-8">Choisissez un mot de passe pour votre compte.</p>

          {done ? (
            <p className="text-sm rounded-xl bg-surface-2 p-4">Mot de passe changé — redirection vers la connexion...</p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <label className="block">
                <span className="block text-sm text-muted mb-1.5">Nouveau mot de passe</span>
                <input
                  required
                  type="password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8 caractères minimum"
                  className="input"
                />
              </label>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button
                disabled={loading}
                className="w-full gradient-btn rounded-full px-6 py-3 font-medium text-white disabled:opacity-60"
              >
                {loading ? "Enregistrement..." : "Changer le mot de passe"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
