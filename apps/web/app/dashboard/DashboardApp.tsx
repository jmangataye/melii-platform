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
  avatarUrl: string | null;
  accentColor: string | null;
  slug: string | null;
  galleryUrls: string[];
  referralCode: string | null;
  totpEnabled: boolean;
  customDomain: string | null;
  customDomainVerifyToken: string | null;
  customDomainVerified: boolean;
  relanceEnabled: boolean;
};

type Tier = {
  id: string;
  order: number;
  label: string;
  priceCents: number;
  currency: string;
  url: string;
};

type DailyClicks = { day: string; clicks: number };

type Stats = {
  clicksByTier: Record<string, number>;
  clicksByDay: DailyClicks[];
  totalDeclaredCents: number;
  commissionRate: number;
  commissionOwedCents: number;
  referralCount: number;
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
  { key: "compte", label: "Compte" },
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
  const [isAdmin, setIsAdmin] = useState(false);

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
    setIsAdmin(!!json.isAdmin);
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
    return <DashboardSkeleton />;
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-border">
        <div className="mx-auto max-w-4xl px-6 py-5 flex items-center justify-between">
          <span className="font-semibold tracking-tight">
            melii<span className="gradient-text">.</span>{" "}
            <span className="text-muted font-normal">/ {creator.displayName || initialDisplayName}</span>
          </span>
          <div className="flex items-center gap-4">
            {isAdmin && (
              <button
                onClick={() => router.push("/admin")}
                className="text-sm text-muted hover:text-foreground transition"
              >
                Admin
              </button>
            )}
            <button onClick={logout} className="text-sm text-muted hover:text-foreground transition">
              Se déconnecter
            </button>
          </div>
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
        {tab === "chat" && <ChatLinkTab creator={creator} onChanged={refresh} />}
        {tab === "persona" && <PersonaTab creator={creator} onSaved={refresh} />}
        {tab === "liens" && <TiersTab tiers={tiers} onChanged={refresh} />}
        {tab === "telegram" && <TelegramTab creator={creator} onChanged={refresh} />}
        {tab === "stats" && <StatsTab stats={stats} tiers={tiers} />}
        {tab === "facturation" && <BillingTab stats={stats} tiers={tiers} onChanged={refresh} />}
        {tab === "compte" && <AccountTab creator={creator} stats={stats} onChanged={refresh} />}
      </main>
    </div>
  );
}

// ------------------------------------------------------------------

