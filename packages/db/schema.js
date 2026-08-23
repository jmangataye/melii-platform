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

CREATE INDEX IF NOT EXISTS idx_conv_lookup
  ON conversation_messages (creator_id, chat_id, created_at);

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
`;
