import Link from "next/link";

export const metadata = { title: "Conditions d'utilisation — Melii" };

export default function TermsPage() {
  return (
    <main className="flex-1">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <Link href="/" className="text-sm text-muted hover:text-foreground transition">
          ← Retour
        </Link>
        <h1 className="text-2xl font-semibold mt-4 mb-2">Conditions d&apos;utilisation</h1>
        <p className="text-sm text-muted mb-10">
          Dernière mise à jour : {new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long" })}
        </p>

        <div className="card p-5 mb-10 text-sm text-muted leading-relaxed">
          Ce document est un modèle de départ, pas un avis juridique. Avant tout
          lancement public, faites-le relire (ou rédiger) par un·e avocat·e
          familier·ère avec l&apos;activité de création de contenu pour adultes
          dans votre juridiction — les obligations varient selon les pays et
          évoluent régulièrement.
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-muted">
          <section>
            <h2 className="text-foreground font-medium mb-2">1. Objet</h2>
            <p>
              Melii (« la Plateforme ») permet à une créatrice de contenu (« la
              Créatrice ») de configurer un assistant conversationnel qui
              présente son offre à sa communauté via un lien de chat en ligne
              et, en option, un bot Telegram. La Plateforme ne traite, n&apos;héberge
              et ne vend elle-même aucun contenu pour adultes — elle oriente
              vers les liens de paiement externes fournis par la Créatrice.
            </p>
          </section>

          <section>
            <h2 className="text-foreground font-medium mb-2">2. Éligibilité</h2>
            <p>
              L&apos;inscription est réservée aux personnes de 18 ans ou plus,
              disposant de la capacité juridique de conclure ce contrat, et
              habilitées à vendre légalement le contenu qu&apos;elles proposent
              dans leur juridiction de résidence et celle de leurs plateformes
              de paiement.
            </p>
          </section>

          <section>
            <h2 className="text-foreground font-medium mb-2">3. Abonnement et essai gratuit</h2>
            <p>
              L&apos;accès à la Plateforme est soumis à un abonnement payant,
              précédé d&apos;une période d&apos;essai gratuite dont la durée est
              affichée lors de l&apos;inscription. Sauf résiliation avant la fin
              de l&apos;essai, l&apos;abonnement démarre automatiquement au tarif du
              palier choisi. Les tarifs et paliers sont indiqués sur la
              Plateforme et peuvent évoluer avec un préavis raisonnable.
            </p>
          </section>

          <section>
            <h2 className="text-foreground font-medium mb-2">4. Responsabilités de la Créatrice</h2>
            <p>
              La Créatrice reste seule responsable du contenu qu&apos;elle
              propose, de sa conformité légale, du respect des conditions
              d&apos;utilisation de ses propres plateformes de paiement, et de
              l&apos;exactitude des ventes qu&apos;elle déclare sur son dashboard.
            </p>
          </section>

          <section>
            <h2 className="text-foreground font-medium mb-2">5. Garde-fous de l&apos;assistant</h2>
            <p>
              L&apos;assistant conversationnel intègre des règles non
              désactivables : il reste honnête si on lui demande sincèrement
              s&apos;il s&apos;agit d&apos;une intelligence artificielle, ne génère
              aucun contenu sexuel explicite dans le chat, et interrompt
              automatiquement le ton commercial en cas de signal de détresse
              réelle ou de minorité chez l&apos;interlocuteur.
            </p>
          </section>

          <section>
            <h2 className="text-foreground font-medium mb-2">6. Résiliation</h2>
            <p>
              La Créatrice peut résilier son abonnement à tout moment depuis
              son dashboard ; la résiliation prend effet à la fin de la
              période déjà payée. La Plateforme se réserve le droit de
              suspendre un compte en cas de violation manifeste de ces
              conditions ou de la loi applicable.
            </p>
          </section>

          <section>
            <h2 className="text-foreground font-medium mb-2">7. Contact</h2>
            <p>
              Pour toute question relative à ces conditions, écrivez à{" "}
              <a
                href="mailto:jmsventurecapital@gmail.com"
                className="underline underline-offset-4 hover:text-foreground transition"
              >
                jmsventurecapital@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
