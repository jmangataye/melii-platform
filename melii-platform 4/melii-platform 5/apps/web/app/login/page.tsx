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
      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
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
      </div>
    </main>
  );
}
