import Link from "next/link";

const STEPS = [
  {
    title: "1. Configurez votre bot",
    text: "Choisissez un ton (doux, direct, joueur...), écrivez votre bio, et empilez vos paliers de liens : 5 €, 10 €, 20 €... chacun avec son propre lien de paiement.",
  },
  {
    title: "2. Connectez Telegram",
    text: "Un token gratuit obtenu en 2 minutes auprès de @BotFather. On s'occupe du reste — pas une ligne de code à écrire.",
  },
  {
    title: "3. Partagez votre lien",
    text: "Votre communauté clique, discute avec votre bot à votre image, et découvre vos offres dans l'ordre — du moins cher au plus engageant.",
  },
];

const EXAMPLE_TIERS = [
  { label: "Accès photos exclusives", price: "5 €" },
  { label: "Contenu vidéo privé", price: "10 €" },
  { label: "Expérience VIP complète", price: "25 €" },
];

const TONES = [
  { name: "Doux & complice", desc: "Chaleureux, construit une vraie connexion avant de vendre." },
  { name: "Direct & vendeur", desc: "Va droit au but, met en avant les offres rapidement." },
  { name: "Joueur & taquin", desc: "Beaucoup d'humour, laisse deviner avant de révéler les liens." },
];

export default function LandingPage() {
  return (
    <main className="flex-1">
      <Nav />

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 text-sm text-muted mb-8">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.6)]" />
          Bot actif — répond en quelques secondes
        </div>
        <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight leading-[1.05]">
          Votre communauté mérite
          <br />
          <span className="gradient-text">un bot à votre image</span>
        </h1>
        <p className="mt-6 text-lg text-muted max-w-2xl mx-auto">
          Melii donne à chaque créatrice un chatbot IA sur Telegram, entraîné sur sa
          personnalité, qui fait découvrir son contenu exclusif palier par palier —
          pendant qu'elle se concentre sur le reste.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/signup"
            className="gradient-btn rounded-full px-7 py-3 font-medium text-white shadow-lg shadow-accent/20 hover:opacity-90 transition"
          >
            Créer mon bot
          </Link>
          <Link
            href="/login"
            className="rounded-full px-7 py-3 font-medium border border-border hover:bg-surface transition"
          >
            J'ai déjà un compte
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-2xl font-semibold text-center mb-2">Comment ça marche</h2>
        <p className="text-muted text-center mb-12">Trois étapes, aucune compétence technique requise.</p>
        <div className="grid sm:grid-cols-3 gap-6">
          {STEPS.map((s) => (
            <div key={s.title} className="card p-6">
              <h3 className="font-medium mb-2">{s.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tiers example */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="card glow p-8 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-2xl font-semibold mb-3">Des paliers qui montent en valeur</h2>
            <p className="text-muted mb-6 leading-relaxed">
              Le bot propose toujours le lien le moins cher en premier, puis avance
              naturellement vers vos offres suivantes au fil de la conversation —
              jamais tout d'un coup, jamais en spammant.
            </p>
            <ul className="space-y-3">
              {EXAMPLE_TIERS.map((t, i) => (
                <li key={t.label} className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-4 py-3">
                  <span className="text-sm">
                    <span className="text-muted mr-2">Palier {i + 1}</span>
                    {t.label}
                  </span>
                  <span className="font-medium gradient-text">{t.price}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card bg-surface-2 p-6">
            <p className="text-xs uppercase tracking-wide text-muted mb-3">Aperçu conversation</p>
            <div className="space-y-3 text-sm">
              <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-surface px-4 py-2">
                Hey toi 😊 contente que tu sois là, tu viens d'où ?
              </div>
              <div className="max-w-[85%] ml-auto rounded-2xl rounded-br-sm gradient-btn px-4 py-2 text-white">
                Salut ! Je te découvre à l'instant
              </div>
              <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-surface px-4 py-2">
                J'ai posté un truc que tu vas adorer aujourd'hui... je te montre ? 👀
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tones */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-2xl font-semibold text-center mb-2">Choisissez un script de départ</h2>
        <p className="text-muted text-center mb-12">
          Trois personnalités prêtes à l'emploi, personnalisables en quelques clics.
        </p>
        <div className="grid sm:grid-cols-3 gap-6">
          {TONES.map((t) => (
            <div key={t.name} className="card p-6">
              <h3 className="font-medium mb-2">{t.name}</h3>
              <p className="text-sm text-muted leading-relaxed">{t.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust / guardrails */}
      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h2 className="text-2xl font-semibold mb-4">Un cadre pensé pour durer</h2>
        <p className="text-muted leading-relaxed">
          Chaque bot Melii intègre des règles non modifiables : honnêteté si on lui
          demande sincèrement s'il s'agit d'une IA, aucun contenu explicite généré
          dans le chat, et une coupure automatique du ton commercial en cas de
          détresse réelle ou de signal d'âge mineur. C'est ce qui protège votre
          communauté — et votre compte.
        </p>
      </section>

      {/* Pricing model of the platform itself */}
      <section className="mx-auto max-w-3xl px-6 py-16">
        <div className="card p-8 text-center">
          <h2 className="text-2xl font-semibold mb-3">Aucun abonnement fixe</h2>
          <p className="text-muted leading-relaxed">
            Melii se rémunère uniquement à la commission sur les ventes déclarées.
            Pas de vente, pas de frais. Vous gardez vos liens de paiement existants
            (Dropfans ou autre) — on ne touche jamais à vos fonds.
          </p>
        </div>
      </section>

      <footer className="mx-auto max-w-5xl px-6 py-10 text-center text-sm text-muted">
        Réservé aux créatrices majeures. En vous inscrivant, vous confirmez avoir
        18 ans ou plus et respecter les conditions des plateformes que vous utilisez.
      </footer>
    </main>
  );
}

function Nav() {
  return (
    <header className="mx-auto max-w-5xl px-6 py-6 flex items-center justify-between">
      <span className="font-semibold text-lg tracking-tight">
        melii<span className="gradient-text">.</span>
      </span>
      <div className="flex items-center gap-4 text-sm">
        <Link href="/login" className="text-muted hover:text-foreground transition">
          Connexion
        </Link>
        <Link
          href="/signup"
          className="rounded-full border border-border px-4 py-2 hover:bg-surface transition"
        >
          Créer mon bot
        </Link>
      </div>
    </header>
  );
}
