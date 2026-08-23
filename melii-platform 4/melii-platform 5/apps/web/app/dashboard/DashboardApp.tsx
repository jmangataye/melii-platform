"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Creator = {
  id: string;
  email: string;
  displayName: string;
  personaTone: string;
  personaBio: string;
  telegramBotUsername: string | null;
  telegramWebhookReady: boolean;
  hasTelegramToken: boolean;
};

type Tier = {
  id: string;
  order: number;
  label: string;
  priceCents: number;
  currency: string;
  url: string;
};

type Stats = {
  clicksByTier: Record<string, number>;
  totalDeclaredCents: number;
  commissionRate: number;
  commissionOwedCents: number;
};

type Sale = {
  id: string;
  tierId: string;
  tierLabel: string;
  amountCents: number;
  currency: string;
  note: string;
  declaredAt: string;
};

const TABS = [
  { key: "chat", label: "Chat en ligne" },
  { key: "persona", label: "Personnalité" },
  { key: "liens", label: "Liens & tarifs" },
  { key: "telegram", label: "Telegram" },
  { key: "stats", label: "Statistiques" },
  { key: "facturation", label: "Facturation" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const TONES = [
  { value: "doux_complice", label: "Doux & complice" },
  { value: "direct_vendeur", label: "Direct & vendeur" },
  { value: "joueur_taquin", label: "Joueur & taquin" },
];

function eur(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export default function DashboardApp({ initialDisplayName }: { initialDisplayName: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("chat");
  const [creator, setCreator] = useState<Creator | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/me");
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    const json = await res.json();
    setCreator(json.creator);
    setTiers(json.tiers);
    setStats(json.stats);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  if (loading || !creator) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted">
        Chargement...
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-border">
        <div className="mx-auto max-w-4xl px-6 py-5 flex items-center justify-between">
          <span className="font-semibold tracking-tight">
            melii<span className="gradient-text">.</span>{" "}
            <span className="text-muted font-normal">/ {creator.displayName || initialDisplayName}</span>
          </span>
          <button onClick={logout} className="text-sm text-muted hover:text-foreground transition">
            Se déconnecter
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl w-full px-6 pt-6">
        <nav className="flex gap-1 border-b border-border overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm whitespace-nowrap rounded-t-lg transition ${
                tab === t.key
                  ? "text-foreground border-b-2 border-accent -mb-px font-medium"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <main className="mx-auto max-w-4xl w-full flex-1 px-6 py-8">
        {tab === "chat" && <ChatLinkTab creator={creator} />}
        {tab === "persona" && <PersonaTab creator={creator} onSaved={refresh} />}
        {tab === "liens" && <TiersTab tiers={tiers} onChanged={refresh} />}
        {tab === "telegram" && <TelegramTab creator={creator} onChanged={refresh} />}
        {tab === "stats" && <StatsTab stats={stats} tiers={tiers} />}
        {tab === "facturation" && <BillingTab stats={stats} tiers={tiers} onChanged={refresh} />}
      </main>
    </div>
  );
}

// ------------------------------------------------------------------

function ChatLinkTab({ creator }: { creator: Creator }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window !== "undefined" ? `${window.location.origin}/c/${creator.id}` : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponible : le champ reste sélectionnable manuellement.
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-lg font-medium mb-1">Chat en ligne</h2>
        <p className="text-sm text-muted">
          C&apos;est votre canal principal, actif immédiatement — pas besoin de
          Telegram. Partagez ce lien (bio Instagram, Linktree, TikTok...) :
          votre communauté discute directement avec votre bot sur cette page,
          et découvre vos paliers dans l&apos;ordre.
        </p>
      </div>

      <div className="card p-5 space-y-4">
        <label className="block">
          <span className="block text-sm text-muted mb-1.5">Votre lien</span>
          <div className="flex items-center gap-2">
            <input className="input font-mono text-sm" value={link} readOnly onFocus={(e) => e.target.select()} />
            <button
              onClick={copy}
              className="gradient-btn rounded-full px-5 py-2.5 text-sm font-medium text-white shrink-0"
            >
              {copied ? "Copié !" : "Copier"}
            </button>
          </div>
        </label>
        {link && (
          <a href={link} target="_blank" rel="noreferrer" className="text-sm underline underline-offset-4 text-muted hover:text-foreground transition">
            Ouvrir un aperçu du chat →
          </a>
        )}
      </div>

      <p className="text-xs text-muted">
        Astuce : configurez d&apos;abord votre personnalité et vos paliers
        (onglets suivants) avant de partager le lien.
      </p>
    </div>
  );
}

// ------------------------------------------------------------------

function PersonaTab({ creator, onSaved }: { creator: Creator; onSaved: () => void }) {
  const [displayName, setDisplayName] = useState(creator.displayName);
  const [tone, setTone] = useState(creator.personaTone);
  const [bio, setBio] = useState(creator.personaBio);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/persona", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName, tone, bio }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Erreur lors de l'enregistrement.");
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8 max-w-xl">
      <div>
        <h2 className="text-lg font-medium mb-1">Personnalité du bot</h2>
        <p className="text-sm text-muted">
          Ces réglages définissent le ton de toutes les conversations — deux règles de
          sécurité restent toujours actives quel que soit le ton choisi (honnêteté si
          on lui demande sincèrement si c'est une IA, aucun contenu explicite généré).
        </p>
      </div>

      <label className="block">
        <span className="block text-sm text-muted mb-1.5">Prénom affiché</span>
        <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </label>

      <div>
        <span className="block text-sm text-muted mb-2">Ton</span>
        <div className="grid sm:grid-cols-3 gap-3">
          {TONES.map((t) => (
            <button
              key={t.value}
              onClick={() => setTone(t.value)}
              className={`card p-4 text-left transition ${
                tone === t.value ? "border-accent" : "hover:border-muted"
              }`}
            >
              <span className="text-sm font-medium">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="block text-sm text-muted mb-1.5">
          Bio / contexte (optionnel, visible seulement par le bot)
        </span>
        <textarea
          className="input min-h-28"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Centres d'intérêt, ce qui te caractérise, ce que le bot doit savoir sur toi..."
        />
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        onClick={save}
        disabled={saving}
        className="gradient-btn rounded-full px-6 py-2.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {saving ? "Enregistrement..." : "Enregistrer"}
      </button>
    </div>
  );
}

// ------------------------------------------------------------------

function TiersTab({ tiers, onChanged }: { tiers: Tier[]; onChanged: () => void }) {
  const [label, setLabel] = useState("");
  const [priceEuros, setPriceEuros] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextOrder = tiers.length ? Math.max(...tiers.map((t) => t.order)) + 1 : 1;

  async function addTier() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/tiers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ order: nextOrder, label, priceEuros: Number(priceEuros), url }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Erreur lors de l'ajout.");
        return;
      }
      setLabel("");
      setPriceEuros("");
      setUrl("");
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function removeTier(id: string) {
    await fetch(`/api/tiers/${id}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <div className="space-y-8 max-w-xl">
      <div>
        <h2 className="text-lg font-medium mb-1">Paliers de liens</h2>
        <p className="text-sm text-muted">
          Le bot les propose toujours dans l'ordre, en commençant par le moins cher.
          Utilisez vos liens de paiement habituels (Dropfans ou autre).
        </p>
      </div>

      <ul className="space-y-3">
        {tiers
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((t) => (
            <li key={t.id} className="card p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  Palier {t.order} — {t.label}
                </p>
                <p className="text-xs text-muted truncate">{t.url}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm gradient-text font-medium">{eur(t.priceCents)}</span>
                <button
                  onClick={() => removeTier(t.id)}
                  className="text-xs text-muted hover:text-red-400 transition"
                >
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        {tiers.length === 0 && (
          <p className="text-sm text-muted">Aucun palier pour l'instant.</p>
        )}
      </ul>

      <div className="card p-5 space-y-4">
        <p className="text-sm font-medium">Ajouter le palier {nextOrder}</p>
        <label className="block">
          <span className="block text-sm text-muted mb-1.5">Libellé</span>
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex : Accès photos exclusives" />
        </label>
        <label className="block">
          <span className="block text-sm text-muted mb-1.5">Prix (€)</span>
          <input
            className="input"
            type="number"
            min="0.5"
            step="0.5"
            value={priceEuros}
            onChange={(e) => setPriceEuros(e.target.value)}
            placeholder="5"
          />
        </label>
        <label className="block">
          <span className="block text-sm text-muted mb-1.5">Lien de paiement</span>
          <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://dropfans.io/..." />
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          onClick={addTier}
          disabled={saving || !label || !priceEuros || !url}
          className="gradient-btn rounded-full px-6 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Ajout..." : "Ajouter le palier"}
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------

function TelegramTab({ creator, onChanged }: { creator: Creator; onChanged: () => void }) {
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/telegram/connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Erreur lors de la connexion.");
        return;
      }
      setToken("");
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    await fetch("/api/telegram/connect", { method: "DELETE" });
    onChanged();
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-lg font-medium mb-1">Connexion Telegram</h2>
        <p className="text-sm text-muted">
          Optionnel — votre chat en ligne (onglet précédent) fonctionne déjà
          sans ça. Connectez Telegram en plus si vous voulez aussi être
          jointe depuis l&apos;app Telegram. Créez un bot en 2 minutes via{" "}
          <a
            href="https://t.me/BotFather"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            @BotFather
          </a>{" "}
          sur Telegram (<code className="text-xs">/newbot</code>), puis collez le token
          ici. Personne d'autre que vous ne le voit.
        </p>
      </div>

      {creator.telegramWebhookReady ? (
        <div className="card p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">
              Connecté — @{creator.telegramBotUsername}
            </p>
            <p className="text-xs text-muted mt-1">
              Partagez le lien{" "}
              <code className="text-xs">t.me/{creator.telegramBotUsername}</code> avec
              votre communauté.
            </p>
          </div>
          <button onClick={disconnect} className="text-sm text-muted hover:text-red-400 transition">
            Déconnecter
          </button>
        </div>
      ) : (
        <div className="card p-5 space-y-4">
          <label className="block">
            <span className="block text-sm text-muted mb-1.5">Token BotFather</span>
            <input
              className="input font-mono text-sm"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="123456789:AAExemple..."
            />
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            onClick={connect}
            disabled={saving || !token}
            className="gradient-btn rounded-full px-6 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Connexion..." : "Connecter mon bot"}
          </button>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------

function StatsTab({ stats, tiers }: { stats: Stats | null; tiers: Tier[] }) {
  if (!stats) return null;
  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-lg font-medium mb-1">Statistiques</h2>
        <p className="text-sm text-muted">
          Clics enregistrés quand quelqu'un clique vraiment sur un de vos liens
          (pas seulement quand le bot le propose).
        </p>
      </div>
      <ul className="space-y-3">
        {tiers
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((t) => (
            <li key={t.id} className="card p-4 flex items-center justify-between">
              <span className="text-sm">
                Palier {t.order} — {t.label}
              </span>
              <span className="text-sm font-medium">
                {stats.clicksByTier[t.id] || 0} clic(s)
              </span>
            </li>
          ))}
        {tiers.length === 0 && <p className="text-sm text-muted">Ajoutez un palier pour voir des stats.</p>}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------------

function BillingTab({
  stats,
  tiers,
  onChanged,
}: {
  stats: Stats | null;
  tiers: Tier[];
  onChanged: () => void;
}) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [tierId, setTierId] = useState(tiers[0]?.id || "");
  const [amountEuros, setAmountEuros] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSales = useCallback(async () => {
    const res = await fetch("/api/sales");
    const json = await res.json();
    setSales(json.sales || []);
  }, []);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  async function declare() {
    if (!tierId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tierId, amountEuros: Number(amountEuros) }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Erreur.");
        return;
      }
      setAmountEuros("");
      loadSales();
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8 max-w-xl">
      <div>
        <h2 className="text-lg font-medium mb-1">Facturation</h2>
        <p className="text-sm text-muted">
          Melii ne traite pas vos paiements — vos liens externes s'en chargent. En v1,
          déclarez vos ventes ici pour calculer la commission (
          {stats ? Math.round(stats.commissionRate * 100) : "–"}%) : c'est la base sur
          laquelle vous serez facturée mensuellement. Une intégration automatique
          est prévue une fois un processeur adapté au contenu adulte choisi.
        </p>
      </div>

      {stats && (
        <div className="card p-5 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted">Ventes déclarées</p>
            <p className="text-lg font-medium">{eur(stats.totalDeclaredCents)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Commission due</p>
            <p className="text-lg font-medium gradient-text">{eur(stats.commissionOwedCents)}</p>
          </div>
        </div>
      )}

      <div className="card p-5 space-y-4">
        <p className="text-sm font-medium">Déclarer une vente</p>
        <label className="block">
          <span className="block text-sm text-muted mb-1.5">Palier concerné</span>
          <select className="input" value={tierId} onChange={(e) => setTierId(e.target.value)}>
            {tiers.map((t) => (
              <option key={t.id} value={t.id}>
                Palier {t.order} — {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-sm text-muted mb-1.5">Montant (€)</span>
          <input
            className="input"
            type="number"
            min="0.5"
            step="0.5"
            value={amountEuros}
            onChange={(e) => setAmountEuros(e.target.value)}
          />
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          onClick={declare}
          disabled={saving || !tierId || !amountEuros}
          className="gradient-btn rounded-full px-6 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Enregistrement..." : "Déclarer"}
        </button>
      </div>

      <div>
        <p className="text-sm font-medium mb-3">Historique</p>
        <ul className="space-y-2">
          {sales.map((s) => (
            <li key={s.id} className="card p-3 flex items-center justify-between text-sm">
              <span>{s.tierLabel}</span>
              <span className="text-muted">{new Date(s.declaredAt).toLocaleDateString("fr-FR")}</span>
              <span className="font-medium">{eur(s.amountCents)}</span>
            </li>
          ))}
          {sales.length === 0 && <p className="text-sm text-muted">Aucune vente déclarée.</p>}
        </ul>
      </div>
    </div>
  );
}
