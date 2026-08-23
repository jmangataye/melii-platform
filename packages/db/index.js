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
    ageConfirmed: !!row.age_confirmed,
    subscriptionStatus: row.subscription_status,
    trialEndsAt: row.trial_ends_at,
    subscriptionPlan: row.subscription_plan,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    avatarUrl: row.avatar_url,
    accentColor: row.accent_color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Durée de l'essai gratuit avant qu'un abonnement Stripe soit requis.
const TRIAL_DAYS = 4;

async function createCreator({ email, password, displayName, ageConfirmed }) {
  const creatorId = id();
  await query(
    `INSERT INTO creators (id, email, password_hash, display_name, age_confirmed, subscription_status, trial_ends_at)
     VALUES ($1, $2, $3, $4, $5, 'trial', now() + make_interval(days => $6))`,
    [creatorId, email.trim().toLowerCase(), hashPassword(password), displayName, !!ageConfirmed, TRIAL_DAYS]
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

// Suppression définitive d'un compte créatrice — utilisée par l'admin pour
// honorer une demande de suppression de données (voir /privacy). Toutes les
// tables liées (paliers, clics, ventes, messages, jetons de réinitialisation)
// ont une contrainte ON DELETE CASCADE sur creator_id, donc un seul DELETE
// sur creators suffit à tout nettoyer. Renvoie true si un compte a bien été
// supprimé, false si l'id ne correspondait à rien.
async function deleteCreator(creatorId) {
  const { rowCount } = await query("DELETE FROM creators WHERE id = $1", [creatorId]);
  return rowCount > 0;
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

// Personnalisation visuelle légère : une URL de photo (hébergée ailleurs —
// pas de stockage de fichiers côté Melii) et une couleur d'accent, affichées
// sur le dashboard de la créatrice et sur sa page de chat publique.
async function updateCreatorProfile(creatorId, { avatarUrl, accentColor }) {
  await query(
    `UPDATE creators
     SET avatar_url = $1, accent_color = $2, updated_at = now()
     WHERE id = $3`,
    [avatarUrl || null, accentColor || null, creatorId]
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

async function updateCreatorPasswordHash(creatorId, passwordHash) {
  await query(`UPDATE creators SET password_hash = $1, updated_at = now() WHERE id = $2`, [
    passwordHash,
    creatorId,
  ]);
}

// --- Abonnement (Stripe) -------------------------------------------------
// Champs mis à jour par les webhooks Stripe (voir apps/web/app/api/stripe-webhook).
// Chaque paramètre est optionnel : seuls les champs fournis sont modifiés,
// pour rester safe à appeler avec un sous-ensemble d'infos selon l'event reçu.
async function updateCreatorSubscription(
  creatorId,
  { status, plan, stripeCustomerId, stripeSubscriptionId } = {}
) {
  const current = await getCreatorById(creatorId);
  if (!current) return null;
  await query(
    `UPDATE creators
     SET subscription_status = $1, subscription_plan = $2,
         stripe_customer_id = $3, stripe_subscription_id = $4, updated_at = now()
     WHERE id = $5`,
    [
      status ?? current.subscriptionStatus,
      plan === undefined ? current.subscriptionPlan : plan,
      stripeCustomerId === undefined ? current.stripeCustomerId : stripeCustomerId,
      stripeSubscriptionId === undefined ? current.stripeSubscriptionId : stripeSubscriptionId,
      creatorId,
    ]
  );
  return getCreatorById(creatorId);
}

async function getCreatorByStripeCustomerId(stripeCustomerId) {
  const { rows } = await query("SELECT * FROM creators WHERE stripe_customer_id = $1", [
    stripeCustomerId,
  ]);
  return rowToCreator(rows[0]);
}

// --- Réinitialisation de mot de passe ------------------------------------
// Le token en clair n'est jamais stocké : seul son empreinte SHA-256 l'est,
// ce qui permet de le retrouver par recherche exacte (contrairement à un
// hash lent type scrypt) sans jamais garder la valeur envoyée par email en
// base — si la base fuit, les tokens ne sont pas exploitables tels quels.
function hashResetToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

const RESET_TOKEN_TTL_MINUTES = 30;

async function createPasswordResetToken(creatorId) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  await query(
    `INSERT INTO password_resets (id, creator_id, token_hash, expires_at)
     VALUES ($1, $2, $3, now() + make_interval(mins => $4))`,
    [id(), creatorId, hashResetToken(rawToken), RESET_TOKEN_TTL_MINUTES]
  );
  return rawToken;
}

async function consumePasswordResetToken(rawToken, newPassword) {
  const tokenHash = hashResetToken(rawToken);
  const { rows } = await query(
    `SELECT id, creator_id FROM password_resets
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
    [tokenHash]
  );
  const row = rows[0];
  if (!row) return false;

  await query(`UPDATE password_resets SET used_at = now() WHERE id = $1`, [row.id]);
  await updateCreatorPasswordHash(row.creator_id, hashPassword(newPassword));
  return true;
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

// Nombre de conversations distinctes (chat_id uniques) depuis N jours — sert
// de base pour situer une créatrice dans les paliers d'abonnement par volume.
async function getConversationVolume(creatorId, sinceDays = 30) {
  const { rows } = await query(
    `SELECT COUNT(DISTINCT chat_id) as volume FROM conversation_messages
     WHERE creator_id = $1 AND created_at > now() - make_interval(days => $2)`,
    [creatorId, sinceDays]
  );
  return Number(rows[0]?.volume || 0);
}

// Purge des messages de conversation plus vieux que `days` — appelée par un
// cron job Render (voir apps/web/scripts/purge-conversations.js). Renvoie le
// nombre de lignes supprimées pour permettre de logger un résumé.
async function purgeOldConversations(days = 90) {
  const { rowCount } = await query(
    `DELETE FROM conversation_messages WHERE created_at < now() - make_interval(days => $1)`,
    [days]
  );
  return rowCount;
}

// --- Vue d'ensemble pour le dashboard admin -------------------------------
// Chaque métrique est agrégée dans sa propre sous-requête avant d'être
// jointe à creators : joindre tiers/sale_declarations/conversation_messages
// directement sur c.id ferait un produit cartésien entre ces trois tables
// (ex. 2 paliers x 1 vente x 2 messages = 4 lignes), ce qui multiplierait
// SUM(amount_cents) par ce facteur au lieu de donner le vrai total.
async function adminListCreators() {
  const { rows } = await query(`
    SELECT
      c.id, c.email, c.display_name, c.created_at,
      c.subscription_status, c.subscription_plan, c.trial_ends_at,
      c.telegram_webhook_ready,
      COALESCE(t.tier_count, 0) as tier_count,
      COALESCE(s.total_declared_cents, 0) as total_declared_cents,
      COALESCE(cm.conversations_30d, 0) as conversations_30d
    FROM creators c
    LEFT JOIN (
      SELECT creator_id, COUNT(*) as tier_count
      FROM tiers
      GROUP BY creator_id
    ) t ON t.creator_id = c.id
    LEFT JOIN (
      SELECT creator_id, SUM(amount_cents) as total_declared_cents
      FROM sale_declarations
      GROUP BY creator_id
    ) s ON s.creator_id = c.id
    LEFT JOIN (
      SELECT creator_id, COUNT(DISTINCT chat_id) as conversations_30d
      FROM conversation_messages
      WHERE created_at > now() - interval '30 days'
      GROUP BY creator_id
    ) cm ON cm.creator_id = c.id
    ORDER BY c.created_at DESC
  `);
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    displayName: r.display_name,
    createdAt: r.created_at,
    subscriptionStatus: r.subscription_status,
    subscriptionPlan: r.subscription_plan,
    trialEndsAt: r.trial_ends_at,
    telegramConnected: !!r.telegram_webhook_ready,
    tierCount: Number(r.tier_count),
    totalDeclaredCents: Number(r.total_declared_cents),
    conversations30d: Number(r.conversations_30d),
    commissionOwedCents: Math.round(Number(r.total_declared_cents) * COMMISSION_RATE),
  }));
}

module.exports = {
  id,
  hashPassword,
  verifyPassword,
  createCreator,
  getCreatorByEmail,
  getCreatorById,
  deleteCreator,
  updateCreatorPersona,
  updateCreatorProfile,
  updateCreatorTelegram,
  updateCreatorPasswordHash,
  updateCreatorSubscription,
  getCreatorByStripeCustomerId,
  createPasswordResetToken,
  consumePasswordResetToken,
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
  getConversationVolume,
  purgeOldConversations,
  adminListCreators,
  COMMISSION_RATE,
  TRIAL_DAYS,
};
