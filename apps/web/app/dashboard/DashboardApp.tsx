"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BotPreview from "../BotPreview";
import { ToastProvider, useToast, useConfirm, CopyButton, StatusPill, EmptyState } from "./ui";

type Creator = {
  id: string;
  email: string;
  displayName: string;
  personaTone: string;
  personaBio: string;
  personaLanguage: string;
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
  sellAngle: string;
};

type DailyClicks = { day: string; clicks: number };

type VisitsBySource = { source: string; visits: number };
type FanSegmentation = { newFans: number; returningFans: number };

type Stats = {
  clicksByTier: Record<string, number>;
  clicksByDay: DailyClicks[];
  totalDeclaredCents: number;
  commissionRate: number;
  commissionOwedCents: number;
  referralCount: number;
  visitsBySource: VisitsBySource[];
  fanSegmentation: FanSegmentation;
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
  { key: "overview", label: "Vue d'ensemble" },
  { key: "chat", label: "Chat en ligne" },
  { key: "persona", label: "Personnalité" },
  { key: "liens", label: "Liens & tarifs" },
  { key: "telegram", label: "Telegram" },
  { key: "stats", label: "Statistiques" },
  { key: "fans", label: "Fans" },
  { key: "facturation", label: "Facturation" },
  { key: "compte", label: "Compte" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const TONES = [
  { value: "doux_complice", label: "Doux & complice" },
  { value: "direct_vendeur", label: "Direct & vendeur" },
  { value: "joueur_taquin", label: "Joueur & taquin" },
];

// Doit rester synchronisé avec VALID_LANGUAGES dans packages/db/persona.js.
const LANGUAGES = [
  { value: "fr", label: "Français" },
  { value: "en", label: "Anglais" },
  { value: "es", label: "Espagnol" },
];

// Sources pré-remplies proposées pour générer un lien tracké (voir
// ChatLinkTab) — la créatrice peut aussi taper un libellé personnalisé.
const QUICK_LINK_SOURCES = [
  { value: "bio", label: "Bio" },
  { value: "story", label: "Story" },
  { value: "post", label: "Post" },
];

const REFERRAL_DISCOUNT_CAP_COUNT = 5; // -1 pt par filleule, plafonné à -5 pts (voir packages/db/index.js)
const BIO_MAX_LENGTH = 800; // doit rester synchronisé avec la troncature côté /api/persona

function eur(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

// Le Provider doit envelopper l'arbre qui utilise useToast()/useConfirm() —
// on sépare donc ce composant "coquille" du vrai contenu (DashboardShell).
export default function DashboardApp({ initialDisplayName }: { initialDisplayName: string }) {
  return (
    <ToastProvider>
      <DashboardShell initialDisplayName={initialDisplayName} />
    </ToastProvider>
  );
}

function DashboardShell({ initialDisplayName }: { initialDisplayName: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("overview");
  const [creator, setCreator] = useState<Creator | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
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

  // Chargée une fois au niveau racine plutôt que dans BillingTab (comme
  // avant) : StatsTab (tendance des revenus, entonnoir) et OverviewTab (KPI)
  // en ont désormais besoin aussi, autant éviter un fetch en double.
  const loadSales = useCallback(async () => {
    const res = await fetch("/api/sales");
    if (!res.ok) return;
    const json = await res.json();
    setSales(json.sales || []);
  }, []);

  useEffect(() => {
    refresh();
    loadSales();
  }, [refresh, loadSales]);

  // Le service (Render, plan gratuit) peut s'être mis en veille — le tout
  // premier /api/me après une période d'inactivité peut prendre bien plus
  // longtemps qu'un chargement normal. Un squelette qui reste figé sans
  // explication laisse croire à une panne ; on ajoute un indice après un
  // délai plutôt que dès le premier instant (qui couvrirait aussi les
  // chargements normaux, rapides).
  const [slowLoading, setSlowLoading] = useState(false);
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setSlowLoading(true), 4000);
    return () => {
      clearTimeout(t);
      setSlowLoading(false);
    };
  }, [loading]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  if (loading || !creator) {
    return <DashboardSkeleton slow={slowLoading} />;
  }

  const navItems = (
    <>
      {TABS.map((t) => (
        <NavButton key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>
          {t.label}
        </NavButton>
      ))}
    </>
  );

  return (
    <div className="flex-1 flex flex-col md:flex-row">
      {/* Sidebar — écrans md+ uniquement. Sur mobile on garde la barre
          d'onglets horizontale scrollable existante, plus adaptée au tactile
          qu'une sidebar rétractable pour la taille de cette app. */}
      <aside className="hidden md:flex md:w-56 md:flex-col md:shrink-0 border-r border-border">
        <div className="px-5 py-5 border-b border-border">
          <span className="font-semibold tracking-tight block">
            melii<span className="gradient-text">.</span>
          </span>
          <p className="text-xs text-muted mt-1 truncate">{creator.displayName || initialDisplayName}</p>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">{navItems}</nav>
        <div className="p-3 border-t border-border space-y-0.5">
          {isAdmin && (
            <button
              onClick={() => router.push("/admin")}
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-muted hover:text-foreground hover:bg-surface-2/60 transition"
            >
              Admin
            </button>
          )}
          <button
            onClick={logout}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-muted hover:text-foreground hover:bg-surface-2/60 transition"
          >
            Se déconnecter
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden border-b border-border">
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

        <div className="md:hidden mx-auto max-w-4xl w-full px-6 pt-6">
          <nav className="flex gap-1 border-b border-border overflow-x-auto">{navItems}</nav>
        </div>

        <main className="mx-auto max-w-4xl w-full flex-1 px-6 py-8">
          {tab === "overview" && (
            <OverviewTab
              creator={creator}
              tiers={tiers}
              stats={stats}
              isAdmin={isAdmin}
              onNavigate={setTab}
              onOpenAdmin={() => router.push("/admin")}
            />
          )}
          {tab === "chat" && <ChatLinkTab creator={creator} onChanged={refresh} />}
          {tab === "persona" && <PersonaTab creator={creator} onSaved={refresh} />}
          {tab === "liens" && <TiersTab tiers={tiers} onChanged={refresh} />}
          {tab === "telegram" && <TelegramTab creator={creator} onChanged={refresh} />}
          {tab === "stats" && <StatsTab stats={stats} tiers={tiers} sales={sales} />}
          {tab === "fans" && <FansTab />}
          {tab === "facturation" && (
            <BillingTab stats={stats} tiers={tiers} sales={sales} onDeclared={loadSales} onChanged={refresh} />
          )}
          {tab === "compte" && <AccountTab creator={creator} stats={stats} onChanged={refresh} />}
        </main>
      </div>
    </div>
  );
}

function NavButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`md:w-full text-left px-3 py-2.5 md:py-2 text-sm whitespace-nowrap rounded-t-lg md:rounded-lg transition ${
        active
          ? "text-foreground border-b-2 border-accent -mb-px font-medium md:border-b-0 md:mb-0 md:bg-surface-2"
          : "text-muted hover:text-foreground md:hover:bg-surface-2/60"
      }`}
    >
      {children}
    </button>
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

function DashboardSkeleton({ slow = false }: { slow?: boolean }) {
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
        {slow && (
          <p className="fade-in-up text-sm text-muted">
            Ça prend un peu plus longtemps que d&apos;habitude — le service se
            réveille après une période d&apos;inactivité, ça ne devrait plus être long.
          </p>
        )}
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

function OverviewTab({
  creator,
  tiers,
  stats,
  isAdmin,
  onNavigate,
  onOpenAdmin,
}: {
  creator: Creator;
  tiers: Tier[];
  stats: Stats | null;
  isAdmin: boolean;
  onNavigate: (tab: TabKey) => void;
  onOpenAdmin: () => void;
}) {
  const [flaggedCount, setFlaggedCount] = useState<number | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    fetch("/api/admin/moderation")
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setFlaggedCount((json.flagged || []).length);
      })
      .catch(() => {
        if (!cancelled) setFlaggedCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const totalClicks = stats ? Object.values(stats.clicksByTier).reduce((a, b) => a + b, 0) : 0;

  const checklist = [
    {
      key: "persona",
      done: (creator.personaBio || "").trim().length > 0,
      label: "Personnalisez le ton et la bio de votre bot",
    },
    {
      key: "liens",
      done: tiers.length > 0,
      label: "Ajoutez au moins un palier de contenu",
    },
    {
      key: "chat",
      done: totalClicks > 0,
      label: "Partagez votre lien de chat avec votre communauté",
    },
    {
      key: "telegram",
      done: creator.telegramWebhookReady,
      label: "Connectez Telegram",
      optional: true,
    },
  ] as const;
  const doneCount = checklist.filter((c) => c.done).length;

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-lg font-medium mb-1">Vue d&apos;ensemble</h2>
        <p className="text-sm text-muted">Bonjour {creator.displayName} — voici où en est votre compte.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-xs text-muted">Clics (14 derniers jours)</p>
          <p className="text-2xl font-semibold mt-1">{totalClicks}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-muted">Ventes déclarées</p>
          <p className="text-2xl font-semibold mt-1">{stats ? eur(stats.totalDeclaredCents) : "–"}</p>
        </div>
        <div className="card p-5 col-span-2 sm:col-span-1">
          <p className="text-xs text-muted">Paliers actifs</p>
          <p className="text-2xl font-semibold mt-1">{tiers.length}</p>
        </div>
      </div>

      {doneCount < checklist.length && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Pour bien démarrer</p>
            <span className="text-xs text-muted">
              {doneCount}/{checklist.length}
            </span>
          </div>
          <ul className="space-y-1">
            {checklist.map((item) => (
              <li key={item.key}>
                <button
                  onClick={() => onNavigate(item.key as TabKey)}
                  className={`w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-lg transition ${
                    item.done ? "text-muted" : "hover:bg-surface-2"
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[10px] border ${
                      item.done
                        ? "bg-[var(--success-bg)] border-[var(--success)]/40 text-[var(--success)]"
                        : "border-border text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                  <span className={`text-sm ${item.done ? "line-through" : ""}`}>
                    {item.label}
                    {"optional" in item && item.optional && !item.done && (
                      <span className="text-muted"> (optionnel)</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isAdmin && (
        <button
          onClick={onOpenAdmin}
          className="card p-5 w-full flex items-center justify-between text-left hover:border-muted transition"
        >
          <div>
            <p className="text-sm font-medium">Panneau admin</p>
            <p className="text-xs text-muted mt-1">
              {flaggedCount === null
                ? "Chargement…"
                : flaggedCount > 0
                  ? `${flaggedCount} signalement(s) à vérifier`
                  : "Rien à signaler en ce moment"}
            </p>
          </div>
          <span className="text-muted" aria-hidden="true">
            →
          </span>
        </button>
      )}
    </div>
  );
}

// ------------------------------------------------------------------

function ChatLinkTab({ creator, onChanged }: { creator: Creator; onChanged: () => void }) {
  const toast = useToast();
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = origin ? `${origin}/c/${creator.slug || creator.id}` : "";

  const [slug, setSlug] = useState(creator.slug || "");
  const [savingSlug, setSavingSlug] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);

  const [customSource, setCustomSource] = useState("");
  const trackedSource = customSource.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  const trackedLink = link && trackedSource ? `${link}?src=${trackedSource}` : "";

  async function saveSlug() {
    setSavingSlug(true);
    setSlugError(null);
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
      toast("Lien mis à jour");
      onChanged();
    } finally {
      setSavingSlug(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-8 items-start">
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
              <CopyButton value={link} />
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
              {savingSlug ? "..." : "Valider"}
            </button>
          </div>
          {slugError && <p className="text-sm text-red-400">{slugError}</p>}
        </div>

        <div className="card p-5 space-y-3">
          <p className="text-sm font-medium">Liens trackés</p>
          <p className="text-xs text-muted">
            Ajoutez un tag à votre lien pour savoir d&apos;où viennent vos visites
            (bio Instagram, story, post...) — retrouvez la répartition dans
            l&apos;onglet Statistiques.
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_LINK_SOURCES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setCustomSource(s.value)}
                className={`rounded-full px-4 py-1.5 text-xs font-medium border transition ${
                  trackedSource === s.value
                    ? "border-accent text-foreground"
                    : "border-border text-muted hover:border-muted"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              className="input font-mono text-sm"
              value={customSource}
              onChange={(e) => setCustomSource(e.target.value)}
              placeholder="ou un tag personnalisé (ex. tiktok)"
            />
          </div>
          {trackedLink && (
            <div className="flex items-center gap-2">
              <input className="input font-mono text-xs" value={trackedLink} readOnly onFocus={(e) => e.target.select()} />
              <CopyButton value={trackedLink} />
            </div>
          )}
        </div>

        <p className="text-xs text-muted">
          Astuce : configurez d&apos;abord votre personnalité et vos paliers
          (onglets suivants) avant de partager le lien.
        </p>
      </div>

      <div className="lg:sticky lg:top-6">
        <p className="text-xs text-muted mb-2">Aperçu de ce que voit votre communauté</p>
        <BotPreview
          tone={creator.personaTone}
          name={creator.displayName}
          avatarUrl={creator.avatarUrl}
          accentColor={creator.accentColor}
        />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------

function PersonaTab({ creator, onSaved }: { creator: Creator; onSaved: () => void }) {
  const toast = useToast();
  const [displayName, setDisplayName] = useState(creator.displayName);
  const [tone, setTone] = useState(creator.personaTone);
  const [bio, setBio] = useState(creator.personaBio);
  const [language, setLanguage] = useState(creator.personaLanguage || "fr");
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
        body: JSON.stringify({ displayName, tone, bio, language }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Erreur lors de l'enregistrement.");
        return;
      }
      toast("Personnalité enregistrée");
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
      toast("Apparence enregistrée");
      onSaved();
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-8 items-start">
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
                type="button"
                onClick={() => setTone(t.value)}
                aria-pressed={tone === t.value}
                className={`card p-4 text-left transition flex items-center justify-between gap-2 ${
                  tone === t.value
                    ? "border-accent border-2 bg-surface-2"
                    : "hover:border-muted"
                }`}
              >
                <span className={`text-sm ${tone === t.value ? "font-semibold" : "font-medium"}`}>{t.label}</span>
                {tone === t.value && (
                  <span className="shrink-0 w-5 h-5 rounded-full gradient-btn text-white text-xs flex items-center justify-center">
                    ✓
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="block text-sm text-muted mb-2">Langue du bot</span>
          <div className="grid sm:grid-cols-3 gap-3">
            {LANGUAGES.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => setLanguage(l.value)}
                aria-pressed={language === l.value}
                className={`card p-4 text-left transition flex items-center justify-between gap-2 ${
                  language === l.value
                    ? "border-accent border-2 bg-surface-2"
                    : "hover:border-muted"
                }`}
              >
                <span className={`text-sm ${language === l.value ? "font-semibold" : "font-medium"}`}>{l.label}</span>
                {language === l.value && (
                  <span className="shrink-0 w-5 h-5 rounded-full gradient-btn text-white text-xs flex items-center justify-center">
                    ✓
                  </span>
                )}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted mt-2">
            Le bot répond dans cette langue par défaut — s&apos;il reçoit un message
            dans une autre langue, il peut naturellement basculer pour répondre
            dans la langue de la personne.
          </p>
        </div>

        <label className="block">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm text-muted">Bio / contexte (optionnel, visible seulement par le bot)</span>
            <span className={`text-xs ${bio.length > BIO_MAX_LENGTH * 0.9 ? "text-[var(--warning)]" : "text-muted"}`}>
              {bio.length}/{BIO_MAX_LENGTH}
            </span>
          </div>
          <textarea
            className="input min-h-28"
            value={bio}
            maxLength={BIO_MAX_LENGTH}
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

      <div className="lg:sticky lg:top-6">
        <p className="text-xs text-muted mb-2">Aperçu en direct</p>
        <BotPreview tone={tone} name={displayName} avatarUrl={avatarUrl} accentColor={accentColor} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------

function TiersTab({ tiers, onChanged }: { tiers: Tier[]; onChanged: () => void }) {
  const toast = useToast();
  const { confirm, modal } = useConfirm();

  const [label, setLabel] = useState("");
  const [priceEuros, setPriceEuros] = useState("");
  const [url, setUrl] = useState("");
  const [sellAngle, setSellAngle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editPriceEuros, setEditPriceEuros] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editSellAngle, setEditSellAngle] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [reorderingId, setReorderingId] = useState<string | null>(null);

  const sorted = tiers.slice().sort((a, b) => a.order - b.order);
  const nextOrder = tiers.length ? Math.max(...tiers.map((t) => t.order)) + 1 : 1;

  async function upsert(body: { order: number; label: string; priceEuros: number; url: string; sellAngle?: string }) {
    const res = await fetch("/api/tiers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Erreur lors de l'enregistrement.");
    return json;
  }

  async function addTier() {
    setSaving(true);
    setError(null);
    try {
      await upsert({ order: nextOrder, label, priceEuros: Number(priceEuros), url, sellAngle });
      setLabel("");
      setPriceEuros("");
      setUrl("");
      setSellAngle("");
      toast("Palier ajouté");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de l'ajout.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(t: Tier) {
    setEditingId(t.id);
    setEditLabel(t.label);
    setEditPriceEuros(String(t.priceCents / 100));
    setEditUrl(t.url);
    setEditSellAngle(t.sellAngle || "");
    setEditError(null);
  }

  async function saveEdit(t: Tier) {
    setSavingEdit(true);
    setEditError(null);
    try {
      await upsert({
        order: t.order,
        label: editLabel,
        priceEuros: Number(editPriceEuros),
        url: editUrl,
        sellAngle: editSellAngle,
      });
      toast("Palier mis à jour");
      setEditingId(null);
      onChanged();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Erreur lors de l'enregistrement.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function moveTier(t: Tier, dir: -1 | 1) {
    const idx = sorted.findIndex((x) => x.id === t.id);
    const other = sorted[idx + dir];
    if (!other) return;
    setReorderingId(t.id);
    try {
      await Promise.all([
        upsert({
          order: t.order,
          label: other.label,
          priceEuros: other.priceCents / 100,
          url: other.url,
          sellAngle: other.sellAngle,
        }),
        upsert({
          order: other.order,
          label: t.label,
          priceEuros: t.priceCents / 100,
          url: t.url,
          sellAngle: t.sellAngle,
        }),
      ]);
      toast("Ordre mis à jour");
      onChanged();
    } catch {
      toast("Erreur lors du réordonnancement.", "error");
    } finally {
      setReorderingId(null);
    }
  }

  async function removeTier(t: Tier) {
    const ok = await confirm(`Supprimer le palier « ${t.label} » ?`, "Cette action est définitive.");
    if (!ok) return;
    await fetch(`/api/tiers/${t.id}`, { method: "DELETE" });
    toast("Palier supprimé");
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

      {sorted.length === 0 ? (
        <EmptyState icon="🔗" title="Aucun palier pour l'instant." hint="Ajoutez votre premier palier ci-dessous." />
      ) : (
        <ul className="space-y-3">
          {sorted.map((t, idx) => (
            <li key={t.id} className="card p-4">
              {editingId === t.id ? (
                <div className="space-y-3">
                  <label className="block">
                    <span className="block text-xs text-muted mb-1">Libellé</span>
                    <input className="input" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="block text-xs text-muted mb-1">Prix (€)</span>
                      <input
                        className="input"
                        type="number"
                        min="0.5"
                        step="0.5"
                        value={editPriceEuros}
                        onChange={(e) => setEditPriceEuros(e.target.value)}
                      />
                    </label>
                    <label className="block">
                      <span className="block text-xs text-muted mb-1">Lien de paiement</span>
                      <input className="input" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} />
                    </label>
                  </div>
                  <label className="block">
                    <span className="block text-xs text-muted mb-1">
                      Comment le bot doit vendre ce palier (facultatif)
                    </span>
                    <textarea
                      className="input min-h-[70px] resize-y"
                      value={editSellAngle}
                      onChange={(e) => setEditSellAngle(e.target.value)}
                      placeholder="Ex : insiste sur l'exclusivité, contenu qu'on ne trouve nulle part ailleurs"
                      maxLength={400}
                    />
                  </label>
                  {editError && <p className="text-sm text-red-400">{editError}</p>}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => saveEdit(t)}
                      disabled={savingEdit || !editLabel || !editPriceEuros || !editUrl}
                      className="gradient-btn rounded-full px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
                    >
                      {savingEdit ? "..." : "Enregistrer"}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-sm text-muted hover:text-foreground transition"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex flex-col -space-y-1">
                      <button
                        onClick={() => moveTier(t, -1)}
                        disabled={idx === 0 || reorderingId !== null}
                        aria-label="Monter ce palier"
                        className="text-muted hover:text-foreground disabled:opacity-25 disabled:cursor-not-allowed leading-none text-[10px] px-1 py-0.5"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveTier(t, 1)}
                        disabled={idx === sorted.length - 1 || reorderingId !== null}
                        aria-label="Descendre ce palier"
                        className="text-muted hover:text-foreground disabled:opacity-25 disabled:cursor-not-allowed leading-none text-[10px] px-1 py-0.5"
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      Palier {t.order} — {t.label}
                    </p>
                    <p className="text-xs text-muted truncate">{t.url}</p>
                    {t.sellAngle && (
                      <p className="text-xs text-muted/80 italic mt-0.5 line-clamp-1">
                        Argument : {t.sellAngle}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm gradient-text font-medium">{eur(t.priceCents)}</span>
                    <CopyButton
                      value={t.url}
                      className="text-xs text-muted hover:text-foreground transition rounded-full border border-border hover:border-muted px-3 py-1.5"
                    />
                    <button
                      onClick={() => startEdit(t)}
                      className="text-xs text-muted hover:text-foreground transition"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => removeTier(t)}
                      className="text-xs text-muted hover:text-red-400 transition"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

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
        <label className="block">
          <span className="block text-sm text-muted mb-1.5">
            Comment le bot doit vendre ce palier (facultatif)
          </span>
          <textarea
            className="input min-h-[70px] resize-y"
            value={sellAngle}
            onChange={(e) => setSellAngle(e.target.value)}
            placeholder="Ex : insiste sur l'exclusivité, contenu qu'on ne trouve nulle part ailleurs"
            maxLength={400}
          />
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
      {modal}
    </div>
  );
}

// ------------------------------------------------------------------

function TelegramTab({ creator, onChanged }: { creator: Creator; onChanged: () => void }) {
  const toast = useToast();
  const { confirm, modal } = useConfirm();
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingRelance, setSavingRelance] = useState(false);
  const [testing, setTesting] = useState(false);

  async function toggleRelance() {
    setSavingRelance(true);
    try {
      await fetch("/api/relance", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: !creator.relanceEnabled }),
      });
      toast(creator.relanceEnabled ? "Relances désactivées" : "Relances activées");
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
      toast("Bot Telegram connecté");
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    const ok = await confirm("Déconnecter votre bot Telegram ?", "Votre chat en ligne continuera de fonctionner normalement.");
    if (!ok) return;
    await fetch("/api/telegram/connect", { method: "DELETE" });
    toast("Bot Telegram déconnecté");
    onChanged();
  }

  async function testConnection() {
    setTesting(true);
    try {
      const res = await fetch("/api/telegram/test", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        toast(json.error || "Le test a échoué.", "error");
        return;
      }
      toast(`Connexion OK — @${json.username}`);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium mb-1">Connexion Telegram</h2>
          <p className="text-sm text-muted">
            Optionnel — votre chat en ligne (onglet précédent) fonctionne déjà
            sans ça. Connectez Telegram en plus si vous voulez aussi être
            jointe depuis l&apos;app Telegram.
          </p>
        </div>
        <StatusPill tone={creator.telegramWebhookReady ? "success" : "neutral"}>
          {creator.telegramWebhookReady ? "Connecté" : "Non connecté"}
        </StatusPill>
      </div>

      {!creator.telegramWebhookReady && (
        <ol className="space-y-2 text-sm text-muted list-none">
          <li className="flex gap-2.5">
            <span className="shrink-0 w-5 h-5 rounded-full bg-surface-2 text-xs flex items-center justify-center text-foreground">1</span>
            Ouvrez{" "}
            <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="underline underline-offset-4">
              @BotFather
            </a>{" "}
            sur Telegram.
          </li>
          <li className="flex gap-2.5">
            <span className="shrink-0 w-5 h-5 rounded-full bg-surface-2 text-xs flex items-center justify-center text-foreground">2</span>
            Envoyez <code className="text-xs">/newbot</code> et suivez les instructions (nom, identifiant).
          </li>
          <li className="flex gap-2.5">
            <span className="shrink-0 w-5 h-5 rounded-full bg-surface-2 text-xs flex items-center justify-center text-foreground">3</span>
            Copiez le token fourni et collez-le ci-dessous. Personne d&apos;autre que vous ne le voit.
          </li>
        </ol>
      )}

      {creator.telegramWebhookReady ? (
        <div className="card p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">@{creator.telegramBotUsername}</p>
            <p className="text-xs text-muted mt-1">
              Partagez le lien{" "}
              <code className="text-xs">t.me/{creator.telegramBotUsername}</code> avec
              votre communauté.
            </p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <button
              onClick={testConnection}
              disabled={testing}
              className="text-sm text-muted hover:text-foreground transition disabled:opacity-60"
            >
              {testing ? "Test..." : "Tester la connexion"}
            </button>
            <button onClick={disconnect} className="text-sm text-muted hover:text-red-400 transition">
              Déconnecter
            </button>
          </div>
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
      {modal}
    </div>
  );
}

// ------------------------------------------------------------------

type FanSummary = {
  chatId: string;
  messageCount: number;
  firstSeenAt: string;
  lastActiveAt: string;
  notes: string;
  potential: string | null;
};

// "il y a 2h" plutôt qu'une date brute — plus rapide à scanner pour repérer
// d'un coup d'œil qui a écrit récemment dans une liste de fans.
function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `il y a ${days}j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

const POTENTIAL_STYLES: Record<string, string> = {
  élevé: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  moyen: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  faible: "bg-surface-2 text-muted border border-border",
};

function FansTab() {
  const [fans, setFans] = useState<FanSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/fans")
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setFans(json.fans || []);
      })
      .catch(() => {
        if (!cancelled) setFans([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-medium mb-1">Fans</h2>
        <p className="text-sm text-muted">
          Ce que le bot retient de chaque conversation — utile pour savoir qui
          est engagé et à qui parler en priorité. Les notes et le potentiel se
          mettent à jour automatiquement au fil de la conversation, pas en
          temps réel : laissez à une nouvelle discussion quelques échanges
          avant de la voir apparaître ici.
        </p>
      </div>

      {fans === null && (
        <div className="space-y-3">
          <div className="h-20 rounded-xl bg-surface-2 animate-pulse" />
          <div className="h-20 rounded-xl bg-surface-2 animate-pulse" />
        </div>
      )}

      {fans !== null && fans.length === 0 && (
        <EmptyState
          icon="💬"
          title="Pas encore de conversation"
          hint="Dès que quelqu'un discute avec votre bot, il apparaîtra ici avec un résumé de ce qu'il retient de la conversation."
        />
      )}

      {fans !== null && fans.length > 0 && (
        <div className="space-y-3">
          {fans.map((f) => (
            <div key={f.chatId} className="card p-4 space-y-2">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">
                    {f.messageCount} message{f.messageCount > 1 ? "s" : ""}
                  </span>
                  <span className="text-xs text-muted">· actif {timeAgo(f.lastActiveAt)}</span>
                </div>
                {f.potential && (
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${
                      POTENTIAL_STYLES[f.potential] || POTENTIAL_STYLES.faible
                    }`}
                  >
                    Potentiel {f.potential}
                  </span>
                )}
              </div>
              {f.notes ? (
                <p className="text-sm text-muted">{f.notes}</p>
              ) : (
                <p className="text-xs text-muted italic">
                  Pas encore assez d&apos;échanges pour un résumé.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const PERIODS = [7, 14, 30, 90] as const;

function StatsTab({ stats: initialStats, tiers, sales }: { stats: Stats | null; tiers: Tier[]; sales: Sale[] }) {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(14);
  // Le chargement par défaut (14j, via /api/me) arrive déjà avec le reste du
  // dashboard — on ne refetch que si la créatrice choisit une autre période,
  // et on ne duplique jamais `initialStats` dans un state local : `stats`
  // plus bas est calculé directement plutôt que "miroité" par un effet.
  const [fetchedStats, setFetchedStats] = useState<Stats | null>(null);
  const [loadingPeriod, setLoadingPeriod] = useState(false);

  useEffect(() => {
    if (days === 14) return;
    let cancelled = false;
    setLoadingPeriod(true);
    fetch(`/api/stats?days=${days}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setFetchedStats(json.stats);
      })
      .finally(() => {
        if (!cancelled) setLoadingPeriod(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  const stats = days === 14 ? initialStats : fetchedStats;
  if (!stats) return null;
  const totalClicks = Object.values(stats.clicksByTier).reduce((a, b) => a + b, 0);
  const clicksWindow = (stats.clicksByDay || []).reduce((a, d) => a + d.clicks, 0);

  const clicksByDay = stats.clicksByDay || [];
  const salesByDay = clicksByDay.map((d) => {
    const cents = sales
      .filter((s) => s.declaredAt.slice(0, 10) === d.day)
      .reduce((sum, s) => sum + s.amountCents, 0);
    return { day: d.day, value: cents };
  });
  const salesInWindow = clicksByDay.length
    ? sales.filter((s) => s.declaredAt.slice(0, 10) >= clicksByDay[0].day)
    : [];

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-medium mb-1">Statistiques</h2>
          <p className="text-sm text-muted">
            Clics enregistrés quand quelqu&apos;un clique vraiment sur un de vos liens
            (pas seulement quand le bot le propose).
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-border p-1 shrink-0">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setDays(p)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                days === p ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              {p}j
            </button>
          ))}
        </div>
      </div>

      <div className={`space-y-8 transition-opacity ${loadingPeriod ? "opacity-50" : ""}`}>
        <div className="grid grid-cols-2 gap-4">
          <div className="card p-5">
            <p className="text-xs text-muted">Total des clics</p>
            <p className="text-2xl font-semibold mt-1">{totalClicks}</p>
          </div>
          <div className="card p-5">
            <p className="text-xs text-muted">Sur les {days} derniers jours</p>
            <p className="text-2xl font-semibold mt-1">{clicksWindow}</p>
          </div>
        </div>

        <div className="card p-5">
          <p className="text-sm font-medium mb-4">Clics par jour ({days} derniers jours)</p>
          <ClicksChart data={clicksByDay} />
        </div>

        <div className="card p-5">
          <p className="text-sm font-medium mb-4">Revenus déclarés par jour ({days} derniers jours)</p>
          <RevenueTrendChart data={salesByDay} />
        </div>

        <div className="card p-5">
          <p className="text-sm font-medium mb-4">Entonnoir clics → ventes</p>
          <ConversionFunnel clicks={clicksWindow} sales={salesInWindow.length} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="card p-5">
            <p className="text-xs text-muted">Nouveaux fans</p>
            <p className="text-2xl font-semibold mt-1">{stats.fanSegmentation?.newFans ?? 0}</p>
            <p className="text-xs text-muted mt-1">Premier message sur les {days} derniers jours</p>
          </div>
          <div className="card p-5">
            <p className="text-xs text-muted">Fans récurrents</p>
            <p className="text-2xl font-semibold mt-1">{stats.fanSegmentation?.returningFans ?? 0}</p>
            <p className="text-xs text-muted mt-1">Actifs, mais déjà écrit avant cette période</p>
          </div>
        </div>

        {stats.visitsBySource && stats.visitsBySource.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-3">Sources de trafic ({days} derniers jours)</p>
            <ul className="space-y-3">
              {(() => {
                const totalVisits = stats.visitsBySource.reduce((a, s) => a + s.visits, 0);
                return stats.visitsBySource.map((s) => {
                  const pct = totalVisits > 0 ? Math.round((s.visits / totalVisits) * 100) : 0;
                  return (
                    <li key={s.source} className="card p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm capitalize">{s.source}</span>
                        <span className="text-sm font-medium">{s.visits} visite(s)</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                        <div
                          className="h-full gradient-btn rounded-full transition-[width]"
                          style={{ width: `${Math.max(pct, s.visits > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                    </li>
                  );
                });
              })()}
            </ul>
          </div>
        )}

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
    </div>
  );
}

// Petit graphique en barres en SVG pur — pas de librairie de charts pour
// quelques barres, ça alourdirait le bundle pour rien. `viewBox` fixe permet
// un rendu net à n'importe quelle taille d'écran (voir width="100%"). Une
// seule teinte (dégradé --accent → --accent-2) car ces barres encodent une
// magnitude, pas des catégories — voir la référence dataviz du projet.
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
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" role="img" aria-label="Clics par jour">
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

// Même anatomie que ClicksChart (une seule teinte séquentielle, survol via
// <title>) appliquée aux revenus déclarés — même langage visuel pour deux
// métriques de magnitude, plutôt qu'inventer un second style de graphique.
function RevenueTrendChart({ data }: { data: { day: string; value: number }[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted">Pas encore de données.</p>;
  }
  const hasAny = data.some((d) => d.value > 0);
  if (!hasAny) {
    return <p className="text-sm text-muted">Aucune vente déclarée sur cette période.</p>;
  }

  const width = 600;
  const height = 140;
  const padding = 4;
  const max = Math.max(1, ...data.map((d) => d.value));
  const barGap = 6;
  const barWidth = (width - barGap * (data.length - 1)) / data.length;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" role="img" aria-label="Revenus déclarés par jour">
        <defs>
          <linearGradient id="revenueBarGradient" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent-2)" />
          </linearGradient>
        </defs>
        {data.map((d, i) => {
          const barHeight = d.value > 0 ? Math.max(4, (d.value / max) * (height - padding * 2)) : 2;
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
              fill={d.value > 0 ? "url(#revenueBarGradient)" : "var(--border)"}
            >
              <title>
                {new Date(d.day + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} —{" "}
                {eur(d.value)}
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

function ConversionFunnel({ clicks, sales }: { clicks: number; sales: number }) {
  const max = Math.max(clicks, sales, 1);
  const rate = clicks > 0 ? Math.round((sales / clicks) * 100) : 0;
  return (
    <div className="space-y-4">
      <FunnelRow label="Clics sur un palier" value={clicks} max={max} />
      <FunnelRow label="Ventes déclarées" value={sales} max={max} />
      <p className="text-xs text-muted">
        Taux de conversion estimé : {rate}% — basé sur vos déclarations, pas un suivi
        automatique des paiements.
      </p>
    </div>
  );
}

function FunnelRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 4 : 0) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 text-sm">
        <span className="text-muted">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
        <div className="h-full gradient-btn rounded-full transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------

const HISTORY_PERIODS = [
  { value: "all", label: "Tout" },
  { value: "7", label: "7 jours" },
  { value: "30", label: "30 jours" },
  { value: "90", label: "90 jours" },
] as const;

function BillingTab({
  stats,
  tiers,
  sales,
  onDeclared,
  onChanged,
}: {
  stats: Stats | null;
  tiers: Tier[];
  sales: Sale[];
  onDeclared: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [tierId, setTierId] = useState(tiers[0]?.id || "");
  const [amountEuros, setAmountEuros] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filterTier, setFilterTier] = useState("all");
  const [filterPeriod, setFilterPeriod] = useState<(typeof HISTORY_PERIODS)[number]["value"]>("all");

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
      toast("Vente déclarée");
      onDeclared();
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  const filteredSales = sales.filter((s) => {
    if (filterTier !== "all" && s.tierId !== filterTier) return false;
    if (filterPeriod !== "all") {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - Number(filterPeriod));
      if (new Date(s.declaredAt) < cutoff) return false;
    }
    return true;
  });

  const referralDiscountCount = Math.min(stats?.referralCount ?? 0, REFERRAL_DISCOUNT_CAP_COUNT);

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

      {stats && (
        <div className="card p-5 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Réduction parrainage</span>
            <span className="text-muted">
              -{referralDiscountCount} pt{referralDiscountCount > 1 ? "s" : ""} / -{REFERRAL_DISCOUNT_CAP_COUNT} pts max
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
            <div
              className="h-full gradient-btn rounded-full transition-[width]"
              style={{ width: `${(referralDiscountCount / REFERRAL_DISCOUNT_CAP_COUNT) * 100}%` }}
            />
          </div>
          <p className="text-xs text-muted">
            {stats.referralCount > 0
              ? `${stats.referralCount} créatrice(s) parrainée(s) — voir l'onglet Compte pour votre lien.`
              : "Parrainez d'autres créatrices pour réduire votre commission — voir l'onglet Compte."}
          </p>
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
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
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

        {sales.length > 0 && (
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <select
              className="input !py-1.5 !text-xs w-auto"
              value={filterTier}
              onChange={(e) => setFilterTier(e.target.value)}
            >
              <option value="all">Tous les paliers</option>
              {tiers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <select
              className="input !py-1.5 !text-xs w-auto"
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value as typeof filterPeriod)}
            >
              {HISTORY_PERIODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <ul className="space-y-2">
          {filteredSales.map((s) => (
            <li key={s.id} className="card p-3 flex items-center justify-between text-sm">
              <span>{s.tierLabel}</span>
              <span className="text-muted">{new Date(s.declaredAt).toLocaleDateString("fr-FR")}</span>
              <span className="font-medium">{eur(s.amountCents)}</span>
            </li>
          ))}
          {sales.length === 0 && <p className="text-sm text-muted">Aucune vente déclarée.</p>}
          {sales.length > 0 && filteredSales.length === 0 && (
            <p className="text-sm text-muted">Aucune vente ne correspond à ces filtres.</p>
          )}
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
        <p className="text-sm text-muted mb-4">Sécurité, parrainage et domaine personnalisé.</p>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusPill tone={creator.totpEnabled ? "success" : "neutral"}>
            2FA {creator.totpEnabled ? "activé" : "désactivé"}
          </StatusPill>
          <StatusPill tone={creator.telegramWebhookReady ? "success" : "neutral"}>
            Telegram {creator.telegramWebhookReady ? "connecté" : "non connecté"}
          </StatusPill>
          {creator.customDomain && (
            <StatusPill tone={creator.customDomainVerified ? "success" : "warning"}>
              Domaine {creator.customDomainVerified ? "vérifié" : "en attente"}
            </StatusPill>
          )}
        </div>
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
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = origin && creator.referralCode ? `${origin}/signup?ref=${creator.referralCode}` : "";

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
            <CopyButton value={link} />
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
  const toast = useToast();
  const { confirm, modal } = useConfirm();
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
      toast("2FA activé");
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
    const ok = await confirm("Désactiver le 2FA ?", "Votre compte sera protégé uniquement par votre mot de passe.");
    if (!ok) return;
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
      toast("2FA désactivé");
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
      {modal}
    </div>
  );
}

function CustomDomainSection({ creator, onChanged }: { creator: Creator; onChanged: () => void }) {
  const toast = useToast();
  const { confirm, modal } = useConfirm();
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
      toast("Domaine enregistré — ajoutez l'enregistrement DNS ci-dessous");
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function removeDomain() {
    const ok = await confirm("Retirer ce domaine personnalisé ?");
    if (!ok) return;
    setSaving(true);
    try {
      await fetch("/api/custom-domain", { method: "DELETE" });
      setDomain("");
      setChallengeHost(null);
      toast("Domaine retiré");
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
      if (json.verified) {
        toast("Domaine vérifié !");
      }
      setVerifyMessage(json.verified ? "Domaine vérifié !" : json.error || "Pas encore trouvé.");
      onChanged();
    } finally {
      setVerifying(false);
    }
  }

  const step = creator.customDomainVerified ? 3 : challengeHost ? 2 : 1;

  return (
    <div>
      <h3 className="text-base font-medium mb-1">Domaine personnalisé</h3>
      <p className="text-sm text-muted mb-4">
        Optionnel, plus technique — remplacez le lien melii.../c/... par votre propre
        domaine (ex. lunabot.com).
      </p>

      <div className="card p-5 space-y-5">
        <div className="flex gap-2.5">
          <StepBadge n={1} done={step > 1} active={step === 1} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium mb-2">Enregistrer votre domaine</p>
            <div className="flex items-center gap-2">
              <input
                className="input"
                value={domain}
                onChange={(e) => setDomain(e.target.value.toLowerCase())}
                placeholder="lunabot.com"
                disabled={step > 1}
              />
              {step === 1 && (
                <button
                  onClick={saveDomain}
                  disabled={saving || !domain}
                  className="gradient-btn rounded-full px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60 shrink-0"
                >
                  {saving ? "..." : "Enregistrer"}
                </button>
              )}
            </div>
            {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
          </div>
        </div>

        {challengeHost && (
          <div className="flex gap-2.5">
            <StepBadge n={2} done={step > 2} active={step === 2} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium mb-2">Ajouter l&apos;enregistrement DNS</p>
              {!creator.customDomainVerified ? (
                <div className="rounded-xl bg-surface-2 p-4 space-y-1.5 text-sm">
                  <p className="text-muted text-xs mb-2">
                    Chez votre registrar (la propagation peut prendre quelques heures) :
                  </p>
                  <p className="font-mono text-xs break-all">Type : TXT</p>
                  <p className="font-mono text-xs break-all">Hôte : {challengeHost}</p>
                  <p className="font-mono text-xs break-all">Valeur : {creator.customDomainVerifyToken}</p>
                </div>
              ) : (
                <p className="text-sm text-muted">Enregistrement ajouté.</p>
              )}
            </div>
          </div>
        )}

        {challengeHost && (
          <div className="flex gap-2.5">
            <StepBadge n={3} done={creator.customDomainVerified} active={step === 3 && !creator.customDomainVerified} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium mb-2">Vérifier</p>
              {creator.customDomainVerified ? (
                <p className="text-sm text-emerald-300">Domaine vérifié et actif.</p>
              ) : (
                <>
                  <button
                    onClick={verify}
                    disabled={verifying}
                    className="rounded-full px-5 py-2 text-xs font-medium border border-border hover:border-muted transition disabled:opacity-60"
                  >
                    {verifying ? "Vérification..." : "Vérifier"}
                  </button>
                  {verifyMessage && <p className="text-muted text-sm mt-2">{verifyMessage}</p>}
                </>
              )}
            </div>
          </div>
        )}

        {creator.customDomain && (
          <button onClick={removeDomain} disabled={saving} className="text-sm text-muted hover:text-red-400 transition">
            Retirer le domaine
          </button>
        )}
      </div>
      {modal}
    </div>
  );
}

function StepBadge({ n, done, active }: { n: number; done: boolean; active: boolean }) {
  return (
    <span
      className={`shrink-0 w-6 h-6 rounded-full text-xs flex items-center justify-center font-medium ${
        done
          ? "bg-[var(--success-bg)] text-[var(--success)]"
          : active
            ? "bg-surface-2 text-foreground border border-accent"
            : "bg-surface-2 text-muted"
      }`}
    >
      {done ? "✓" : n}
    </span>
  );
}
