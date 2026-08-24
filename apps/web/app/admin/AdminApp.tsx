"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AdminCreator = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  subscriptionStatus: string;
  subscriptionPlan: string | null;
  trialEndsAt: string | null;
  telegramConnected: boolean;
  tierCount: number;
  totalDeclaredCents: number;
  conversations30d: number;
  commissionOwedCents: number;
  referralCount: number;
  commissionRate: number;
};

type FlaggedConversation = {
  id: string;
  creatorId: string;
  chatId: string;
  content: string;
  createdAt: string;
  creatorDisplayName: string;
  creatorEmail: string;
};

type Summary = {
  totalCreators: number;
  inTrial: number;
  active: number;
  churnedOrPastDue: number;
  totalCommissionOwedCents: number;
  totalConversations30d: number;
};

function eur(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  trial: { label: "Essai", className: "bg-amber-500/15 text-amber-300" },
  active: { label: "Actif", className: "bg-emerald-500/15 text-emerald-300" },
  past_due: { label: "Paiement en retard", className: "bg-red-500/15 text-red-300" },
  canceled: { label: "Résilié", className: "bg-white/10 text-muted" },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_LABELS[status] || { label: status, className: "bg-white/10 text-muted" };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.className}`}>
      {meta.label}
    </span>
  );
}

type SortKey = "createdAt" | "conversations30d" | "totalDeclaredCents" | "commissionOwedCents";

export default function AdminApp() {
  const router = useRouter();
  const [view, setView] = useState<"creators" | "moderation">("creators");
  const [creators, setCreators] = useState<AdminCreator[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [commissionRate, setCommissionRate] = useState(0.15);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadCreators = useCallback(async () => {
    const res = await fetch("/api/admin/creators");
    if (res.status === 403 || res.status === 401) {
      router.push("/dashboard");
      return;
    }
    if (!res.ok) {
      setError("Impossible de charger les données.");
      setLoading(false);
      return;
    }
    const json = await res.json();
    setCreators(json.creators);
    setSummary(json.summary);
    setCommissionRate(json.commissionRate);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadCreators();
  }, [loadCreators]);

  async function handleDelete(c: AdminCreator) {
    const confirmed = window.confirm(
      `Supprimer définitivement le compte de ${c.displayName || c.email} (${c.email}) ?\n\n` +
        "Ses paliers, ventes déclarées et son historique de conversation seront supprimés avec. Cette action est irréversible."
    );
    if (!confirmed) return;

    setDeletingId(c.id);
    try {
      const res = await fetch(`/api/admin/creators/${c.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error || "La suppression a échoué.");
        return;
      }
      await loadCreators();
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted">
        Chargement…
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-400">{error}</div>
    );
  }

  const filtered = creators
    .filter((c) => statusFilter === "all" || c.subscriptionStatus === statusFilter)
    .filter((c) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return c.email.toLowerCase().includes(q) || c.displayName.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortKey === "createdAt") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return (b[sortKey] as number) - (a[sortKey] as number);
    });

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between">
          <span className="font-semibold tracking-tight">
            melii<span className="gradient-text">.</span>{" "}
            <span className="text-muted font-normal">/ admin</span>
          </span>
          <button
            onClick={() => router.push("/dashboard")}
            className="text-sm text-muted hover:text-foreground transition"
          >
            Retour au dashboard
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 space-y-8">
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <SummaryCard label="Créatrices" value={String(summary.totalCreators)} />
            <SummaryCard label="En essai" value={String(summary.inTrial)} />
            <SummaryCard label="Abonnées actives" value={String(summary.active)} />
            <SummaryCard label="Impayé / résilié" value={String(summary.churnedOrPastDue)} />
            <SummaryCard label="Conversations (30j)" value={String(summary.totalConversations30d)} />
            <SummaryCard label="Commission due" value={eur(summary.totalCommissionOwedCents)} accent />
          </div>
        )}

        <nav className="flex gap-1 border-b border-border">
          <button
            onClick={() => setView("creators")}
            className={`px-4 py-2.5 text-sm rounded-t-lg transition ${
              view === "creators"
                ? "text-foreground border-b-2 border-accent -mb-px font-medium"
                : "text-muted hover:text-foreground"
            }`}
          >
            Créatrices
          </button>
          <button
            onClick={() => setView("moderation")}
            className={`px-4 py-2.5 text-sm rounded-t-lg transition ${
              view === "moderation"
                ? "text-foreground border-b-2 border-accent -mb-px font-medium"
                : "text-muted hover:text-foreground"
            }`}
          >
            Modération
          </button>
        </nav>

        {view === "moderation" && <ModerationPanel />}

        {view === "creators" && (
        <>
        <div className="flex flex-wrap items-center gap-3">
          <input
            className="input max-w-xs"
            placeholder="Rechercher un email ou un prénom…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="input max-w-[220px]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Tous les statuts</option>
            <option value="trial">Essai</option>
            <option value="active">Actif</option>
            <option value="past_due">Paiement en retard</option>
            <option value="canceled">Résilié</option>
          </select>
          <select
            className="input max-w-[220px]"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            <option value="createdAt">Trier : inscription récente</option>
            <option value="conversations30d">Trier : conversations (30j)</option>
            <option value="totalDeclaredCents">Trier : ventes déclarées</option>
            <option value="commissionOwedCents">Trier : commission due</option>
          </select>
          <span className="text-sm text-muted ml-auto">
            {filtered.length} / {creators.length}
          </span>
        </div>

        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-3 font-medium">Créatrice</th>
                <th className="px-4 py-3 font-medium">Inscrite le</th>
                <th className="px-4 py-3 font-medium">Abonnement</th>
                <th className="px-4 py-3 font-medium">Fin d&apos;essai</th>
                <th className="px-4 py-3 font-medium">Telegram</th>
                <th className="px-4 py-3 font-medium">Liens</th>
                <th className="px-4 py-3 font-medium">Conv. (30j)</th>
                <th className="px-4 py-3 font-medium">Ventes déclarées</th>
                <th className="px-4 py-3 font-medium">Parrainage</th>
                <th className="px-4 py-3 font-medium">Commission due</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.displayName || "—"}</div>
                    <div className="text-muted text-xs">{c.email}</div>
                  </td>
                  <td className="px-4 py-3 text-muted">{formatDate(c.createdAt)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.subscriptionStatus} />
                    {c.subscriptionPlan && (
                      <div className="text-xs text-muted mt-1">{c.subscriptionPlan}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {c.subscriptionStatus === "trial" ? formatDate(c.trialEndsAt) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {c.telegramConnected ? (
                      <span className="text-emerald-300">Connecté</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{c.tierCount}</td>
                  <td className="px-4 py-3 text-muted">{c.conversations30d}</td>
                  <td className="px-4 py-3">{eur(c.totalDeclaredCents)}</td>
                  <td className="px-4 py-3 text-muted">
                    {c.referralCount > 0 ? `${c.referralCount} (${(c.commissionRate * 100).toFixed(0)}%)` : "—"}
                  </td>
                  <td className="px-4 py-3 font-medium">{eur(c.commissionOwedCents)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(c)}
                      disabled={deletingId === c.id}
                      className="text-xs text-red-400 hover:text-red-300 transition disabled:opacity-50"
                    >
                      {deletingId === c.id ? "Suppression…" : "Supprimer"}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-muted">
                    Aucune créatrice ne correspond à ces filtres.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-muted">
          Taux de commission actuel : {(commissionRate * 100).toFixed(0)}% des ventes déclarées par les créatrices.
          Ces montants sont indicatifs (basés sur les déclarations manuelles) tant que la facturation Stripe
          automatique n&apos;est pas branchée.
        </p>
        </>
        )}
      </main>
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-muted mb-1">{label}</div>
      <div className={`text-xl font-semibold ${accent ? "gradient-text" : ""}`}>{value}</div>
    </div>
  );
}

// Onglet modération : uniquement les messages qui ont déclenché un mot-clé
// de sécurité (voir listFlaggedConversations côté DB) — pas l'historique
// complet de conversation de chaque créatrice. On affiche juste le message
// concerné avec son contexte minimal (qui, quand), pas le fil entier.
function ModerationPanel() {
  const [flagged, setFlagged] = useState<FlaggedConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/moderation");
    if (res.ok) {
      const json = await res.json();
      setFlagged(json.flagged || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markReviewed(id: string) {
    setReviewingId(id);
    try {
      await fetch(`/api/admin/moderation/${id}`, { method: "PATCH" });
      setFlagged((prev) => prev.filter((f) => f.id !== id));
    } finally {
      setReviewingId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">Chargement…</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Messages ayant déclenché un mot-clé de sécurité (détresse, minorité, chantage...),
        pas encore vérifiés. Le bot a déjà répondu par un message de sécurité standard —
        ceci est juste pour votre information, pas une conversation à reprendre.
      </p>
      {flagged.length === 0 ? (
        <p className="text-sm text-muted card p-5">Rien à signaler en ce moment.</p>
      ) : (
        <ul className="space-y-3">
          {flagged.map((f) => (
            <li key={f.id} className="card p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>
                  {f.creatorDisplayName} ({f.creatorEmail})
                </span>
                <span>{new Date(f.createdAt).toLocaleString("fr-FR")}</span>
              </div>
              <p className="text-sm bg-surface-2 rounded-lg p-3">{f.content}</p>
              <button
                onClick={() => markReviewed(f.id)}
                disabled={reviewingId === f.id}
                className="text-xs text-muted hover:text-foreground transition disabled:opacity-50"
              >
                {reviewingId === f.id ? "..." : "Marquer comme vérifié"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
