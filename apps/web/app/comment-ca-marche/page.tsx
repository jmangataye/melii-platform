import Link from "next/link";

export const metadata = { title: "Comment ça marche — Melii" };

const STEPS = [
  {
    title: "1. Vous créez votre compte",
    text: "Email, mot de passe, prénom affiché. Confirmez avoir 18 ans ou plus. Un essai de 4 jours démarre automatiquement — aucune carte requise pour commencer.",
  },
  {
    title: "2. Vous configurez votre bot",
    text: "Dans l'onglet « Personnalité » : choisissez un ton (doux, direct, joueur), écrivez une bio courte pour donner du contexte au bot. Dans « Liens & tarifs » : ajoutez vos paliers, du moins cher au plus engageant, chacun avec le lien de paiement que vous utilisez déjà (Dropfans ou autre — Melii ne touche jamais à vos fonds).",
  },
  {
    title: "3. Vous récupérez votre lien de chat",
    text: "Onglet « Chat en ligne » : votre lien public (melii-foor.onrender.com/c/votre-id) est actif immédiatement. Copiez-le dans votre bio Instagram, Linktree, ou où vous voulez.",
  },
  {
    title: "4. Votre communauté discute avec le bot",
    text: "Un visiteur clique sur votre lien, discute avec un bot qui a votre ton et votre personnalité, et découvre vos offres naturellement au fil de la conversation — jamais tout d'un coup.",
  },
  {
    title: "5. Vous suivez les ventes et déclarez la commission",
    text: "Onglet « Statistiques » : clics par palier, ventes déclarées. Chaque vente conclue via un lien Melii se déclare manuellement pour l'instant (montant + palier) — la commission due est calculée automatiquement.",
  },
];

const FAQ = [
  {
    q: "Ai-je besoin de Telegram ?",
    a: "Non. Le chat en ligne fonctionne seul, sans rien connecter. Telegram reste disponible en option si vous voulez aussi être jointe depuis l'app.",
  },
  {
    q: "Que se passe-t-il après les 4 jours d'essai ?",
    a: "Le passage à un plan payant se fera via un abonnement mensuel indexé sur le volume de conversations gérées par votre bot — cette partie est en cours de finalisation, vous serez prévenue avant toute mise en place.",
  },
  {
    q: "Le bot peut-il générer du contenu explicite ?",
    a: "Non, jamais, quel que soit le ton choisi. Deux règles ne sont pas modifiables : le bot reste honnête si on lui demande sincèrement s'il s'agit d'une IA, et il ne génère aucun contenu explicite dans le chat.",
  },
  {
    q: "Que fait le bot si un visiteur est en détresse ou semble mineur ?",
    a: "Le ton commercial s'interrompt automatiquement et une réponse de sécurité standard est envoyée à la place. Ce comportement n'est pas désactivable.",
  },
  {
    q: "Mes conversations sont-elles gardées indéfiniment ?",
    a: "Non — l'historique de conversation est purgé automatiquement au-delà de 90 jours. Voir la politique de confidentialité pour le détail.",
  },
  {
    q: "Comment supprimer mon compte ?",
    a: "Écrivez à l'adresse de contact ci-dessous en indiquant l'email du compte : la suppression est définitive et emporte vos paliers, ventes déclarées et historique de conversation.",
  },
];

export default function CommentCaMarchePage() {
  return (
    <main className="flex-1">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <Link href="/" className="text-sm text-muted hover:text-foreground transition">
          ← Retour
        </Link>
        <h1 className="text-2xl font-semibold mt-4 mb-2">Comment ça marche</h1>
        <p className="text-sm text-muted mb-10">
          Le guide pratique, pas la version marketing — pour savoir concrètement ce qui se
          passe à chaque étape.
        </p>

        <div className="space-y-6 mb-14">
          {STEPS.map((s) => (
            <div key={s.title} className="card p-5">
              <h2 className="font-medium mb-1.5">{s.title}</h2>
              <p className="text-sm text-muted leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-semibold mb-6">Questions fréquentes</h2>
        <div className="space-y-6 mb-14">
          {FAQ.map((f) => (
            <div key={f.q}>
              <h3 className="font-medium mb-1.5">{f.q}</h3>
              <p className="text-sm text-muted leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>

        <div className="card p-5 text-sm text-muted">
          Une question qui n&apos;est pas ici ?{" "}
          <a
            href="mailto:jmsventurecapital@gmail.com"
            className="underline underline-offset-4 hover:text-foreground transition"
          >
            jmsventurecapital@gmail.com
          </a>
        </div>
      </div>
    </main>
  );
}
