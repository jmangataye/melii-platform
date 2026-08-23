const { Pool } = require("pg");
const crypto = require("node:crypto");
const SCHEMA_SQL = require("./schema");

// --- Connexion --------------------------------------------------------
// PostgreSQL via `pg`, choisi pour pouvoir être provisionné directement par
// le connecteur MCP Render (create_postgres) — pas de disque persistant à
// gérer à part, contrairement à SQLite. DATABASE_URL est fourni
// automatiquement par Render quand la base est liée au service.

const globalForDb = globalThis;

const pool =
  globalForDb.__meliiPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes("localhost")
      ? false
      : { rejectUnauthorized: false },
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__meliiPool = pool;
}

let schemaReadyPromise = null;
function ensureSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = pool.query(SCHEMA_SQL).catch((err) => {
      schemaReadyPromise = null; // permet de réessayer si la 1ère tentative échoue
      throw err;
    });
  }
  return schemaReadyPromise;
}

async function query(text, params) {
  await ensureSchema();
  return pool.query(text, params);
}

function id() {
  return crypto.randomUUID();
}

// --- Mots de passe ------------------------------------------------------
// scrypt (module natif "crypto") pour ne dépendre d'aucun package externe.

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password, stored) {
  const [salt, derivedHex] = (stored || "").split(":");
  if (!salt || !derivedHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(derivedHex, "hex");
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

// --- Créatrices -----------------------------------------------------

function rowToCreator(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    displayName: row.display_name,
    personaTone: row.persona_tone,
    personaBio: row.persona_bio,
    telegramBotToken: row.telegram_bot_token,
    telegramBotUsername: row.telegram_bot_username,
    telegramWebhookSecret: row.telegram_webhook_secret,
    telegramWebhookReady: !!row.telegram_webhook_ready,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function createCreator({ email, password, displayName }) {
  const creatorId = id();
  await query(
    `INSERT INTO creators (id, email, password_hash, display_name)
     VALUES ($1, $2, $3, $4)`,
    [creatorId, email.trim().toLowerCase(), hashPassword(password), displayName]
  );
  return getCreatorById(creatorId);
}

async function getCreatorByEmail(email) {
  const { rows } = await query("SELECT * FROM creators WHERE email = $1", [
    email.trim().toLowerCase(),
  ]);
  return rowToCreator(rows[0]);
}

async function getCreatorById(creatorId) {
  const { rows } = await query("SELECT * FROM creators WHERE id = $1", [creatorId]);
  return rowToCreator(rows[0]);
}

async function updateCreatorPersona(creatorId, { tone, bio, displayName }) {
  await query(
    `UPDATE creators
     SET persona_tone = $1, persona_bio = $2, display_name = $3, updated_at = now()
     WHERE id = $4`,
    [tone, bio, displayName, creatorId]
  );
  return getCreatorById(creatorId);
}

async function updateCreatorTelegram(creatorId, { token, username, webhookSecret, webhookReady }) {
  await query(
    `UPDATE creators
     SET telegram_bot_token = $1, telegram_bot_username = $2,
         telegram_webhook_secret = $3, telegram_webhook_ready = $4, updated_at = now()
     WHERE id = $5`,
    [token, username, webhookSecret, webhookReady ? 1 : 0, creatorId]
  );
  return getCreatorById(creatorId);
}

// --- Paliers de liens -------------------------------------------------

function rowToTier(row) {
  if (!row) return null;
  return {
    id: row.id,
    creatorId: row.creator_id,
    order: row.order,
    label: row.label,
    priceCents: row.price_cents,
    currency: row.currency,
    url: row.url,
    createdAt: row.created_at,
  };
}

async function listTiers(creatorId) {
  const { rows } = await query(
    'SELECT * FROM tiers WHERE creator_id = $1 ORDER BY "order" ASC',
    [creatorId]
  );
  return rows.map(rowToTier);
}

async function getTierById(tierId) {
  const { rows } = await query("SELECT * FROM tiers WHERE id = $1", [tierId]);
  return rowToTier(rows[0]);
}

async function upsertTier(creatorId, { order, label, priceCents, currency, url }) {
  const { rows: existingRows } = await query(
    'SELECT id FROM tiers WHERE creator_id = $1 AND "order" = $2',
    [creatorId, order]
  );

  if (existingRows[0]) {
    await query(
      `UPDATE tiers SET label = $1, price_cents = $2, currency = $3, url = $4
       WHERE id = $5`,
      [label, priceCents, currency || "EUR", url, existingRows[0].id]
    );
    return getTierById(existingRows[0].id);
  }

  const tierId = id();
  await query(
    `INSERT INTO tiers (id, creator_id, "order", label, price_cents, currency, url)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [tierId, creatorId, order, label, priceCents, currency || "EUR", url]
  );
  return getTierById(tierId);
}

async function deleteTier(creatorId, tierId) {
  await query("DELETE FROM tiers WHERE creator_id = $1 AND id = $2", [creatorId, tierId]);
}

// --- Clics / conversions -------------------------------------------------

async function logClick({ creatorId, tierId, telegramChatId }) {
  await query(
    `INSERT INTO click_events (id, creator_id, tier_id, telegram_chat_id)
     VALUES ($1, $2, $3, $4)`,
    [id(), creatorId, tierId, telegramChatId || null]
  );
}

async function declareSale({ creatorId, tierId, amountCents, currency, note }) {
  await query(
    `INSERT INTO sale_declarations (id, creator_id, tier_id, amount_cents, currency, note)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id(), creatorId, tierId, amountCents, currency || "EUR", note || ""]
  );
}

async function listSales(creatorId) {
  const { rows } = await query(
    `SELECT s.*, t.label as tier_label FROM sale_declarations s
     JOIN tiers t ON t.id = s.tier_id
     WHERE s.creator_id = $1 ORDER BY s.declared_at DESC`,
    [creatorId]
  );
  return rows.map((r) => ({
    id: r.id,
    tierId: r.tier_id,
    tierLabel: r.tier_label,
    amountCents: r.amount_cents,
    currency: r.currency,
    note: r.note,
    declaredAt: r.declared_at,
  }));
}

// Taux de commission de la plateforme (v1 : constant, configurable via env).
const COMMISSION_RATE = Number(process.env.MELII_COMMISSION_RATE || "0.15");

async function getStats(creatorId) {
  const { rows: clicksByTier } = await query(
    `SELECT tier_id, COUNT(*) as clicks FROM click_events
     WHERE creator_id = $1 GROUP BY tier_id`,
    [creatorId]
  );

  const { rows: totalRows } = await query(
    `SELECT COALESCE(SUM(amount_cents), 0) as total FROM sale_declarations
     WHERE creator_id = $1`,
    [creatorId]
  );

  const totalDeclaredCents = Number(totalRows[0].total);

  return {
    clicksByTier: Object.fromEntries(clicksByTier.map((r) => [r.tier_id, Number(r.clicks)])),
    totalDeclaredCents,
    commissionRate: COMMISSION_RATE,
    commissionOwedCents: Math.round(totalDeclaredCents * COMMISSION_RATE),
  };
}

// --- Historique de conversation (persistant, multi-créatrices) -------

async function appendMessage({ creatorId, chatId, role, content }) {
  await query(
    `INSERT INTO conversation_messages (id, creator_id, chat_id, role, content)
     VALUES ($1, $2, $3, $4, $5)`,
    [id(), creatorId, String(chatId), role, content]
  );
}

async function getRecentMessages({ creatorId, chatId, limit = 20 }) {
  const { rows } = await query(
    `SELECT role, content FROM conversation_messages
     WHERE creator_id = $1 AND chat_id = $2
     ORDER BY created_at DESC LIMIT $3`,
    [creatorId, String(chatId), limit]
  );
  return rows.reverse().map((r) => ({ role: r.role, content: r.content }));
}

module.exports = {
  id,
  hashPassword,
  verifyPassword,
  createCreator,
  getCreatorByEmail,
  getCreatorById,
  updateCreatorPersona,
  updateCreatorTelegram,
  listTiers,
  getTierById,
  upsertTier,
  deleteTier,
  logClick,
  declareSale,
  listSales,
  getStats,
  appendMessage,
  getRecentMessages,
  COMMISSION_RATE,
};
