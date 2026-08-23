# Melii — plateforme de bots IA pour créatrices

Un site où une créatrice s'inscrit, configure un bot Telegram à sa
personnalité (ton, bio, paliers de liens à prix croissant), le connecte en
collant un token BotFather, puis partage son lien Telegram à sa communauté.
Le bot discute avec les gens et fait découvrir les paliers dans l'ordre.

Testé de bout en bout dans cette session : inscription, connexion, ajout de
palier, changement de personnalité, redirection de lien court + tracking de
clic, déclaration de vente, calcul de commission, et le bot Telegram lui-même
(webhook → sécurité → appel Claude → réponse) — voir le détail des choix et
limites plus bas.

## Architecture

```
melii-platform/
├── render.yaml         Déploiement en un clic sur Render (voir plus bas)
├── apps/
│   ├── web/             Next.js — site public + dashboard créatrice + API
│   │                     + le webhook Telegram de TOUTES les créatrices
│   │                     (app/api/telegram-webhook/[creatorId])
│   └── bot-runner/       Optionnel, non utilisé par défaut — voir son
│                         propre commentaire d'en-tête. Un service Node à
│                         part pour faire tourner les bots séparément du
│                         site, utile seulement si le volume devient gros.
├── packages/
│   └── db/               Accès base de données (PostgreSQL) + moteur de
│                          personnalité, partagés par les deux apps
```

**Un seul service à déployer.** Au départ ce projet avait le bot Telegram
dans un service séparé (`apps/bot-runner`). Ça a été fusionné dans `apps/web`
pour rester simple à déployer (un seul service web) — la base PostgreSQL,
elle, est de toute façon une ressource à part, partagée sans problème par
plusieurs services si un jour vous voulez ressortir les bots. `apps/bot-runner`
reste dans le dépôt, éteint par défaut (et pas encore remis à jour pour
l'API Postgres — voir son commentaire d'en-tête), si vous voulez un jour
sortir les bots à part.

## Choix techniques à connaître avant de déployer

- **Base de données : PostgreSQL** via le paquet `pg`. Prisma a été essayé en
  premier mais télécharge un binaire depuis `binaries.prisma.sh` au moment du
  `generate`, un domaine bloqué dans le sandbox où ce projet a été construit —
  donc un accès direct via `pg` a été utilisé à la place, sans ORM. C'est un
  choix robuste pour la production (contrairement à SQLite, qui a été utilisé
  un temps pendant le développement mais abandonné car il demande un disque
  persistant, une contrainte que l'outil de déploiement automatique — voir
  `render.yaml` — ne gère pas bien). `DATABASE_URL` est la seule variable à
  fournir ; le connecteur ou le Blueprint Render la remplit automatiquement.
- **`apps/web` doit être construit avec `--webpack`, pas Turbopack** (déjà
  configuré dans `package.json`). Ça vient d'un reste de l'étape SQLite du
  développement (Turbopack ne gérait pas `node:sqlite`) ; ce n'est plus
  strictement nécessaire avec Postgres mais n'a pas encore été retesté avec
  le bundler par défaut — gardez `--webpack` pour rester sur une config
  éprouvée.
- **Pas d'ORM/migrations formelles** : le schéma (`packages/db/schema.js`)
  s'applique tout seul via `CREATE TABLE IF NOT EXISTS` à l'ouverture de la
  base. Pratique pour démarrer, à remplacer par un vrai outil de migration
  si le schéma doit évoluer souvent en production avec des données existantes.

## Démarrer en local

Prérequis : Node ≥ 20.9, npm, un PostgreSQL local (ou distant) accessible.

```bash
npm install          # à la racine — installe tout le monorepo d'un coup

cp apps/web/.env.example apps/web/.env.local

# Renseignez DATABASE_URL dans apps/web/.env.local (ex. une base Postgres
# locale : postgresql://user:password@localhost:5432/melii)

# Générez un secret de session :
openssl rand -hex 32
# → collez-le dans apps/web/.env.local (SESSION_SECRET)

npm run web:dev       # démarre le site sur http://localhost:3000
# Le schéma (tables) se crée tout seul au premier démarrage.
```

En local, Telegram ne peut pas joindre `http://localhost` (il lui faut une
URL publique en HTTPS) — utilisez un tunnel type `ngrok` pour tester la
connexion Telegram en local, ou testez directement en déploiement.

## Mettre le code sur GitHub (préalable au déploiement)

