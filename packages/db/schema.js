// Schéma PostgreSQL, embarqué en JS (voir index.js pour pourquoi : ça
// survit au bundling par Next.js, qui ne copie pas toujours les fichiers
// non-JS à côté du code compilé).

module.exports = `
CREATE TABLE IF NOT EXISTS creators (
  id                      TEXT PRIMARY KEY,
  email                   TEXT UNIQUE NOT NULL,
  password_hash           TEXT NOT NULL,
  display_name            TEXT NOT NULL,
  persona_tone            TEXT NOT NULL DEFAULT 'doux_complice',
  persona_bio             TEXT NOT NULL DEFAULT '',
  telegram_bot_token      TEXT,
  telegram_bot_username   TEXT,
  telegram_webhook_secret TEXT,
  telegram_webhook_ready  INTEGER NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Colonnes ajoutées après la v1 : IF NOT EXISTS pour rester compatible avec
-- une base déjà en production (une simple CREATE TABLE IF NOT EXISTS
-- n'altère pas une table existante).
ALTER TABLE creators ADD COLUMN IF NOT EXISTS age_confirmed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'trial';
ALTER TABLE creators ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS subscription_plan TEXT;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS accent_color TEXT;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS gallery_urls TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE creators ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS referred_by_creator_id TEXT REFERENCES creators(id) ON DELETE SET NULL;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS totp_secret TEXT;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS totp_backup_codes TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE creators ADD COLUMN IF NOT EXISTS custom_domain TEXT UNIQUE;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS custom_domain_verify_token TEXT;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS custom_domain_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS relance_enabled BOOLEAN NOT NULL DEFAULT false;
-- Langue de réponse du bot (fr/en/es) — voir packages/db/persona.js pour la
-- liste des langues gérées et la couverture des mots-clés de sécurité qui va
-- avec. 'fr' par défaut pour rester identique au comportement historique.
ALTER TABLE creators ADD COLUMN IF NOT EXISTS persona_language TEXT NOT NULL DEFAULT 'fr';

CREATE TABLE IF NOT EXISTS tiers (
  id           TEXT PRIMARY KEY,
  creator_id   TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  "order"      INTEGER NOT NULL,
  label        TEXT NOT NULL,
  price_cents  INTEGER NOT NULL,
  currency     TEXT NOT NULL DEFAULT 'EUR',
  url          TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (creator_id, "order")
);

-- Argument de vente propre à ce palier (facultatif) : ce que la créatrice
-- écrit ici est injecté dans le prompt système du bot (voir buildSystemPrompt
-- dans persona.js) pour que la présentation de CE palier précis soit
-- pertinente, plutôt qu'un simple libellé + prix. Vide par défaut pour ne
-- rien changer au comportement des paliers déjà créés.
ALTER TABLE tiers ADD COLUMN IF NOT EXISTS sell_angle TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS click_events (
  id               TEXT PRIMARY KEY,
  creator_id       TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  tier_id          TEXT NOT NULL REFERENCES tiers(id) ON DELETE CASCADE,
  telegram_chat_id TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sale_declarations (
  id           TEXT PRIMARY KEY,
  creator_id   TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  tier_id      TEXT NOT NULL REFERENCES tiers(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  currency     TEXT NOT NULL DEFAULT 'EUR',
  note         TEXT NOT NULL DEFAULT '',
  declared_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id         TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  chat_id    TEXT NOT NULL,
  role       TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un message qui contient un mot-clé de sécurité (détresse, minorité,
-- chantage...) est marqué flagged=true à l'écriture (voir persona.js /
-- containsSafetyKeyword) pour alimenter le tableau de modération admin sans
-- avoir à relire tout l'historique de toutes les créatrices à chaque fois.
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS flagged BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS flag_reviewed BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_conv_lookup
  ON conversation_messages (creator_id, chat_id, created_at);

CREATE INDEX IF NOT EXISTS idx_conv_flagged
  ON conversation_messages (created_at DESC)
  WHERE flagged = true AND flag_reviewed = false;

CREATE INDEX IF NOT EXISTS idx_clicks_creator
  ON click_events (creator_id, created_at);

CREATE TABLE IF NOT EXISTS password_resets (
  id          TEXT PRIMARY KEY,
  creator_id  TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_creator
  ON password_resets (creator_id);

-- Relances automatiques (Telegram uniquement, opt-in) : une ligne = un envoi
-- déjà fait pour cette conversation. La contrainte UNIQUE empêche par
-- construction d'envoyer une deuxième relance à la même conversation, même
-- en cas de double exécution du job planifié.
CREATE TABLE IF NOT EXISTS conversation_relances (
  id         TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  chat_id    TEXT NOT NULL,
  tier_id    TEXT REFERENCES tiers(id) ON DELETE SET NULL,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (creator_id, chat_id)
);

-- Visites du lien de chat public (/c/[creatorId]), avec une "source"
-- optionnelle (?src=bio, ?src=story...) que la créatrice choisit elle-même
-- en générant un lien tagué depuis l'onglet "Chat en ligne" — sert à savoir
-- quel canal de partage amène vraiment du monde (voir getVisitsBySource dans
-- index.js). 'direct' est la valeur par défaut quand aucun tag n'est présent
-- dans l'URL (lien copié tel quel, ou lien historique déjà partagé).
CREATE TABLE IF NOT EXISTS link_visits (
  id         TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  source     TEXT NOT NULL DEFAULT 'direct',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_link_visits_creator
  ON link_visits (creator_id, created_at);

-- Mémoire légère par fan (une ligne par conversation, identifiée par
-- chat_id) : un résumé texte évolutif ("notes") et une estimation de
-- potentiel, régénérés périodiquement par l'IA à partir de l'historique de
-- conversation (voir maybeUpdateFanProfile dans lib/chat-engine.ts) plutôt
-- qu'à chaque message — pour garder le coût d'appel modèle sous contrôle.
-- summarized_through retient le nombre de messages déjà pris en compte lors
-- du dernier résumé, pour savoir quand il est temps d'en refaire un.
CREATE TABLE IF NOT EXISTS fan_profiles (
  id                 TEXT PRIMARY KEY,
  creator_id         TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  chat_id            TEXT NOT NULL,
  notes              TEXT NOT NULL DEFAULT '',
  potential          TEXT,
  summarized_through INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (creator_id, chat_id)
);

CREATE INDEX IF NOT EXISTS idx_fan_profiles_creator
  ON fan_profiles (creator_id, updated_at DESC);
`;