// Squelette de chargement — reprend la structure réelle du dashboard
// (en-tête, onglets, cartes) plutôt qu'un simple texte "Chargement...", pour
// que l'œil reconnaisse déjà la mise en page pendant le fetch de /api/me et
// que rien ne "saute" visuellement une fois les données arrivées.
function Bone({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-surface-2 ${className}`} />;
}

function DashboardSkeleton() {
  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-border">
        <div className="mx-auto max-w-4xl px-6 py-5 flex items-center justify-between">
          <Bone className="h-5 w-40" />
          <Bone className="h-4 w-24" />
        </div>
      </header>
      <div className="mx-auto max-w-4xl w-full px-6 pt-6">
        <div className="flex gap-6 border-b border-border pb-3">
          {TABS.map((t) => (
            <Bone key={t.key} className="h-4 w-20" />
          ))}
        </div>
      </div>
      <main className="mx-auto max-w-4xl w-full flex-1 px-6 py-8 space-y-6 max-w-xl">
        <div className="space-y-2">
          <Bone className="h-5 w-48" />
          <Bone className="h-4 w-full" />
          <Bone className="h-4 w-5/6" />
        </div>
        <div className="card p-5 space-y-4">
          <Bone className="h-4 w-24" />
          <Bone className="h-11 w-full" />
        </div>
        <div className="card p-5 space-y-4">
          <Bone className="h-4 w-32" />
          <Bone className="h-11 w-full" />
        </div>
      </main>
    </div>
  );
}

// ------------------------------------------------------------------

function ChatLinkTab({ creator, onChanged }: { creator: Creator; onChanged: () => void }) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = origin ? `${origin}/c/${creator.slug || creator.id}` : "";

  const [slug, setSlug] = useState(creator.slug || "");
  const [savingSlug, setSavingSlug] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [slugSaved, setSlugSaved] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponible : le champ reste sélectionnable manuellement.
    }
  }

  async function saveSlug() {
    setSavingSlug(true);
    setSlugError(null);
    setSlugSaved(false);
    try {
      const res = await fetch("/api/slug", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSlugError(json.error || "Erreur lors de la mise à jour du lien.");
        return;
      }
      setSlugSaved(true);
      setTimeout(() => setSlugSaved(false), 2000);
      onChanged();
    } finally {
      setSavingSlug(false);
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

      <div className="card p-5 space-y-3">
        <p className="text-sm font-medium">Personnaliser le lien</p>
        <p className="text-xs text-muted">
          Choisissez un identifiant court et mémorisable (lettres, chiffres, tirets).
          L&apos;ancien lien continue de fonctionner si vous le changez.
        </p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted font-mono whitespace-nowrap">{origin}/c/</span>
          <input
            className="input font-mono text-sm"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            placeholder="luna"
          />
          <button
            onClick={saveSlug}
            disabled={savingSlug || !slug || slug === creator.slug}
            className="gradient-btn rounded-full px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60 shrink-0"
          >
            {savingSlug ? "..." : slugSaved ? "✓" : "Valider"}
          </button>
        </div>
        {slugError && <p className="text-sm text-red-400">{slugError}</p>}
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

  const [avatarUrl, setAvatarUrl] = useState(creator.avatarUrl || "");
  const [accentColor, setAccentColor] = useState(creator.accentColor || "");
  const [galleryUrls, setGalleryUrls] = useState<string[]>(creator.galleryUrls || []);
  const [newGalleryUrl, setNewGalleryUrl] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  function addGalleryUrl() {
    const url = newGalleryUrl.trim();
    if (!url || galleryUrls.length >= 8) return;
    setGalleryUrls([...galleryUrls, url]);
    setNewGalleryUrl("");
  }

  function removeGalleryUrl(url: string) {
    setGalleryUrls(galleryUrls.filter((u) => u !== url));
  }

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

  async function saveProfile() {
    setSavingProfile(true);
    setProfileError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ avatarUrl, accentColor, galleryUrls }),
      });
      const json = await res.json();
      if (!res.ok) {
        setProfileError(json.error || "Erreur lors de l'enregistrement.");
        return;
      }
      onSaved();
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <div className="space-y-8 max-w-xl">
      <div>
        <h2 className="text-lg font-medium mb-1">Personnalité du bot</h2>
        <p className="text-sm text-muted">
          Ces réglages définissent le ton de toutes les conversations — deux règles de
          sécurité restent toujours actives quel que soit le ton choisi (honnêteté si
          on lui demande sincèrement si c&apos;est une IA, aucun contenu explicite généré).
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

      <div className="border-t border-border pt-8">
        <h2 className="text-lg font-medium mb-1">Apparence</h2>
        <p className="text-sm text-muted mb-6">
          Optionnel — personnalise la page de chat que tes abonnés voient.
        </p>

        <div className="space-y-6">
          <label className="block">
            <span className="block text-sm text-muted mb-1.5">
              URL de photo de profil (optionnel)
            </span>
            <input
              className="input"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
            />
            <span className="block text-xs text-muted mt-1.5">
              Lien direct vers une image déjà hébergée ailleurs (Instagram, Twitter, etc.) —
              pas d&apos;upload de fichier ici.
            </span>
          </label>

          <label className="block">
            <span className="block text-sm text-muted mb-1.5">Couleur d&apos;accent (optionnel)</span>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={/^#([0-9a-fA-F]{6})$/.test(accentColor) ? accentColor : "#ff4d8d"}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-10 w-14 rounded-lg border border-border bg-transparent cursor-pointer"
              />
              <input
                className="input flex-1"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                placeholder="#ff4d8d"
              />
            </div>
          </label>

          <div>
            <span className="block text-sm text-muted mb-1.5">
              Galerie photo (optionnel, jusqu&apos;à 8 photos)
            </span>
            {galleryUrls.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {galleryUrls.map((url) => (
                  <div key={url} className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element -- URL externe arbitraire */}
                    <img
                      src={url}
                      alt=""
                      className="w-16 h-16 rounded-lg object-cover border border-border"
                    />
                    <button
                      type="button"
                      onClick={() => removeGalleryUrl(url)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-surface text-xs border border-border flex items-center justify-center text-muted hover:text-red-400 transition"
                      aria-label="Retirer cette photo"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            {galleryUrls.length < 8 && (
              <div className="flex items-center gap-2">
                <input
                  className="input flex-1"
                  value={newGalleryUrl}
                  onChange={(e) => setNewGalleryUrl(e.target.value)}
                  placeholder="https://..."
                />
                <button
                  type="button"
                  onClick={addGalleryUrl}
                  disabled={!newGalleryUrl.trim()}
                  className="rounded-full px-4 py-2.5 text-sm font-medium border border-border hover:border-muted transition disabled:opacity-60 shrink-0"
                >
                  Ajouter
                </button>
              </div>
            )}
            <span className="block text-xs text-muted mt-1.5">
              Affichée en haut de ta page de chat publique — mêmes liens directs
              hébergés ailleurs que la photo de profil.
            </span>
          </div>

          {profileError && <p className="text-sm text-red-400">{profileError}</p>}

          <button
            onClick={saveProfile}
            disabled={savingProfile}
            className="gradient-btn rounded-full px-6 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {savingProfile ? "Enregistrement..." : "Enregistrer l'apparence"}
          </button>
        </div>
      </div>
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
          Le bot les propose toujours dans l&apos;ordre, en commençant par le moins cher.
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
          <p className="text-sm text-muted">Aucun palier pour l&apos;instant.</p>
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
  const [savingRelance, setSavingRelance] = useState(false);

  async function toggleRelance() {
    setSavingRelance(true);
    try {
      await fetch("/api/relance", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: !creator.relanceEnabled }),
      });
      onChanged();
    } finally {
      setSavingRelance(false);
    }
  }

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
          ici. Personne d&apos;autre que vous ne le voit.
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
      ) : null}

      {creator.telegramWebhookReady && (
        <div className="card p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Relances automatiques</p>
            <p className="text-xs text-muted mt-1 max-w-sm">
              Si quelqu&apos;un clique sur un palier via Telegram puis n&apos;écrit plus
              pendant 24h à 7 jours, le bot envoie un seul message de relance, chaleureux
              et sans pression. Jamais sur une conversation signalée (mot-clé de sécurité).
            </p>
          </div>
          <button
            role="switch"
            aria-checked={creator.relanceEnabled}
            onClick={toggleRelance}
            disabled={savingRelance}
            className={`relative w-11 h-6 rounded-full shrink-0 transition ${
              creator.relanceEnabled ? "bg-[var(--accent)]" : "bg-surface-2 border border-border"
            } disabled:opacity-60`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                creator.relanceEnabled ? "translate-x-5" : ""
              }`}
            />
          </button>
        </div>
      )}

      {!creator.telegramWebhookReady && (
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
  const totalClicks = Object.values(stats.clicksByTier).reduce((a, b) => a + b, 0);
  const clicks14d = (stats.clicksByDay || []).reduce((a, d) => a + d.clicks, 0);

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-lg font-medium mb-1">Statistiques</h2>
        <p className="text-sm text-muted">
          Clics enregistrés quand quelqu&apos;un clique vraiment sur un de vos liens
          (pas seulement quand le bot le propose).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5">
          <p className="text-xs text-muted">Total des clics</p>
          <p className="text-2xl font-semibold mt-1">{totalClicks}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-muted">Sur les 14 derniers jours</p>
          <p className="text-2xl font-semibold mt-1">{clicks14d}</p>
        </div>
      </div>

      <div className="card p-5">
        <p className="text-sm font-medium mb-4">Clics par jour (14 derniers jours)</p>
        <ClicksChart data={stats.clicksByDay || []} />
      </div>

      <div>
        <p className="text-sm font-medium mb-3">Par palier</p>
        <ul className="space-y-3">
          {tiers
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((t) => {
              const clicks = stats.clicksByTier[t.id] || 0;
              const pct = totalClicks > 0 ? Math.round((clicks / totalClicks) * 100) : 0;
              return (
                <li key={t.id} className="card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">
                      Palier {t.order} — {t.label}
                    </span>
                    <span className="text-sm font-medium">{clicks} clic(s)</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                    <div
                      className="h-full gradient-btn rounded-full transition-[width]"
                      style={{ width: `${Math.max(pct, clicks > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          {tiers.length === 0 && <p className="text-sm text-muted">Ajoutez un palier pour voir des stats.</p>}
        </ul>
      </div>
    </div>
  );
}

// Petit graphique en barres en SVG pur — pas de librairie de charts pour
// quelques barres, ça alourdirait le bundle pour rien. `viewBox` fixe permet
// un rendu net à n'importe quelle taille d'écran (voir width="100%").
function ClicksChart({ data }: { data: DailyClicks[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted">Pas encore de données.</p>;
  }

  const width = 600;
  const height = 140;
  const padding = 4;
  const max = Math.max(1, ...data.map((d) => d.clicks));
  const barGap = 6;
  const barWidth = (width - barGap * (data.length - 1)) / data.length;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" role="img" aria-label="Clics par jour sur les 14 derniers jours">
        <defs>
          <linearGradient id="clicksBarGradient" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent-2)" />
          </linearGradient>
        </defs>
        {data.map((d, i) => {
          const barHeight = d.clicks > 0 ? Math.max(4, (d.clicks / max) * (height - padding * 2)) : 2;
          const x = i * (barWidth + barGap);
          const y = height - padding - barHeight;
          return (
            <rect
              key={d.day}
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={2}
              fill={d.clicks > 0 ? "url(#clicksBarGradient)" : "var(--border)"}
            >
              <title>
                {new Date(d.day + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} —{" "}
                {d.clicks} clic(s)
              </title>
            </rect>
          );
        })}
      </svg>
      <div className="flex justify-between mt-2 text-[10px] text-muted">
        <span>
          {new Date(data[0].day + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
        </span>
        <span>Aujourd&apos;hui</span>
      </div>
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
          Melii ne traite pas vos paiements — vos liens externes s&apos;en chargent. En v1,
          déclarez vos ventes ici pour calculer la commission (
          {stats ? Math.round(stats.commissionRate * 100) : "–"}%) : c&apos;est la base sur
          laquelle vous serez facturée mensuellement. Une intégration automatique
          est prévue une fois un processeur adapté au contenu adulte choisi.
        </p>
        {stats && stats.referralCount > 0 && (
          <p className="text-xs text-muted mt-2">
            Taux déjà réduit grâce à {stats.referralCount} filleule(s) parrainée(s) — voir
            l&apos;onglet Compte.
          </p>
        )}
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
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium">Historique</p>
          {sales.length > 0 && (
            <a
              href="/api/sales/export"
              className="text-xs text-muted hover:text-foreground underline underline-offset-4 transition"
            >
              Exporter en CSV
            </a>
          )}
        </div>
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

// ------------------------------------------------------------------

function AccountTab({
  creator,
  stats,
  onChanged,
}: {
  creator: Creator;
  stats: Stats | null;
  onChanged: () => void;
}) {
  return (
    <div className="space-y-10 max-w-xl">
      <div>
        <h2 className="text-lg font-medium mb-1">Compte</h2>
        <p className="text-sm text-muted">
          Sécurité, parrainage et domaine personnalisé.
        </p>
      </div>

      <ReferralSection creator={creator} referralCount={stats?.referralCount ?? null} />
      <div className="border-t border-border pt-8">
        <TwoFactorSection creator={creator} onChanged={onChanged} />
      </div>
      <div className="border-t border-border pt-8">
        <CustomDomainSection creator={creator} onChanged={onChanged} />
      </div>
    </div>
  );
}

function ReferralSection({
  creator,
  referralCount,
}: {
  creator: Creator;
  referralCount: number | null;
}) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = origin && creator.referralCode ? `${origin}/signup?ref=${creator.referralCode}` : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div>
      <h3 className="text-base font-medium mb-1">Parrainage entre créatrices</h3>
      <p className="text-sm text-muted mb-4">
        Partagez votre lien : chaque créatrice qui s&apos;inscrit avec réduit votre
        commission de 1 point (jusqu&apos;à −5 points), sans limite de temps.
      </p>
      <div className="card p-5 space-y-4">
        <label className="block">
          <span className="block text-sm text-muted mb-1.5">Votre lien de parrainage</span>
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
        <p className="text-sm text-muted">
          {referralCount === null ? "…" : `${referralCount} créatrice(s) parrainée(s)`}
        </p>
      </div>
    </div>
  );
}

function TwoFactorSection({ creator, onChanged }: { creator: Creator; onChanged: () => void }) {
  const [enrolling, setEnrolling] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [disableCode, setDisableCode] = useState("");
  const [disabling, setDisabling] = useState(false);

  async function startEnrollment() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/2fa/setup", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Erreur.");
        return;
      }
      setSecret(json.secret);
      setQrCodeDataUrl(json.qrCodeDataUrl);
      setEnrolling(true);
    } finally {
      setSaving(false);
    }
  }

  async function confirmEnrollment() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/2fa/enable", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret, code }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Code incorrect.");
        return;
      }
      setBackupCodes(json.backupCodes);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  function finishEnrollment() {
    setEnrolling(false);
    setSecret(null);
    setQrCodeDataUrl(null);
    setCode("");
    setBackupCodes(null);
  }

  async function disable() {
    setError(null);
    setDisabling(true);
    try {
      const res = await fetch("/api/2fa/disable", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: disableCode }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Code incorrect.");
        return;
      }
      setDisableCode("");
      onChanged();
    } finally {
      setDisabling(false);
    }
  }

  return (
    <div>
      <h3 className="text-base font-medium mb-1">Double authentification (2FA)</h3>
      <p className="text-sm text-muted mb-4">
        Optionnel — protège votre compte avec un code à 6 chiffres généré par une
        appli comme Google Authenticator ou Authy, en plus du mot de passe.
      </p>

      {creator.totpEnabled ? (
        backupCodes ? (
          <div className="card p-5 space-y-3">
            <p className="text-sm font-medium text-emerald-300">2FA activé !</p>
            <p className="text-sm text-muted">
              Notez ces codes de secours dans un endroit sûr — chacun ne fonctionne
              qu&apos;une fois et permet de vous reconnecter si vous perdez votre téléphone.
            </p>
            <div className="grid grid-cols-2 gap-2 font-mono text-sm bg-surface-2 rounded-lg p-4">
              {backupCodes.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
            <button
              onClick={finishEnrollment}
              className="gradient-btn rounded-full px-6 py-2.5 text-sm font-medium text-white"
            >
              J&apos;ai noté mes codes
            </button>
          </div>
        ) : (
          <div className="card p-5 space-y-4">
            <p className="text-sm">
              <span className="text-emerald-300 font-medium">Activé</span> — un code est
              demandé à chaque connexion.
            </p>
            <label className="block max-w-[200px]">
              <span className="block text-sm text-muted mb-1.5">
                Code actuel (pour désactiver)
              </span>
              <input
                className="input tracking-[0.2em] text-center font-mono"
                inputMode="numeric"
                placeholder="123456"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
              />
            </label>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              onClick={disable}
              disabled={disabling || !disableCode}
              className="text-sm text-muted hover:text-red-400 transition disabled:opacity-60"
            >
              {disabling ? "..." : "Désactiver le 2FA"}
            </button>
          </div>
        )
      ) : enrolling ? (
        <div className="card p-5 space-y-4">
          <p className="text-sm text-muted">
            Scannez ce QR code avec votre appli d&apos;authentification, puis entrez le
            code à 6 chiffres généré pour confirmer.
          </p>
          {qrCodeDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- data URI générée côté serveur, pas un asset next/image
            <img src={qrCodeDataUrl} alt="QR code d'activation du 2FA" className="rounded-lg border border-border" />
          )}
          <p className="text-xs text-muted font-mono break-all">
            Ou entrez ce code manuellement : {secret}
          </p>
          <label className="block max-w-[200px]">
            <span className="block text-sm text-muted mb-1.5">Code de vérification</span>
            <input
              className="input tracking-[0.2em] text-center font-mono"
              inputMode="numeric"
              autoFocus
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              onClick={confirmEnrollment}
              disabled={saving || code.length !== 6}
              className="gradient-btn rounded-full px-6 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving ? "Vérification..." : "Activer"}
            </button>
            <button onClick={finishEnrollment} className="text-sm text-muted hover:text-foreground transition">
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={startEnrollment}
          disabled={saving}
          className="rounded-full px-6 py-2.5 text-sm font-medium border border-border hover:border-muted transition disabled:opacity-60"
        >
          {saving ? "..." : "Activer le 2FA"}
        </button>
      )}
    </div>
  );
}

function CustomDomainSection({ creator, onChanged }: { creator: Creator; onChanged: () => void }) {
  const [domain, setDomain] = useState(creator.customDomain || "");
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [challengeHost, setChallengeHost] = useState<string | null>(
    creator.customDomain ? `_melii-challenge.${creator.customDomain}` : null
  );

  async function saveDomain() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/custom-domain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Erreur.");
        return;
      }
      setChallengeHost(json.challengeHost);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function removeDomain() {
    setSaving(true);
    try {
      await fetch("/api/custom-domain", { method: "DELETE" });
      setDomain("");
      setChallengeHost(null);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function verify() {
    setVerifying(true);
    setVerifyMessage(null);
    try {
      const res = await fetch("/api/custom-domain/verify", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setVerifyMessage(json.error || "Erreur.");
        return;
      }
      setVerifyMessage(json.verified ? "Domaine vérifié !" : json.error || "Pas encore trouvé.");
      onChanged();
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div>
      <h3 className="text-base font-medium mb-1">Domaine personnalisé</h3>
      <p className="text-sm text-muted mb-4">
        Optionnel, plus technique — remplacez le lien melii.../c/... par votre propre
        domaine (ex. lunabot.com). Nécessite d&apos;ajouter un enregistrement DNS chez
        votre registrar, puis de pointer le domaine vers Melii (étape documentée dans
        le README de déploiement).
      </p>

      <div className="card p-5 space-y-4">
        <label className="block">
          <span className="block text-sm text-muted mb-1.5">Domaine</span>
          <div className="flex items-center gap-2">
            <input
              className="input"
              value={domain}
              onChange={(e) => setDomain(e.target.value.toLowerCase())}
              placeholder="lunabot.com"
            />
            <button
              onClick={saveDomain}
              disabled={saving || !domain}
              className="gradient-btn rounded-full px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60 shrink-0"
            >
              {saving ? "..." : "Enregistrer"}
            </button>
          </div>
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        {challengeHost && !creator.customDomainVerified && (
          <div className="rounded-xl bg-surface-2 p-4 space-y-2 text-sm">
            <p className="text-muted">
              Ajoutez cet enregistrement TXT chez votre registrar, puis cliquez sur
              Vérifier (la propagation peut prendre quelques heures) :
            </p>
            <p className="font-mono text-xs break-all">Type : TXT</p>
            <p className="font-mono text-xs break-all">Hôte : {challengeHost}</p>
            <p className="font-mono text-xs break-all">Valeur : {creator.customDomainVerifyToken}</p>
            <button
              onClick={verify}
              disabled={verifying}
              className="mt-2 rounded-full px-5 py-2 text-xs font-medium border border-border hover:border-muted transition disabled:opacity-60"
            >
              {verifying ? "Vérification..." : "Vérifier"}
            </button>
            {verifyMessage && <p className="text-muted">{verifyMessage}</p>}
          </div>
        )}

        {creator.customDomainVerified && (
          <p className="text-sm text-emerald-300">Domaine vérifié et actif.</p>
        )}

        {creator.customDomain && (
          <button onClick={removeDomain} disabled={saving} className="text-sm text-muted hover:text-red-400 transition">
            Retirer le domaine
          </button>
        )}
      </div>
    </div>
  );
}