1. Créez un compte sur [github.com](https://github.com/signup) si vous n'en
   avez pas (gratuit, email + mot de passe).
2. Cliquez **New repository** (bouton vert), nommez-le par exemple
   `melii-platform`, laissez-le en **Private**, ne cochez aucune case
   d'initialisation (pas de README/gitignore — ce dossier en a déjà), puis
   **Create repository**.
3. GitHub affiche des commandes sous "…or push an existing repository from
   the command line". Dans un terminal, à la racine de ce dossier :

```bash
git init
git add .
git commit -m "Première version"
git branch -M main
git remote add origin https://github.com/VOTRE-PSEUDO/melii-platform.git
git push -u origin main
```

(remplacez l'URL par celle que GitHub vous a donnée à l'étape 2 — GitHub
vous demandera de vous authentifier au premier `push`, suivez ses
instructions à l'écran).

## Déployer sur Render (recommandé, le plus simple)

Ce dépôt contient un `render.yaml` qui configure tout automatiquement,
service web ET base de données Postgres inclus.

1. Poussez ce dossier sur un dépôt GitHub (voir section suivante si vous
   n'avez pas encore de compte GitHub).
2. Sur [render.com](https://render.com), **New → Blueprint**, connectez le
   dépôt GitHub. Render lit `render.yaml` et propose de créer le service web
   **et** la base PostgreSQL tout seul, avec `DATABASE_URL` déjà reliée
   entre les deux automatiquement.
3. Render vous demande de coller `ANTHROPIC_API_KEY` (la seule valeur qui
   n'est pas déjà pré-remplie ou générée automatiquement) — récupérez-la sur
   console.anthropic.com → API Keys, et ajoutez du crédit sur ce compte
   (Ajouter des fonds) sinon le bot ne pourra pas répondre.
4. Cliquez **Apply**. Premier déploiement : quelques minutes.
5. Une fois en ligne, chaque créatrice connecte son propre bot Telegram
   depuis son dashboard (onglet Telegram, token obtenu via @BotFather) —
   rien à faire manuellement côté serveur, le site enregistre le webhook
   tout seul.

**Coût** : le service web et la base Postgres démarrent tous les deux sur le
plan "free" de Render (aucun disque persistant requis avec cette
architecture) — vérifiez le tarif et les limites actuelles sur leur site,
ils peuvent avoir changé. Une base "free" Render est généralement limitée en
durée/volume ; passez sur un plan payant Postgres dès que le projet devient
sérieux, sans changement de code nécessaire.

**Déployer ailleurs** (Railway, VPS...) : même principe, juste sans le
fichier `render.yaml` tout prêt — les variables d'environnement à fournir
sont dans `apps/web/.env.example`, et il faut Node ≥ 20.9 + une base
PostgreSQL accessible via `DATABASE_URL`.

## Sur la commission et les paiements (important)

Cette v1 **ne traite pas les paiements elle-même**. Les liens de chaque
palier pointent vers le processeur externe de la créatrice (Dropfans ou
autre) — Melii ne touche jamais les fonds. Résultat : la commission est
calculée sur des **ventes déclarées manuellement** par la créatrice dans
l'onglet Facturation, pas sur une confirmation automatique de paiement.

C'est un choix assumé, pas un oubli : les processeurs grand public (Stripe,
PayPal...) restreignent ou interdisent la plupart des activités liées au
contenu pour adultes, ce qui est justement pourquoi des plateformes comme
Dropfans existent. Brancher Melii sur un vrai encaissement direct
demanderait de choisir un processeur compatible contenu adulte (CCBill,
Segpay, Verotel, ou l'API d'affiliation de Dropfans si elle en propose une)
et d'valider votre activité auprès de lui — une démarche business, pas
seulement technique. Le code est structuré pour que ce soit un ajout propre
le jour où c'est fait : `packages/db` a déjà les tables `sale_declarations`
et `click_events` séparées, prêtes à être alimentées automatiquement par un
webhook de paiement au lieu d'une déclaration manuelle.

## Le moteur de personnalité (garde-fous)

`packages/db/persona.js` construit les instructions système envoyées à
Claude. Les créatrices choisissent un **ton** (doux/complice, direct/vendeur,
joueur/taquin) et rédigent leur **bio** + leurs **paliers**, mais ne peuvent
PAS modifier deux règles injectées par la plateforme elle-même, marquées
`[GARDE-FOU]` dans le code :

1. Le bot reste honnête si on lui demande **sincèrement et clairement**
   s'il s'agit d'une IA — il ne ment jamais frontalement à cette question.
2. Le bot ne génère aucun contenu sexuel explicite dans le chat lui-même
   (reste suggestif ; le contenu vendu est dans les liens, pas dans le texte).

Une liste de mots-clés (`SAFETY_KEYWORDS`) coupe automatiquement le ton
commercial et n'envoie aucun lien si la conversation mentionne un signal de
détresse réelle ou de minorité — voir `containsSafetyKeyword` dans le même
fichier.

C'est un choix de conception délibéré : ces règles vivent dans la
plateforme, pas dans le champ libre de chaque créatrice, pour garder un
comportement cohérent et défendable sur l'ensemble des bots hébergés. Je
recommande de les garder telles quelles plutôt que de les rendre
éditables.

## Ce qui manque encore pour une vraie mise en production

- **Paiement automatique de la commission** (voir section dédiée ci-dessus).
- **Vérification d'âge / conditions d'utilisation** en bonne et due forme à
  l'inscription (case à cocher actuellement absente du formulaire signup —
  à ajouter avant tout lancement public, avec conseil juridique si besoin).
- **Historique de conversation borné dans le temps** : `conversation_messages`
  grossit indéfiniment ; ajoutez une purge périodique (ex. > 90 jours).
- **Rate limiting** sur les routes d'authentification et sur le webhook
  Telegram, pour éviter les abus si le site devient public.
- **Emails transactionnels** (confirmation de compte, réinitialisation de
  mot de passe) — l'auth actuelle est volontairement minimale (email +
  mot de passe, pas de vérification d'email).
