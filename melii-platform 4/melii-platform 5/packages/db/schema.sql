-- Schéma PostgreSQL — copie lisible de schema.js (source réellement utilisée
-- à l'exécution, embarquée en JS pour survivre au bundling ; si vous
-- modifiez l'un, reportez le changement dans l'autre).

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
