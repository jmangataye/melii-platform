// Tests d'intégration pour les fonctionnalités ajoutées cette session
// (slugs, parrainage, 2FA/TOTP, galerie photo, domaine personnalisé,
// relances Telegram) — même style et mêmes garanties que db.test.js
// (vraie base Postgres, données isolées par email/valeurs uniques).

const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const { Pool } = require("pg");
const crypto = require("node:crypto");

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL manquant — ces tests ont besoin d'une vraie base Postgres. Voir README."
  );
  process.exit(1);
}

const db = require("../index");

// Pool séparé utilisé uniquement pour préparer des états que l'API publique
// ne permet pas de créer directement (ex. un clic vieux de 2 jours, pour
// tester la fenêtre de relance sans attendre).
const rawPool = new Pool({ connectionString: process.env.DATABASE_URL });

after(async () => {
  await rawPool.end();
});

function uniqueEmail(label) {
  return `test-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

async function makeCreator(label, overrides = {}) {
  return db.createCreator({
    email: uniqueEmail(label),
    password: "password123",
    displayName: overrides.displayName || label,
    ageConfirmed: true,
    referralCode: overrides.referralCode,
  });
}

// --- Slugs (liens publics lisibles) --------------------------------------

test("createCreator dérive un slug lisible du prénom affiché (accents supprimés, minuscules, tirets)", async () => {
  // Suffixe unique pour que le slug attendu ne rentre jamais en collision
  // avec une exécution précédente du test (le slug est UNIQUE en base).
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const c = await makeCreator("slugbase", { displayName: `Luna Étoile ${suffix}` });
  assert.equal(c.slug, `luna-etoile-${suffix}`);
});

test("createCreator retombe sur slug-2 en cas de collision de prénom", async () => {
  const first = await makeCreator("slugcollision1", { displayName: `Collision${Date.now()}` });
  const second = await makeCreator("slugcollision2", { displayName: first.displayName });
  assert.equal(second.slug, `${first.slug}-2`);
});

test("updateCreatorSlug change le slug si le format est valide et libre", async () => {
  const c = await makeCreator("slugupdate");
  const newSlug = `mon-slug-${Date.now()}`;
  const updated = await db.updateCreatorSlug(c.id, newSlug);
  assert.equal(updated.slug, newSlug);
});

test("updateCreatorSlug rejette une valeur qui ne laisse plus aucun caractère valide après nettoyage", async () => {
  const c = await makeCreator("slugbadformat");
  // slugify("!!!") -> "" (tout est retiré puis les tirets de bord coupés) —
  // ne correspond pas à SLUG_FORMAT qui exige au moins un caractère.
  await assert.rejects(() => db.updateCreatorSlug(c.id, "!!!"), /Format de lien invalide/);
});

test("updateCreatorSlug lève SlugTakenError si le slug est déjà pris par une autre créatrice", async () => {
  const a = await makeCreator("slugtakena");
  const b = await makeCreator("slugtakenb");
  await assert.rejects(() => db.updateCreatorSlug(b.id, a.slug), db.SlugTakenError);
});

test("getCreatorBySlugOrId résout à la fois par slug et par id, sans casser un ancien lien", async () => {
  const c = await makeCreator("slugorid");
  const bySlug = await db.getCreatorBySlugOrId(c.slug);
  const byId = await db.getCreatorBySlugOrId(c.id);
  assert.equal(bySlug.id, c.id);
  assert.equal(byId.id, c.id);
});

test("les créatrices déjà en base sans slug/referral_code (migration ADD COLUMN) sont backfillées automatiquement", async () => {
  const c = await makeCreator("legacybackfill");

  // Simule une créatrice créée AVANT l'introduction des slugs/du parrainage :
  // ALTER TABLE ADD COLUMN laisse ces colonnes à NULL pour les lignes
  // existantes, jamais atteignable via l'API publique de @melii/db.
  await rawPool.query(`UPDATE creators SET slug = NULL, referral_code = NULL WHERE id = $1`, [c.id]);
  const before = await db.getCreatorById(c.id);
  assert.equal(before.slug, null);
  assert.equal(before.referralCode, null);

  // Le vrai déclenchement automatique (ensureBackfilled()) ne tourne qu'une
  // fois par process et est déjà passé bien avant ce test — on appelle donc
  // la fonction de backfill elle-même directement (exportée pour les tests)
  // plutôt que de dépendre de ce cache par process.
  await db.backfillLegacyCreators();

  const after = await db.getCreatorById(c.id);
  assert.ok(after.slug, "un slug doit avoir été généré");
  assert.ok(after.referralCode, "un code de parrainage doit avoir été généré");
});

// --- Parrainage entre créatrices ------------------------------------------

test("createCreator avec un referralCode valide attribue referredByCreatorId", async () => {
  const referrer = await makeCreator("refparent");
  const referred = await makeCreator("refchild", { referralCode: referrer.referralCode });
  assert.equal(referred.referredByCreatorId, referrer.id);
});

test("createCreator avec un referralCode inconnu n'échoue pas, referredByCreatorId reste null", async () => {
  const c = await makeCreator("refunknown", { referralCode: "CODE-INEXISTANT-XYZ" });
  assert.equal(c.referredByCreatorId, null);
});

test("getReferralCount / getStats reflètent le nombre de filleules et réduisent la commission", async () => {
  const referrer = await makeCreator("refcountparent");
  assert.equal(await db.getReferralCount(referrer.id), 0);

  await makeCreator("refcountchild1", { referralCode: referrer.referralCode });
  await makeCreator("refcountchild2", { referralCode: referrer.referralCode });

  assert.equal(await db.getReferralCount(referrer.id), 2);

  const stats = await db.getStats(referrer.id);
  assert.equal(stats.referralCount, 2);
  // 2 filleules x 1 point de réduction = taux de base - 0.02
  assert.equal(stats.commissionRate, Math.round((db.COMMISSION_RATE - 0.02) * 10000) / 10000);
});

test("la réduction de commission par parrainage est plafonnée à REFERRAL_DISCOUNT_CAP", async () => {
  const referrer = await makeCreator("refcapparent");
  // Largement au-dessus du nombre nécessaire pour atteindre le plafond.
  for (let i = 0; i < 10; i++) {
    await makeCreator(`refcapchild${i}`, { referralCode: referrer.referralCode });
  }
  const stats = await db.getStats(referrer.id);
  const minRate = Math.round((db.COMMISSION_RATE - db.REFERRAL_DISCOUNT_CAP) * 10000) / 10000;
  assert.equal(stats.commissionRate, minRate);
});

// --- 2FA (TOTP, RFC 6238) --------------------------------------------------

test("beginTotpEnrollment + totpAuthUrl produisent une URL otpauth exploitable", async () => {
  const c = await makeCreator("totpurl");
  const secret = db.beginTotpEnrollment();
  const url = db.totpAuthUrl(secret, c.email);
  assert.match(url, /^otpauth:\/\/totp\//);
  assert.ok(url.includes(`secret=${secret}`));
  assert.ok(url.includes("issuer=Melii"));
});

// Base32 decode + TOTP (RFC 6238) réimplémentés indépendamment ici plutôt
// que réutilisés depuis index.js — sinon un bug dans l'implémentation
// interne se validerait lui-même. Vérifié contre le vecteur de test officiel
// RFC 6238 Annexe B avant d'être utilisé contre verifyTotpCode ci-dessous.
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32DecodeIndependent(encoded) {
  const clean = encoded.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const ch of clean) bits += BASE32_ALPHABET.indexOf(ch).toString(2).padStart(5, "0");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
function totpCodeIndependent(secret, stepIndex) {
  const key = base32DecodeIndependent(secret);
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

test("l'implémentation TOTP indépendante du test matche le vecteur officiel RFC 6238 (Annexe B, secret ASCII '12345678901234567890', T=59s → compteur 1)", () => {
  // Secret RFC 6238 en base32 (20 octets ASCII "12345678901234567890").
  const secretBase32 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  assert.equal(totpCodeIndependent(secretBase32, 1), "287082");
});

test("verifyTotpCode valide un vrai code TOTP généré pour l'instant présent, rejette un code aléatoire", async () => {
  const secret = db.beginTotpEnrollment();
  const step = Math.floor(Date.now() / 1000 / 30);
  const realCode = totpCodeIndependent(secret, step);

  assert.equal(db.verifyTotpCode(secret, realCode), true);
  // "000000" a une chance sur un million d'être le vrai code — négligeable ici.
  assert.equal(db.verifyTotpCode(secret, "000000"), false);
  assert.equal(db.verifyTotpCode(secret, "not-a-code"), false);
});

test("enableTotp active le 2FA, renvoie des codes de secours en clair, et getTotpSecretRaw le confirme", async () => {
  const c = await makeCreator("totpenable");
  const secret = db.beginTotpEnrollment();
  const backupCodes = await db.enableTotp(c.id, secret);

  assert.equal(backupCodes.length, 8);
  assert.ok(backupCodes.every((code) => /^[0-9a-f]{8}$/.test(code)));

  const raw = await db.getTotpSecretRaw(c.id);
  assert.equal(raw.enabled, true);
  assert.equal(raw.secret, secret);

  const reloaded = await db.getCreatorById(c.id);
  assert.equal(reloaded.totpEnabled, true);
});

test("consumeBackupCode accepte un code valide une seule fois", async () => {
  const c = await makeCreator("totpbackup");
  const secret = db.beginTotpEnrollment();
  const backupCodes = await db.enableTotp(c.id, secret);
  const code = backupCodes[0];

  assert.equal(await db.consumeBackupCode(c.id, code), true);
  assert.equal(await db.consumeBackupCode(c.id, code), false);
});

test("disableTotp efface le secret et repasse totpEnabled à false", async () => {
  const c = await makeCreator("totpdisable");
  const secret = db.beginTotpEnrollment();
  await db.enableTotp(c.id, secret);
  await db.disableTotp(c.id);

  const raw = await db.getTotpSecretRaw(c.id);
  assert.equal(raw.enabled, false);
  assert.equal(raw.secret, null);
});

// --- Galerie photo (Apparence) --------------------------------------------

test("updateCreatorProfile enregistre la galerie, et un appel sans galleryUrls ne l'efface pas (régression)", async () => {
  const c = await makeCreator("gallery");
  const urls = ["https://example.com/a.jpg", "https://example.com/b.jpg"];

  const withGallery = await db.updateCreatorProfile(c.id, { galleryUrls: urls });
  assert.deepEqual(withGallery.galleryUrls, urls);

  // Simule l'ancien formulaire "Apparence" qui n'envoie jamais galleryUrls :
  // ne doit PAS vider la galerie déjà enregistrée.
  const afterColorChange = await db.updateCreatorProfile(c.id, { accentColor: "#123456" });
  assert.deepEqual(afterColorChange.galleryUrls, urls);
});

test("updateCreatorProfile vide vraiment la galerie quand galleryUrls: [] est fourni explicitement", async () => {
  const c = await makeCreator("gallerywipe");
  await db.updateCreatorProfile(c.id, { galleryUrls: ["https://example.com/a.jpg"] });
  const cleared = await db.updateCreatorProfile(c.id, { galleryUrls: [] });
  assert.deepEqual(cleared.galleryUrls, []);
});

// --- Domaine personnalisé ---------------------------------------------------

test("setCustomDomainPending génère un jeton et laisse le domaine non vérifié", async () => {
  const c = await makeCreator("domainpending");
  const domain = `lunabot-${Date.now()}-${Math.floor(Math.random() * 1000)}.example.com`;
  const updated = await db.setCustomDomainPending(c.id, domain);
  assert.equal(updated.customDomain, domain);
  assert.ok(updated.customDomainVerifyToken);
  assert.equal(updated.customDomainVerified, false);
});

test("getCreatorByCustomDomain ne renvoie rien tant que le domaine n'est pas vérifié, puis le trouve après markCustomDomainVerified", async () => {
  const c = await makeCreator("domainverify");
  const domain = `lunabot-${Date.now()}.example.com`;
  await db.setCustomDomainPending(c.id, domain);

  assert.equal(await db.getCreatorByCustomDomain(domain), null);

  await db.markCustomDomainVerified(c.id);
  const found = await db.getCreatorByCustomDomain(domain);
  assert.equal(found.id, c.id);
});

test("setCustomDomainPending(null) retire le domaine", async () => {
  const c = await makeCreator("domainclear");
  const domain = `toclear-${Date.now()}-${Math.floor(Math.random() * 1000)}.example.com`;
  await db.setCustomDomainPending(c.id, domain);
  const cleared = await db.setCustomDomainPending(c.id, null);
  assert.equal(cleared.customDomain, null);
  assert.equal(cleared.customDomainVerifyToken, null);
});

test("setCustomDomainPending refuse un domaine encore verrouillé (en attente, récent) par une autre créatrice", async () => {
  const squatter = await makeCreator("domainsquatrecent");
  const victim = await makeCreator("domainvictimrecent");
  const domain = `contested-recent-${Date.now()}.example.com`;

  await db.setCustomDomainPending(squatter.id, domain);
  // Revendication récente (updated_at = now(), le défaut) : doit rester bloquée.
  await assert.rejects(() => db.setCustomDomainPending(victim.id, domain));
});

test("setCustomDomainPending refuse un domaine appartenant à une autre créatrice même s'il est VÉRIFIÉ et ancien (jamais libéré)", async () => {
  const owner = await makeCreator("domainownerverified");
  const attacker = await makeCreator("domainattackerverified");
  const domain = `verified-old-${Date.now()}.example.com`;

  await db.setCustomDomainPending(owner.id, domain);
  await db.markCustomDomainVerified(owner.id);
  // On simule une revendication vérifiée vieille de 90 jours : un domaine
  // vérifié ne doit JAMAIS être libéré automatiquement, quel que soit l'âge.
  await rawPool.query(
    `UPDATE creators SET updated_at = now() - interval '90 days' WHERE id = $1`,
    [owner.id]
  );
  await assert.rejects(() => db.setCustomDomainPending(attacker.id, domain));
  const stillOwner = await db.getCreatorByCustomDomain(domain);
  assert.equal(stillOwner.id, owner.id);
});

test("setCustomDomainPending libère un domaine en attente (jamais vérifié) resté bloqué plus de 48h chez une autre créatrice (anti-squat)", async () => {
  const squatter = await makeCreator("domainsquatstale");
  const claimant = await makeCreator("domainclaimantstale");
  const domain = `contested-stale-${Date.now()}.example.com`;

  await db.setCustomDomainPending(squatter.id, domain);
  // Simule une revendication non vérifiée oubliée depuis 3 jours.
  await rawPool.query(
    `UPDATE creators SET updated_at = now() - interval '72 hours' WHERE id = $1`,
    [squatter.id]
  );

  const claimed = await db.setCustomDomainPending(claimant.id, domain);
  assert.equal(claimed.customDomain, domain);
  assert.equal(claimed.customDomainVerified, false);

  const squatterAfter = await db.getCreatorById(squatter.id);
  assert.equal(squatterAfter.customDomain, null, "le squatteur doit avoir perdu sa revendication en attente");
});

// --- Relances automatiques (Telegram, opt-in) ------------------------------

test("updateCreatorRelance active/désactive le drapeau sur la créatrice", async () => {
  const c = await makeCreator("relancetoggle");
  assert.equal(c.relanceEnabled, false);
  const enabled = await db.updateCreatorRelance(c.id, true);
  assert.equal(enabled.relanceEnabled, true);
  const disabled = await db.updateCreatorRelance(c.id, false);
  assert.equal(disabled.relanceEnabled, false);
});

test("findStalledTelegramConversations ignore les créatrices sans relance_enabled", async () => {
  const c = await makeCreator("relancedisabled");
  const tier = await db.upsertTier(c.id, { order: 1, label: "Palier 1", priceCents: 500, url: "https://pay.example.com/1" });
  const chatId = `chat-${Date.now()}`;

  // Clic Telegram vieux de 2 jours (dans la fenêtre 24h-7j), mais relance
  // désactivée par défaut.
  await rawPool.query(
    `INSERT INTO click_events (id, creator_id, tier_id, telegram_chat_id, created_at)
     VALUES ($1, $2, $3, $4, now() - interval '2 days')`,
    [db.id(), c.id, tier.id, chatId]
  );

  const stalled = await db.findStalledTelegramConversations(50);
  assert.ok(!stalled.some((s) => s.creatorId === c.id && s.chatId === chatId));
});

test("findStalledTelegramConversations trouve une conversation abandonnée éligible, et recordRelanceSent empêche un doublon", async () => {
  const c = await makeCreator("relanceeligible");
  await db.updateCreatorTelegram(c.id, {
    token: "fake-token",
    username: "fake_bot",
    webhookSecret: "secret",
    webhookReady: true,
  });
  const tier = await db.upsertTier(c.id, { order: 1, label: "Palier 1", priceCents: 500, url: "https://pay.example.com/1" });
  const chatId = `chat-${Date.now()}`;

  await rawPool.query(
    `INSERT INTO click_events (id, creator_id, tier_id, telegram_chat_id, created_at)
     VALUES ($1, $2, $3, $4, now() - interval '2 days')`,
    [db.id(), c.id, tier.id, chatId]
  );
  await db.updateCreatorRelance(c.id, true);

  const stalled = await db.findStalledTelegramConversations(50);
  const match = stalled.find((s) => s.creatorId === c.id && s.chatId === chatId);
  assert.ok(match, "la conversation abandonnée éligible doit être trouvée");
  assert.equal(match.telegramBotToken, "fake-token");

  await db.recordRelanceSent({ creatorId: c.id, chatId, tierId: tier.id });

  const stalledAfter = await db.findStalledTelegramConversations(50);
  assert.ok(
    !stalledAfter.some((s) => s.creatorId === c.id && s.chatId === chatId),
    "une conversation déjà relancée ne doit plus apparaître"
  );
});

// --- Langue du bot ---------------------------------------------------------

test("createCreator crée une créatrice avec persona_language = 'fr' par défaut", async () => {
  const c = await makeCreator("langdefault");
  assert.equal(c.personaLanguage, "fr");
});

test("updateCreatorPersona change la langue quand elle est fournie", async () => {
  const c = await makeCreator("langupdate");
  const updated = await db.updateCreatorPersona(c.id, {
    tone: "doux_complice",
    bio: "",
    displayName: c.displayName,
    language: "en",
  });
  assert.equal(updated.personaLanguage, "en");
});

test("updateCreatorPersona sans language conserve la langue déjà enregistrée (régression)", async () => {
  const c = await makeCreator("langkeep");
  await db.updateCreatorPersona(c.id, { tone: "doux_complice", bio: "", displayName: c.displayName, language: "es" });
  // Simule un appel qui n'envoie pas encore `language` (ex. ancien client) —
  // ne doit pas silencieusement repasser à 'fr'.
  const afterToneChange = await db.updateCreatorPersona(c.id, {
    tone: "direct_vendeur",
    bio: "",
    displayName: c.displayName,
  });
  assert.equal(afterToneChange.personaLanguage, "es");
});

// --- Tracking par lien (attribution de source) ------------------------------

test("logLinkVisit + getVisitsBySource regroupent les visites par source, triées par volume décroissant", async () => {
  const c = await makeCreator("visitssource");
  await db.logLinkVisit({ creatorId: c.id, source: "bio" });
  await db.logLinkVisit({ creatorId: c.id, source: "bio" });
  await db.logLinkVisit({ creatorId: c.id, source: "story" });

  const bySource = await db.getVisitsBySource(c.id, 14);
  assert.deepEqual(bySource, [
    { source: "bio", visits: 2 },
    { source: "story", visits: 1 },
  ]);
});

test("logLinkVisit sans source retombe sur 'direct'", async () => {
  const c = await makeCreator("visitsdirect");
  await db.logLinkVisit({ creatorId: c.id });
  const bySource = await db.getVisitsBySource(c.id, 14);
  assert.deepEqual(bySource, [{ source: "direct", visits: 1 }]);
});

test("getVisitsBySource ignore les visites hors de la fenêtre demandée", async () => {
  const c = await makeCreator("visitswindow");
  await db.logLinkVisit({ creatorId: c.id, source: "ancienne" });
  await rawPool.query(
    `UPDATE link_visits SET created_at = now() - interval '30 days' WHERE creator_id = $1`,
    [c.id]
  );
  const bySource = await db.getVisitsBySource(c.id, 14);
  assert.deepEqual(bySource, []);
});

test("getStats inclut visitsBySource", async () => {
  const c = await makeCreator("statsvisits");
  await db.logLinkVisit({ creatorId: c.id, source: "bio" });
  const stats = await db.getStats(c.id);
  assert.deepEqual(stats.visitsBySource, [{ source: "bio", visits: 1 }]);
});

// --- Segmentation basique des fans -----------------------------------------

test("getFanSegmentation compte un fan comme nouveau si son premier message tombe dans la fenêtre", async () => {
  const c = await makeCreator("fansnew");
  await db.appendMessage({ creatorId: c.id, chatId: "chat-new", role: "user", content: "salut" });

  const seg = await db.getFanSegmentation(c.id, 14);
  assert.equal(seg.newFans, 1);
  assert.equal(seg.returningFans, 0);
});

test("getFanSegmentation compte un fan comme récurrent s'il avait déjà écrit avant la fenêtre et reste actif dedans", async () => {
  const c = await makeCreator("fansreturning");
  const chatId = "chat-returning";

  await rawPool.query(
    `INSERT INTO conversation_messages (id, creator_id, chat_id, role, content, created_at)
     VALUES ($1, $2, $3, 'user', 'premier message, il y a longtemps', now() - interval '30 days')`,
    [db.id(), c.id, chatId]
  );
  await db.appendMessage({ creatorId: c.id, chatId, role: "user", content: "je reviens !" });

  const seg = await db.getFanSegmentation(c.id, 14);
  assert.equal(seg.newFans, 0);
  assert.equal(seg.returningFans, 1);
});

test("getFanSegmentation exclut un fan inactif pendant la fenêtre, même s'il a écrit avant", async () => {
  const c = await makeCreator("fansinactive");
  const chatId = "chat-inactive";

  await rawPool.query(
    `INSERT INTO conversation_messages (id, creator_id, chat_id, role, content, created_at)
     VALUES ($1, $2, $3, 'user', 'un seul message, ancien', now() - interval '30 days')`,
    [db.id(), c.id, chatId]
  );

  const seg = await db.getFanSegmentation(c.id, 14);
  assert.equal(seg.newFans, 0);
  assert.equal(seg.returningFans, 0);
});

test("findStalledTelegramConversations exclut une conversation contenant un message flagged (garde-fou sécurité)", async () => {
  const c = await makeCreator("relanceflagged");
  await db.updateCreatorTelegram(c.id, {
    token: "fake-token-2",
    username: "fake_bot_2",
    webhookSecret: "secret2",
    webhookReady: true,
  });
  const tier = await db.upsertTier(c.id, { order: 1, label: "Palier 1", priceCents: 500, url: "https://pay.example.com/1" });
  const chatId = `chat-flagged-${Date.now()}`;

  // Le message flagged est délibérément AVANT le clic (3 jours) pour isoler
  // le garde-fou "flagged" du garde-fou séparé "un message existe après le
  // clic" (même requête, deux clauses NOT EXISTS distinctes) — sinon ce
  // test ne prouverait rien de spécifique au flag.
  await rawPool.query(
    `INSERT INTO conversation_messages (id, creator_id, chat_id, role, content, flagged, created_at)
     VALUES ($1, $2, $3, 'user', 'message signalé', true, now() - interval '3 days')`,
    [db.id(), c.id, chatId]
  );
  await rawPool.query(
    `INSERT INTO click_events (id, creator_id, tier_id, telegram_chat_id, created_at)
     VALUES ($1, $2, $3, $4, now() - interval '2 days')`,
    [db.id(), c.id, tier.id, chatId]
  );
  await db.updateCreatorRelance(c.id, true);

  const stalled = await db.findStalledTelegramConversations(50);
  assert.ok(!stalled.some((s) => s.creatorId === c.id && s.chatId === chatId));
});

// --- Argument de vente par palier -------------------------------------------

test("upsertTier enregistre sellAngle et le renvoie via listTiers/getTierById", async () => {
  const c = await makeCreator("tiersellangle");
  const tier = await db.upsertTier(c.id, {
    order: 1,
    label: "Palier 1",
    priceCents: 500,
    url: "https://pay.example.com/1",
    sellAngle: "Insiste sur l'exclusivité",
  });
  assert.equal(tier.sellAngle, "Insiste sur l'exclusivité");

  const reloaded = await db.getTierById(tier.id);
  assert.equal(reloaded.sellAngle, "Insiste sur l'exclusivité");

  const listed = await db.listTiers(c.id);
  assert.equal(listed[0].sellAngle, "Insiste sur l'exclusivité");
});

test("upsertTier sans sellAngle sur un palier existant conserve la valeur déjà enregistrée (régression)", async () => {
  const c = await makeCreator("tiersellangleeep");
  await db.upsertTier(c.id, {
    order: 1,
    label: "Palier 1",
    priceCents: 500,
    url: "https://pay.example.com/1",
    sellAngle: "Argument original",
  });
  // Simule un appel qui ne renvoie pas ce champ (ex. ancien client, ou
  // réordonnancement qui ne le connaît pas) : ne doit pas l'effacer.
  const updated = await db.upsertTier(c.id, {
    order: 1,
    label: "Palier 1 renommé",
    priceCents: 600,
    url: "https://pay.example.com/1",
  });
  assert.equal(updated.sellAngle, "Argument original");
});

test("un palier créé sans sellAngle a une chaîne vide par défaut, pas null", async () => {
  const c = await makeCreator("tiersellangledefault");
  const tier = await db.upsertTier(c.id, { order: 1, label: "Palier 1", priceCents: 500, url: "https://pay.example.com/1" });
  assert.equal(tier.sellAngle, "");
});

// --- Mémoire légère par fan (CRM minimal) -----------------------------------

test("getFanProfile renvoie null tant qu'aucune note n'a été enregistrée", async () => {
  const c = await makeCreator("fanprofilenone");
  const profile = await db.getFanProfile(c.id, "chat-none");
  assert.equal(profile, null);
});

test("getMessageCountForChat compte les messages d'une conversation précise, pas les autres", async () => {
  const c = await makeCreator("fanmsgcount");
  await db.appendMessage({ creatorId: c.id, chatId: "chat-a", role: "user", content: "un" });
  await db.appendMessage({ creatorId: c.id, chatId: "chat-a", role: "assistant", content: "deux" });
  await db.appendMessage({ creatorId: c.id, chatId: "chat-b", role: "user", content: "autre conversation" });

  assert.equal(await db.getMessageCountForChat(c.id, "chat-a"), 2);
  assert.equal(await db.getMessageCountForChat(c.id, "chat-b"), 1);
});

test("upsertFanNotes crée puis met à jour le profil d'un fan (une ligne par creator_id+chat_id)", async () => {
  const c = await makeCreator("fanupsert");
  const chatId = "chat-upsert";

  await db.upsertFanNotes(c.id, chatId, { notes: "Aime la moto, encore hésitante", potential: "moyen", summarizedThrough: 8 });
  const first = await db.getFanProfile(c.id, chatId);
  assert.equal(first.notes, "Aime la moto, encore hésitante");
  assert.equal(first.potential, "moyen");
  assert.equal(first.summarizedThrough, 8);

  await db.upsertFanNotes(c.id, chatId, { notes: "A acheté le premier palier", potential: "élevé", summarizedThrough: 16 });
  const second = await db.getFanProfile(c.id, chatId);
  assert.equal(second.id, first.id, "même ligne mise à jour, pas une nouvelle");
  assert.equal(second.notes, "A acheté le premier palier");
  assert.equal(second.potential, "élevé");
  assert.equal(second.summarizedThrough, 16);
});

test("listFanProfiles regroupe par conversation, inclut les fans sans notes, triés par activité récente", async () => {
  const c = await makeCreator("fanlist");

  await db.appendMessage({ creatorId: c.id, chatId: "chat-old", role: "user", content: "salut" });
  await rawPool.query(
    `UPDATE conversation_messages SET created_at = now() - interval '2 days' WHERE creator_id = $1 AND chat_id = 'chat-old'`,
    [c.id]
  );
  await db.appendMessage({ creatorId: c.id, chatId: "chat-recent", role: "user", content: "coucou" });
  await db.appendMessage({ creatorId: c.id, chatId: "chat-recent", role: "assistant", content: "salut toi" });
  await db.upsertFanNotes(c.id, "chat-recent", { notes: "Fan engagé", potential: "élevé", summarizedThrough: 2 });

  const fans = await db.listFanProfiles(c.id);
  assert.equal(fans.length, 2);
  // Le plus récemment actif d'abord.
  assert.equal(fans[0].chatId, "chat-recent");
  assert.equal(fans[0].messageCount, 2);
  assert.equal(fans[0].notes, "Fan engagé");
  assert.equal(fans[0].potential, "élevé");

  assert.equal(fans[1].chatId, "chat-old");
  assert.equal(fans[1].messageCount, 1);
  assert.equal(fans[1].notes, "", "pas de notes tant que le résumé IA n'est pas encore passé");
  assert.equal(fans[1].potential, null);
});

test("listFanProfiles ne renvoie que les conversations de la créatrice demandée", async () => {
  const a = await makeCreator("fanlistisoa");
  const b = await makeCreator("fanlistisob");
  await db.appendMessage({ creatorId: a.id, chatId: "chat-a", role: "user", content: "hello" });
  await db.appendMessage({ creatorId: b.id, chatId: "chat-b", role: "user", content: "hello" });

  const fansOfA = await db.listFanProfiles(a.id);
  assert.ok(fansOfA.every((f) => f.chatId !== "chat-b"));
  assert.equal(fansOfA.length, 1);
});
