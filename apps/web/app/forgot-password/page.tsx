"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/login" className="text-sm text-muted hover:text-foreground transition">
          ← Retour
        </Link>
        <h1 className="text-2xl font-semibold mt-4 mb-1">Mot de passe oublié</h1>
        <p className="text-sm text-muted mb-8">
          On vous envoie un lien pour en choisir un nouveau.
        </p>

        {sent ? (
          <p className="text-sm card p-4">
            Si un compte existe avec cet email, un lien de réinitialisation
            vient d&apos;être envoyé — vérifiez votre boîte de réception (et vos
            spams).
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className="block text-sm text-muted mb-1.5">Email</span>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                className="input"
              />
            </label>
            <button
              disabled={loading}
              className="w-full gradient-btn rounded-full px-6 py-3 font-medium text-white disabled:opacity-60"
            >
              {loading ? "Envoi..." : "Envoyer le lien"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
