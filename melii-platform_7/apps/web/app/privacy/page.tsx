import Link from "next/link";

export const metadata = { title: "Politique de confidentialité — Melii" };

export default function PrivacyPage() {
  return (
    <main className="flex-1">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <Link href="/" className="text-sm text-muted hover:text-foreground transition">
          ← Retour
        </Link>
        <h1 className="text-2xl font-semibold mt-4 mb-2">Politique de confidentialité</h1>
        <p className="text-sm text-muted mb-10">
          Dernière mise à jour : {new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long" })}
        </p>

        <div className="card p-5 mb-10 text-sm text-muted leading-relaxed">
          Ce document est un modèle de départ, pas un avis juridique. Une
          vraie mise en conformité (RGPD si des créatrices ou visiteurs sont
          dans l&apos;UE, ou toute autre loi applicable) demande une revue par
          un·e professionnel·le, en particulier vu la nature des données
          échangées ici.
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-muted">
          <section>
            <h2 className="text-foreground font-medium mb-2">1. Données collectées</h2>
            <p>
              Pour les créatrices : email, mot de passe (jamais stocké en
              clair), prénom affiché, personnalité du bot configurée, paliers
              de liens, ventes déclarées, informations d&apos;abonnement.
              Pour les visiteurs qui discutent avec un bot : le contenu des
              messages échangés, associé à un identifiant de conversation
              anonyme (pas de compte, pas d&apos;email requis).
            </p>
          </section>

          <section>
            <h2 className="text-foreground font-medium mb-2">2. Utilisation des données</h2>
            <p>
              Les messages de conversation sont transmis à l&apos;API de Claude
              (Anthropic) pour générer les réponses du bot, et conservés
              temporairement pour donner au bot le contexte des échanges
              précédents. Ils ne sont ni vendus, ni utilisés à des fins
              publicitaires.
            </p>
          </section>

          <section>
            <h2 className="text-foreground font-medium mb-2">3. Conservation</h2>
            <p>
              L&apos;historique de conversation est purgé automatiquement au-delà
              de 90 jours. Les données de compte créatrice sont conservées tant
              que le compte est actif, puis supprimées sur demande.
            </p>
          </section>

          <section>
            <h2 className="text-foreground font-medium mb-2">4. Partage avec des tiers</h2>
            <p>
              Sous-traitants techniques utilisés : Anthropic (génération des
              réponses du bot), un hébergeur cloud pour le site et la base de
              données, et Telegram uniquement si la créatrice connecte cette
              option. Aucune donnée n&apos;est vendue à des tiers.
            </p>
          </section>

          <section>
            <h2 className="text-foreground font-medium mb-2">5. Vos droits</h2>
            <p>
              Toute personne peut demander l&apos;accès, la rectification ou la
              suppression de ses données en écrivant à{" "}
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
