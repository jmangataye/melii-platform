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

// Backfill des créatrices pré-existantes (voir backfillLegacyCreators) —
// séparé de ensureSchema() plutôt que chaîné dedans, car backfillLegacyCreators
// appelle generateUniqueSlug/generateUniqueReferralCode qui utilisent
// query() : les chaîner dans schemaReadyPromise ferait attendre cette même
// promesse sur elle-même (deadlock permanent).
let backfillReadyPromise = null;
function ensureBackfilled() {
  if (!backfillReadyPromise) {
    backfillReadyPromise = ensureSchema()
      .then(() => backfillLegacyCreators())
      .catch((err) => {
        backfillReadyPromise = null;
        throw err;
      });
  }
  return backfillReadyPromise;
}

async function query(text, params) {
  await ensureBackfilled();
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
    slug: row.slug,
    galleryUrls: row.gallery_urls || [],
    referralCode: row.referral_code,
    referredByCreatorId: row.referred_by_creator_id,
    totpEnabled: !!row.totp_enabled,
    customDomain: row.custom_domain,
    customDomainVerifyToken: row.custom_domain_verify_token,
    customDomainVerified: !!row.custom_domain_verified,
    relanceEnabled: !!row.relance_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Durée de l'essai gratuit avant qu'un abonnement Stripe soit requis.
const TRIAL_DAYS = 4;

// --- Slugs (liens publics lisibles) --------------------------------------
// Un UUID dans une bio Instagram ("melii.../c/046c3371-3f9a-...") n'est ni
// lisible ni mémorisable. On dérive un slug du prénom affiché à
// l'inscription, avec repli automatique en cas de collision (luna, puis
// luna-2, luna-3...). L'id reste la clé primaire partout ailleurs — le slug
// n'est qu'un alias public, modifiable ensuite depuis le dashboard.
function slugify(text) {
  return (text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // accents (marques diacritiques après normalisation NFD)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// `queryFn` est injectable (défaut : la fonction `query()` normale, qui
// attend que le schéma + le backfill soient prêts) — nécessaire pour
// backfillLegacyCreators() ci-dessous, qui tourne PENDANT l'initialisation
// et doit donc utiliser le pool directement pour éviter un deadlock (une
// promesse qui s'attendrait elle-même à se résoudre).
async function slugExists(slug, excludeCreatorId, queryFn = query) {
  const { rows } = await queryFn(
    excludeCreatorId
      ? "SELECT 1 FROM creators WHERE slug = $1 AND id != $2"
      : "SELECT 1 FROM creators WHERE slug = $1",
    excludeCreatorId ? [slug, excludeCreatorId] : [slug]
  );
  return !!rows[0];
}

async function generateUniqueSlug(baseText, excludeCreatorId, queryFn = query) {
  const base = slugify(baseText) || "creatrice";
  let candidate = base;
  let n = 2;
  while (await slugExists(candidate, excludeCreatorId, queryFn)) {
    candidate = `${base}-${n}`;
    n++;
  }
  return candidate;
}

function randomCode(bytes = 5) {
  return crypto.randomBytes(bytes).toString("hex").toUpperCase();
}

async function generateUniqueReferralCode(queryFn = query) {
  for (let i = 0; i < 8; i++) {
    const code = randomCode();
    const { rows } = await queryFn("SELECT 1 FROM creators WHERE referral_code = $1", [code]);
    if (!rows[0]) return code;
  }
  throw new Error("Impossible de générer un code de parrainage unique (tentatives épuisées).");
}

// Migration de compatibilité : les créatrices créées AVANT l'introduction
// des slugs/du parrainage ont slug/referral_code à NULL — ALTER TABLE ADD
// COLUMN ne peut pas leur attribuer une valeur dérivée (ni garantir
// l'unicité) automatiquement. On les backfille ici, une seule fois par
// démarrage de process (voir ensureBackfilled()), avec le même générateur
// que createCreator utilise pour les nouvelles inscriptions. Utilise
// pool.query directement (jamais query()/ensureBackfilled()) pour éviter que
// cette promesse s'attende elle-même.
async function backfillLegacyCreators() {
  const rawQuery = (text, params) => pool.query(text, params);
  const { rows } = await rawQuery(
    `SELECT id, display_name FROM creators WHERE slug IS NULL OR referral_code IS NULL`
  );
  for (const row of rows) {
    const slug = await generateUniqueSlug(row.display_name, row.id, rawQuery);
    const referralCode = await generateUniqueReferralCode(rawQuery);
    await rawQuery(
      `UPDATE creators SET slug = COALESCE(slug, $1), referral_code = COALESCE(referral_code, $2) WHERE id = $3`,
      [slug, referralCode, row.id]
    );
  }
}

async function createCreator({ email, password, displayName, ageConfirmed, referralCode }) {
  const creatorId = id();
  const slug = await generateUniqueSlug(displayName);
  const myReferralCode = await generateUniqueReferralCode();
  const referrer = referralCode ? await getCreatorByReferralCode(referralCode) : null;

  await query(
    `INSERT INTO creators (id, email, password_hash, display_name, age_confirmed, subscription_status, trial_ends_at, slug, referral_code, referred_by_creator_id)
     VALUES ($1, $2, $3, $4, $5, 'trial', now() + make_interval(days => $6), $7, $8, $9)`,
    [
      creatorId,
      email.trim().toLowerCase(),
      hashPassword(password),
      displayName,
      !!ageConfirmed,
      TRIAL_DAYS,
      slug,
      myReferralCode,
      referrer ? referrer.id : null,
    ]
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

// Résout un lien public "/c/<valeur>" qu'il s'agisse encore d'un ancien lien
// UUID déjà partagé (jamais cassé) ou d'un slug lisible.
async function getCreatorBySlugOrId(value) {
  const { rows } = await query("SELECT * FROM creators WHERE id = $1 OR slug = $1 LIMIT 1", [
    value,
  ]);
  return rowToCreator(rows[0]);
}

async function getCreatorByReferralCode(code) {
  if (!code) return null;
  const { rows } = await query("SELECT * FROM creators WHERE referral_code = $1", [
    code.trim().toUpperCase(),
  ]);
  return rowToCreator(rows[0]);
}

const SLUG_FORMAT = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

class SlugTakenError extends Error {}

async function updateCreatorSlug(creatorId, rawSlug) {
  const slug = slugify(rawSlug);
  if (!SLUG_FORMAT.test(slug)) {
    throw new Error("Format de lien invalide (lettres, chiffres et tirets, 2 à 40 caractères).");
  }
  if (await slugExists(slug, creatorId)) {
    throw new SlugTakenError("Ce lien est déjà pris par une autre créatrice.");
  }
  await query(`UPDATE creators SET slug = $1, updated_at = now() WHERE id = $2`, [slug, creatorId]);
  return getCreatorById(creatorId);
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
// `galleryUrls` est optionnel dans l'objet passé : `undefined` = "ne pas
// toucher" (lecture de la valeur actuelle avant écriture), contrairement à
// `[]` qui vide vraiment la galerie. Sans cette distinction, un simple
// changement de couleur d'accent depuis l'ancien formulaire (qui n'envoie
// jamais galleryUrls) effacerait silencieusement la galerie à chaque save.
async function updateCreatorProfile(creatorId, { avatarUrl, accentColor, galleryUrls } = {}) {
  const current = await getCreatorById(creatorId);
  if (!current) return null;
  await query(
    `UPDATE creators
     SET avatar_url = $1, accent_color = $2, gallery_urls = $3, updated_at = now()
     WHERE id = $4`,
    [
      avatarUrl === undefined ? current.avatarUrl : avatarUrl || null,
      accentColor === undefined ? current.accentColor : accentColor || null,
      galleryUrls === undefined ? current.galleryUrls : galleryUrls,
      creatorId,
    ]
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

// --- Parrainage entre créatrices -----------------------------------------
// -1 point de commission par filleule inscrite via le code de parrainage,
// plafonné à -5 points — un vrai avantage visible sans avoir à attendre que
// la facturation Stripe soit branchée pour distinguer une filleule "active"
// d'une autre (v1 compte toute filleule inscrite ; resserrer à "abonnement
// payant actif" sera un simple ajout de `WHERE subscription_status =
// 'active'` le jour où Stripe est en ligne).
const REFERRAL_DISCOUNT_PER_REFERRAL = 0.01;
const REFERRAL_DISCOUNT_CAP = 0.05;

async function getReferralCount(creatorId) {
  const { rows } = await query(
    `SELECT COUNT(*) as n FROM creators WHERE referred_by_creator_id = $1`,
    [creatorId]
  );
  return Number(rows[0].n);
}

function effectiveCommissionRate(referralCount) {
  const discount = Math.min(referralCount * REFERRAL_DISCOUNT_PER_REFERRAL, REFERRAL_DISCOUNT_CAP);
  return Math.round((COMMISSION_RATE - discount) * 10000) / 10000;
}

// Série journalière de clics sur les `days` derniers jours (aujourd'hui
// inclus), avec les jours sans clic explicitement à 0 plutôt qu'absents —
// nécessaire pour tracer un vrai graphique sans "trous" à interpréter côté
// front. `generate_series` fournit l'axe des jours, LEFT JOIN comble les
// jours sans ligne dans click_events.
async function getClicksByDay(creatorId, days = 14) {
  const { rows } = await query(
    `SELECT to_char(d.day, 'YYYY-MM-DD') as day, COALESCE(c.clicks, 0) as clicks
     FROM generate_series(
       (now()::date - make_interval(days => $2 - 1)),
       now()::date,
       interval '1 day'
     ) as d(day)
     LEFT JOIN (
       SELECT created_at::date as day, COUNT(*) as clicks
       FROM click_events
       WHERE creator_id = $1 AND created_at > now() - make_interval(days => $2)
       GROUP BY created_at::date
     ) c ON c.day = d.day
     ORDER BY d.day`,
    [creatorId, days]
  );
  return rows.map((r) => ({ day: r.day, clicks: Number(r.clicks) }));
}

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
  const clicksByDay = await getClicksByDay(creatorId, 14);
  const referralCount = await getReferralCount(creatorId);
  const commissionRate = effectiveCommissionRate(referralCount);

  return {
    clicksByTier: Object.fromEntries(clicksByTier.map((r) => [r.tier_id, Number(r.clicks)])),
    clicksByDay,
    totalDeclaredCents,
    commissionRate,
    commissionOwedCents: Math.round(totalDeclaredCents * commissionRate),
    referralCount,
  };
}

// --- Historique de conversation (persistant, multi-créatrices) -------

async function appendMessage({ creatorId, chatId, role, content, flagged = false }) {
  await query(
    `INSERT INTO conversation_messages (id, creator_id, chat_id, role, content, flagged)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id(), creatorId, String(chatId), role, content, !!flagged]
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

// --- Modération (mots-clés de sécurité) ----------------------------------
// Vue admin, plateforme entière : les messages qui ont déclenché
// containsSafetyKeyword (détresse, minorité, chantage...) sont marqués à
// l'écriture (voir lib/chat-engine.ts) plutôt que d'être perdus — utile pour
// que Bryan puisse vérifier un signalement réel sans avoir à lire
// l'intégralité de l'historique de chaque créatrice.
async function listFlaggedConversations(limit = 50) {
  const { rows } = await query(
    `SELECT cm.id, cm.creator_id, cm.chat_id, cm.content, cm.created_at,
            c.display_name, c.email
     FROM conversation_messages cm
     JOIN creators c ON c.id = cm.creator_id
     WHERE cm.flagged = true AND cm.flag_reviewed = false
     ORDER BY cm.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows.map((r) => ({
    id: r.id,
    creatorId: r.creator_id,
    chatId: r.chat_id,
    content: r.content,
    createdAt: r.created_at,
    creatorDisplayName: r.display_name,
    creatorEmail: r.email,
  }));
}

async function markFlagReviewed(messageId) {
  const { rowCount } = await query(
    `UPDATE conversation_messages SET flag_reviewed = true WHERE id = $1 AND flagged = true`,
    [messageId]
  );
  return rowCount > 0;
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
      COALESCE(cm.conversations_30d, 0) as conversations_30d,
      COALESCE(rc.referral_count, 0) as referral_count
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
    LEFT JOIN (
      SELECT referred_by_creator_id as creator_id, COUNT(*) as referral_count
      FROM creators
      WHERE referred_by_creator_id IS NOT NULL
      GROUP BY referred_by_creator_id
    ) rc ON rc.creator_id = c.id
    ORDER BY c.created_at DESC
  `);
  return rows.map((r) => {
    const commissionRate = effectiveCommissionRate(Number(r.referral_count));
    return {
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
      referralCount: Number(r.referral_count),
      commissionRate,
      commissionOwedCents: Math.round(Number(r.total_declared_cents) * commissionRate),
    };
  });
}

// --- Domaine personnalisé (app-side) --------------------------------------
// Une créatrice peut brancher son propre domaine (ex. lunabot.com) sur sa
// page de chat. Ce que Melii peut faire seul : générer un jeton à poser en
// enregistrement DNS TXT et vérifier sa présence (dns.resolveTxt, voir
// apps/web/lib/custom-domain.ts), puis router les requêtes qui arrivent avec
// ce Host vers la bonne créatrice (voir middleware.ts). Ce que Melii NE PEUT
// PAS faire à la place de l'utilisateur : ajouter le domaine dans les
// réglages du service Render pour que le certificat TLS soit émis — Render
// ne l'expose pas via les outils MCP disponibls ici, c'est une étape
// manuelle unique côté tableau de bord Render, documentée dans le README.
function generateDomainVerifyToken() {
  return `melii-verify-${crypto.randomBytes(12).toString("hex")}`;
}

async function setCustomDomainPending(creatorId, domain) {
  const cleanDomain = domain ? domain.trim().toLowerCase() : null;
  const token = cleanDomain ? generateDomainVerifyToken() : null;

  if (cleanDomain) {
    // Libère un domaine resté "en attente" (jamais vérifié) chez une autre
    // créatrice depuis plus de 48h avant de le réattribuer. Sans ça,
    // n'importe quel compte pourrait revendiquer un nom de domaine sans
    // jamais poser le enregistrement TXT demandé, et bloquer indéfiniment
    // sa vraie propriétaire derrière la contrainte UNIQUE — un squat gratuit.
    // Un domaine déjà VÉRIFIÉ (custom_domain_verified = true) n'est jamais
    // libéré par ce mécanisme, seulement une revendication encore en attente.
    await query(
      `UPDATE creators
       SET custom_domain = NULL, custom_domain_verify_token = NULL, updated_at = now()
       WHERE custom_domain = $1 AND custom_domain_verified = false AND id != $2
         AND updated_at < now() - interval '48 hours'`,
      [cleanDomain, creatorId]
    );
  }

  await query(
    `UPDATE creators
     SET custom_domain = $1, custom_domain_verify_token = $2, custom_domain_verified = false, updated_at = now()
     WHERE id = $3`,
    [cleanDomain, token, creatorId]
  );
  return getCreatorById(creatorId);
}

async function markCustomDomainVerified(creatorId) {
  await query(
    `UPDATE creators SET custom_domain_verified = true, updated_at = now() WHERE id = $1`,
    [creatorId]
  );
  return getCreatorById(creatorId);
}

async function getCreatorByCustomDomain(domain) {
  if (!domain) return null;
  const { rows } = await query(
    `SELECT * FROM creators WHERE custom_domain = $1 AND custom_domain_verified = true`,
    [domain.trim().toLowerCase()]
  );
  return rowToCreator(rows[0]);
}

// --- 2FA (TOTP, RFC 6238) --------------------------------------------------
// Implémenté à la main avec le module natif "crypto" plutôt que d'ajouter
// une dépendance externe (speakeasy/otplib) pour un algorithme standard,
// stable, et compatible Google Authenticator / Authy en une cinquantaine de
// lignes bien connues.
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buffer) {
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  let output = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    output += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  const remainder = bits.length % 5;
  if (remainder > 0) {
    const lastChunk = bits.slice(bits.length - remainder).padEnd(5, "0");
    output += BASE32_ALPHABET[parseInt(lastChunk, 2)];
  }
  return output;
}

function base32Decode(encoded) {
  const clean = (encoded || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const char of clean) {
    const val = BASE32_ALPHABET.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateTotpSecret() {
  return base32Encode(crypto.randomBytes(20)); // 32 caractères — standard pour Google Authenticator
}

function totpCodeAt(secret, stepIndex) {
  const key = base32Decode(secret);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(stepIndex));
  const hmac = crypto.createHmac("sha1", key).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binCode % 1000000).padStart(6, "0");
}

// Tolère un décalage d'horloge de +/- 1 pas (30s) pour rester utilisable même
// si l'horloge du téléphone dérive légèrement.
function verifyTotpCode(secret, code, window = 1) {
  if (!/^\d{6}$/.test(String(code || ""))) return false;
  const step = Math.floor(Date.now() / 1000 / 30);
  for (let errorWindow = -window; errorWindow <= window; errorWindow++) {
    if (totpCodeAt(secret, step + errorWindow) === String(code)) return true;
  }
  return false;
}

function totpAuthUrl(secret, email) {
  const label = encodeURIComponent(`Melii:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=Melii&algorithm=SHA1&digits=6&period=30`;
}

function generateBackupCodes(count = 8) {
  const codes = [];
  for (let i = 0; i < count; i++) codes.push(crypto.randomBytes(4).toString("hex"));
  return codes;
}

// Renvoie le secret en clair pour l'enrôlement (affiché une fois, avant
// activation) — pas encore stocké tant que enableTotp() n'a pas confirmé un
// code valide, pour ne pas activer un secret que la créatrice n'a jamais pu
// scanner avec succès.
function beginTotpEnrollment() {
  return generateTotpSecret();
}

async function enableTotp(creatorId, secret) {
  const backupCodes = generateBackupCodes();
  const hashedBackupCodes = backupCodes.map((c) => hashPassword(c));
  await query(
    `UPDATE creators SET totp_secret = $1, totp_enabled = true, totp_backup_codes = $2, updated_at = now() WHERE id = $3`,
    [secret, hashedBackupCodes, creatorId]
  );
  return backupCodes; // en clair, une seule fois — à afficher immédiatement à la créatrice
}

async function disableTotp(creatorId) {
  await query(
    `UPDATE creators SET totp_secret = NULL, totp_enabled = false, totp_backup_codes = '{}', updated_at = now() WHERE id = $1`,
    [creatorId]
  );
}

// Le secret brut n'est JAMAIS exposé via rowToCreator()/l'API — uniquement
// via cette fonction interne, utilisée par le flux de connexion et
// d'activation.
async function getTotpSecretRaw(creatorId) {
  const { rows } = await query("SELECT totp_secret, totp_enabled FROM creators WHERE id = $1", [
    creatorId,
  ]);
  return rows[0] ? { secret: rows[0].totp_secret, enabled: !!rows[0].totp_enabled } : null;
}

async function consumeBackupCode(creatorId, code) {
  const { rows } = await query("SELECT totp_backup_codes FROM creators WHERE id = $1", [
    creatorId,
  ]);
  const hashedCodes = rows[0]?.totp_backup_codes || [];
  const matchIndex = hashedCodes.findIndex((h) => verifyPassword(code, h));
  if (matchIndex === -1) return false;
  const remaining = hashedCodes.slice();
  remaining.splice(matchIndex, 1);
  await query("UPDATE creators SET totp_backup_codes = $1 WHERE id = $2", [remaining, creatorId]);
  return true;
}

// --- Relances automatiques (Telegram uniquement, opt-in) ------------------
// Trouve les conversations Telegram "abandonnées" : la personne a cliqué sur
// un palier (click_events, avec un telegram_chat_id — donc forcément via
// Telegram, pas le chat web) mais n'a plus écrit au bot depuis au moins 24h
// (et moins de 7 jours, pour ne pas ressusciter de très vieilles
// conversations). Exclut totalement : les créatrices qui n'ont pas activé
// `relance_enabled`, les conversations déjà relancées une fois
// (conversation_relances), et — garde-fou de sécurité non négociable — toute
// conversation qui contient un message flagged (signal de détresse/mineur/
// chantage détecté) : on ne relance jamais quelqu'un dans ce cas.
async function findStalledTelegramConversations(limit = 20) {
  const { rows } = await query(
    `SELECT DISTINCT ON (ce.creator_id, ce.telegram_chat_id)
            ce.creator_id, ce.telegram_chat_id as chat_id, ce.tier_id,
            c.telegram_bot_token, c.display_name
     FROM click_events ce
     JOIN creators c ON c.id = ce.creator_id
     WHERE c.relance_enabled = true
       AND ce.telegram_chat_id IS NOT NULL
       AND ce.created_at < now() - interval '24 hours'
       AND ce.created_at > now() - interval '7 days'
       AND NOT EXISTS (
         SELECT 1 FROM conversation_relances r
         WHERE r.creator_id = ce.creator_id AND r.chat_id = ce.telegram_chat_id
       )
       AND NOT EXISTS (
         SELECT 1 FROM conversation_messages cm
         WHERE cm.creator_id = ce.creator_id AND cm.chat_id = ce.telegram_chat_id AND cm.flagged = true
       )
       AND NOT EXISTS (
         SELECT 1 FROM conversation_messages cm2
         WHERE cm2.creator_id = ce.creator_id AND cm2.chat_id = ce.telegram_chat_id
           AND cm2.created_at > ce.created_at
       )
     ORDER BY ce.creator_id, ce.telegram_chat_id, ce.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows.map((r) => ({
    creatorId: r.creator_id,
    chatId: r.chat_id,
    tierId: r.tier_id,
    telegramBotToken: r.telegram_bot_token,
    creatorDisplayName: r.display_name,
  }));
}

// Interrupteur simple, opt-in par défaut désactivé — voir le toggle dans
// l'onglet Telegram du dashboard.
async function updateCreatorRelance(creatorId, enabled) {
  await query(`UPDATE creators SET relance_enabled = $1, updated_at = now() WHERE id = $2`, [
    !!enabled,
    creatorId,
  ]);
  return getCreatorById(creatorId);
}

async function recordRelanceSent({ creatorId, chatId, tierId }) {
  // ON CONFLICT DO NOTHING : filet de sécurité en plus du NOT EXISTS
  // ci-dessus — même en cas de double exécution concurrente du job, la
  // contrainte UNIQUE (creator_id, chat_id) empêche un deuxième envoi.
  await query(
    `INSERT INTO conversation_relances (id, creator_id, chat_id, tier_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (creator_id, chat_id) DO NOTHING`,
    [id(), creatorId, chatId, tierId || null]
  );
}

module.exports = {
  id,
  hashPassword,
  verifyPassword,
  createCreator,
  getCreatorByEmail,
  getCreatorById,
  getCreatorBySlugOrId,
  getCreatorByReferralCode,
  updateCreatorSlug,
  SlugTakenError,
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
  getClicksByDay,
  getReferralCount,
  appendMessage,
  getRecentMessages,
  getConversationVolume,
  purgeOldConversations,
  listFlaggedConversations,
  markFlagReviewed,
  adminListCreators,
  setCustomDomainPending,
  markCustomDomainVerified,
  getCreatorByCustomDomain,
  beginTotpEnrollment,
  enableTotp,
  disableTotp,
  getTotpSecretRaw,
  verifyTotpCode,
  totpAuthUrl,
  consumeBackupCode,
  findStalledTelegramConversations,
  recordRelanceSent,
  updateCreatorRelance,
  // Exporté uniquement pour les tests (voir new-features.test.js) — le
  // backfill réel passe par ensureBackfilled(), mis en cache par process ;
  // ce export permet de le redéclencher explicitement dans un test sans
  // dépendre de ce cache.
  backfillLegacyCreators,
  COMMISSION_RATE,
  REFERRAL_DISCOUNT_PER_REFERRAL,
  REFERRAL_DISCOUNT_CAP,
  TRIAL_DAYS,
};
