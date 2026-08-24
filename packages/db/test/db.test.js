// Tests d'intégration contre une vraie base Postgres (nécessite
// DATABASE_URL dans l'environnement — voir README pour lancer une base de
// test locale). Chaque test crée ses propres créatrices avec un email
// unique, donc les tests peuvent tourner dans n'importe quel ordre sans se
// marcher dessus.

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL manquant — ces tests ont besoin d'une vraie base Postgres. Voir README."
  );
  process.exit(1);
}

const db = require("../index");

// Pool séparé, utilisé UNIQUEMENT pour préparer des états que l'API publique
// de @melii/db ne permet pas de créer directement (ex. un jeton de
// réinitialisation déjà expiré, un message vieux de 120 jours).
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
  });
}

// --- Mots de passe ---------------------------------------------------

test("hashPassword / verifyPassword : aller-retour correct, rejette un mauvais mot de passe", () => {
  const hash = db.hashPassword("password123");
  assert.equal(db.verifyPassword("password123", hash), true);
  assert.equal(db.verifyPassword("mauvais-mot-de-passe", hash), false);
});

// --- Créatrices --------------------------------------------------------

test("createCreator démarre en essai avec une date de fin ~TRIAL_DAYS jours", async () => {
  const creator = await makeCreator("trial");
  assert.equal(creator.subscriptionStatus, "trial");
  assert.ok(creator.trialEndsAt);
  const daysUntilEnd = (new Date(creator.trialEndsAt) - Date.now()) / (1000 * 60 * 60 * 24);
  assert.ok(
    daysUntilEnd > db.TRIAL_DAYS - 1 && daysUntilEnd <= db.TRIAL_DAYS,
    `attendu ~${db.TRIAL_DAYS} jours, obtenu ${daysUntilEnd.toFixed(2)}`
  );
});

test("getCreatorByEmail / getCreatorById renvoient la même créatrice, insensible à la casse de l'email", async () => {
  const email = uniqueEmail("case");
  const created = await db.createCreator({ email: email.toUpperCase(), password: "password123", displayName: "Casse", ageConfirmed: true });
  const byEmail = await db.getCreatorByEmail(email.toLowerCase());
  const byId = await db.getCreatorById(created.id);
  assert.equal(byEmail.id, created.id);
  assert.equal(byId.id, created.id);
});

test("getCreatorByEmail renvoie null pour un email inconnu", async () => {
  assert.equal(await db.getCreatorByEmail("inconnu-" + Date.now() + "@example.com"), null);
});

test("updateCreatorPersona met à jour ton/bio/prénom", async () => {
  const creator = await makeCreator("persona");
  const updated = await db.updateCreatorPersona(creator.id, {
    tone: "direct_vendeur",
    bio: "Nouvelle bio",
    displayName: "Nouveau nom",
  });
  assert.equal(updated.personaTone, "direct_vendeur");
  assert.equal(updated.personaBio, "Nouvelle bio");
  assert.equal(updated.displayName, "Nouveau nom");
});

test("updateCreatorProfile enregistre puis efface avatarUrl/accentColor", async () => {
  const creator = await makeCreator("profile");
  const withProfile = await db.updateCreatorProfile(creator.id, {
    avatarUrl: "https://example.com/photo.jpg",
    accentColor: "#ff4d8d",
  });
  assert.equal(withProfile.avatarUrl, "https://example.com/photo.jpg");
  assert.equal(withProfile.accentColor, "#ff4d8d");

  const cleared = await db.updateCreatorProfile(creator.id, { avatarUrl: null, accentColor: null });
  assert.equal(cleared.avatarUrl, null);
  assert.equal(cleared.accentColor, null);
});

test("updateCreatorPasswordHash change bien le mot de passe utilisé pour la vérification", async () => {
  const creator = await makeCreator("pwchange");
  const newHash = db.hashPassword("nouveau-mot-de-passe");
  await db.updateCreatorPasswordHash(creator.id, newHash);
  const reloaded = await db.getCreatorById(creator.id);
  assert.equal(db.verifyPassword("nouveau-mot-de-passe", reloaded.passwordHash), true);
  assert.equal(db.verifyPassword("password123", reloaded.passwordHash), false);
});

test("updateCreatorSubscription + getCreatorByStripeCustomerId", async () => {
  const creator = await makeCreator("sub");
  const stripeCustomerId = "cus_test_" + Date.now();
  await db.updateCreatorSubscription(creator.id, {
    status: "active",
    plan: "Growth",
    stripeCustomerId,
    stripeSubscriptionId: "sub_test_123",
  });
  const found = await db.getCreatorByStripeCustomerId(stripeCustomerId);
  assert.equal(found.id, creator.id);
  assert.equal(found.subscriptionStatus, "active");
  assert.equal(found.subscriptionPlan, "Growth");
});

// --- Réinitialisation de mot de passe -----------------------------------

test("createPasswordResetToken / consumePasswordResetToken : cas valide", async () => {
  const creator = await makeCreator("reset-ok");
  const token = await db.createPasswordResetToken(creator.id);
  assert.ok(token && token.length > 10);

  const result = await db.consumePasswordResetToken(token, "mot-de-passe-reinitialise");
  assert.ok(result, "un jeton valide doit réussir");

  const reloaded = await db.getCreatorById(creator.id);
  assert.equal(db.verifyPassword("mot-de-passe-reinitialise", reloaded.passwordHash), true);
});

test("consumePasswordResetToken refuse un jeton déjà utilisé", async () => {
  const creator = await makeCreator("reset-reuse");
  const token = await db.createPasswordResetToken(creator.id);
  const first = await db.consumePasswordResetToken(token, "premier-mdp");
  assert.equal(first, true);
  const second = await db.consumePasswordResetToken(token, "second-mdp");
  assert.equal(second, false, "un jeton déjà consommé ne doit pas pouvoir resservir");
});

test("consumePasswordResetToken refuse un jeton expiré", async () => {
  const creator = await makeCreator("reset-expired");
  const token = await db.createPasswordResetToken(creator.id);
  // Fait reculer manuellement l'expiration dans le passé (l'API publique ne
  // permet pas de créer un jeton déjà expiré).
  await rawPool.query(
    "UPDATE password_resets SET expires_at = now() - interval '1 hour' WHERE creator_id = $1",
    [creator.id]
  );
  const result = await db.consumePasswordResetToken(token, "peu-importe");
  assert.equal(result, false);
});

test("consumePasswordResetToken refuse un jeton inconnu/invalide", async () => {
  const result = await db.consumePasswordResetToken("jeton-qui-n-existe-pas", "peu-importe");
  assert.equal(result, false);
});

// --- Paliers -------------------------------------------------------------

test("upsertTier crée puis met à jour le même palier (même order = même ligne)", async () => {
  const creator = await makeCreator("tiers");
  const created = await db.upsertTier(creator.id, {
    order: 1,
    label: "Photos",
    priceCents: 500,
    currency: "EUR",
    url: "https://example.com/photos",
  });
  const updated = await db.upsertTier(creator.id, {
    order: 1,
    label: "Photos (maj)",
    priceCents: 700,
    currency: "EUR",
    url: "https://example.com/photos-v2",
  });
  assert.equal(updated.id, created.id, "même order => même ligne mise à jour, pas une nouvelle");
  assert.equal(updated.label, "Photos (maj)");
  assert.equal(updated.priceCents, 700);

  const tiers = await db.listTiers(creator.id);
  assert.equal(tiers.length, 1);
});

test("listTiers renvoie les paliers triés par ordre croissant", async () => {
  const creator = await makeCreator("tiers-order");
  await db.upsertTier(creator.id, { order: 2, label: "VIP", priceCents: 2000, currency: "EUR", url: "https://x/2" });
  await db.upsertTier(creator.id, { order: 1, label: "Base", priceCents: 500, currency: "EUR", url: "https://x/1" });
  const tiers = await db.listTiers(creator.id);
  assert.deepEqual(tiers.map((t) => t.order), [1, 2]);
});

test("deleteTier supprime uniquement le palier ciblé", async () => {
  const creator = await makeCreator("tiers-delete");
  const t1 = await db.upsertTier(creator.id, { order: 1, label: "A", priceCents: 500, currency: "EUR", url: "https://x/1" });
  await db.upsertTier(creator.id, { order: 2, label: "B", priceCents: 1000, currency: "EUR", url: "https://x/2" });
  await db.deleteTier(creator.id, t1.id);
  const remaining = await db.listTiers(creator.id);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].label, "B");
});

// --- Ventes / stats / commission -----------------------------------------

test("declareSale + getStats calculent correctement le total et la commission", async () => {
  const creator = await makeCreator("sales");
  const tier = await db.upsertTier(creator.id, { order: 1, label: "Photos", priceCents: 1000, currency: "EUR", url: "https://x/1" });
  await db.declareSale({ creatorId: creator.id, tierId: tier.id, amountCents: 1000, currency: "EUR", note: "vente 1" });
  await db.declareSale({ creatorId: creator.id, tierId: tier.id, amountCents: 2000, currency: "EUR", note: "vente 2" });

  const stats = await db.getStats(creator.id);
  assert.equal(stats.totalDeclaredCents, 3000);
  assert.equal(
    stats.commissionOwedCents,
    Math.round(3000 * stats.commissionRate),
    "la commission doit correspondre exactement au taux appliqué au total déclaré"
  );

  const sales = await db.listSales(creator.id);
  assert.equal(sales.length, 2);
});

test("logClick incrémente bien les clics comptés dans les stats", async () => {
  const creator = await makeCreator("clicks");
  const tier = await db.upsertTier(creator.id, { order: 1, label: "Photos", priceCents: 500, currency: "EUR", url: "https://x/1" });
  await db.logClick({ creatorId: creator.id, tierId: tier.id });
  await db.logClick({ creatorId: creator.id, tierId: tier.id });
  const stats = await db.getStats(creator.id);
  assert.equal(stats.clicksByTier[tier.id], 2);
});

test("getClicksByDay renvoie exactement N jours, aujourd'hui inclus, avec des zéros explicites pour les jours sans clic (régression : pas de \"trous\" pour le graphique)", async () => {
  const creator = await makeCreator("clicks-by-day");
  const tier = await db.upsertTier(creator.id, { order: 1, label: "Photos", priceCents: 500, currency: "EUR", url: "https://x/1" });
  await db.logClick({ creatorId: creator.id, tierId: tier.id });
  await db.logClick({ creatorId: creator.id, tierId: tier.id });

  const series = await db.getClicksByDay(creator.id, 7);
  assert.equal(series.length, 7, "toujours exactement `days` entrées, même sans activité la plupart des jours");

  const today = new Date().toISOString().slice(0, 10);
  assert.equal(series[series.length - 1].day, today, "le dernier jour de la série doit être aujourd'hui");

  const todayEntry = series.find((d) => d.day === today);
  assert.equal(todayEntry.clicks, 2, "les 2 clics faits à l'instant doivent apparaître sur le jour du jour");

  const otherDays = series.filter((d) => d.day !== today);
  assert.ok(
    otherDays.every((d) => d.clicks === 0),
    "les jours sans clic doivent être à 0, pas absents de la série"
  );

  // Chaque jour de la série doit être immédiatement le lendemain du précédent
  // (pas de jours dupliqués ni de saut de date dans generate_series).
  for (let i = 1; i < series.length; i++) {
    const prev = new Date(series[i - 1].day + "T00:00:00Z");
    const cur = new Date(series[i].day + "T00:00:00Z");
    assert.equal((cur - prev) / (24 * 60 * 60 * 1000), 1, `jour ${i} doit suivre directement le jour ${i - 1}`);
  }
});

test("getStats inclut clicksByDay pour la créatrice, cohérent avec getClicksByDay", async () => {
  const creator = await makeCreator("clicks-by-day-in-stats");
  const tier = await db.upsertTier(creator.id, { order: 1, label: "Photos", priceCents: 500, currency: "EUR", url: "https://x/1" });
  await db.logClick({ creatorId: creator.id, tierId: tier.id });

  const stats = await db.getStats(creator.id);
  assert.ok(Array.isArray(stats.clicksByDay));
  assert.equal(stats.clicksByDay.length, 14, "getStats() appelle getClicksByDay avec la fenêtre par défaut de 14 jours");
  const totalFromSeries = stats.clicksByDay.reduce((sum, d) => sum + d.clicks, 0);
  assert.equal(totalFromSeries, 1);
});

// --- Conversations ---------------------------------------------------

test("appendMessage / getRecentMessages : ordre chronologique et limite respectée", async () => {
  const creator = await makeCreator("conv");
  const chatId = "chat-1";
  for (let i = 0; i < 5; i++) {
    await db.appendMessage({ creatorId: creator.id, chatId, role: i % 2 === 0 ? "user" : "assistant", content: `message ${i}` });
  }
  const all = await db.getRecentMessages({ creatorId: creator.id, chatId, limit: 20 });
  assert.equal(all.length, 5);
  assert.deepEqual(all.map((m) => m.content), ["message 0", "message 1", "message 2", "message 3", "message 4"]);

  const limited = await db.getRecentMessages({ creatorId: creator.id, chatId, limit: 2 });
  assert.equal(limited.length, 2);
  assert.deepEqual(limited.map((m) => m.content), ["message 3", "message 4"], "avec une limite, on garde les PLUS RÉCENTS, dans l'ordre chronologique");
});

test("getRecentMessages isole bien les conversations par chatId", async () => {
  const creator = await makeCreator("conv-isolation");
  await db.appendMessage({ creatorId: creator.id, chatId: "chat-a", role: "user", content: "dans A" });
  await db.appendMessage({ creatorId: creator.id, chatId: "chat-b", role: "user", content: "dans B" });
  const chatA = await db.getRecentMessages({ creatorId: creator.id, chatId: "chat-a", limit: 20 });
  assert.equal(chatA.length, 1);
  assert.equal(chatA[0].content, "dans A");
});

test("getConversationVolume compte les chatId distincts sur la fenêtre demandée", async () => {
  const creator = await makeCreator("volume");
  await db.appendMessage({ creatorId: creator.id, chatId: "chat-1", role: "user", content: "a" });
  await db.appendMessage({ creatorId: creator.id, chatId: "chat-1", role: "assistant", content: "b" });
  await db.appendMessage({ creatorId: creator.id, chatId: "chat-2", role: "user", content: "c" });
  const volume = await db.getConversationVolume(creator.id, 30);
  assert.equal(volume, 2, "2 chatId distincts, peu importe le nombre de messages dans chacun");
});

test("purgeOldConversations supprime seulement les messages plus vieux que la durée demandée", async () => {
  const creator = await makeCreator("purge");
  await db.appendMessage({ creatorId: creator.id, chatId: "recent", role: "user", content: "récent" });
  await db.appendMessage({ creatorId: creator.id, chatId: "old", role: "user", content: "vieux" });
  await rawPool.query(
    "UPDATE conversation_messages SET created_at = now() - interval '120 days' WHERE creator_id = $1 AND chat_id = 'old'",
    [creator.id]
  );

  const deleted = await db.purgeOldConversations(90);
  assert.ok(deleted >= 1);

  const recent = await db.getRecentMessages({ creatorId: creator.id, chatId: "recent", limit: 20 });
  const old = await db.getRecentMessages({ creatorId: creator.id, chatId: "old", limit: 20 });
  assert.equal(recent.length, 1, "le message récent doit survivre");
  assert.equal(old.length, 0, "le vieux message doit être purgé");
});

// --- Vue admin -------------------------------------------------------

test("adminListCreators ne multiplie PAS les montants quand une créatrice a plusieurs paliers, ventes ET messages à la fois (régression : jointures en fan-out)", async () => {
  const creator = await makeCreator("admin-fanout", { displayName: "FanOutTest" });

  // 2 paliers x 1 vente x 2 messages : un JOIN plat sur les 3 tables sans
  // sous-requêtes séparées ferait un produit cartésien et multiplierait
  // SUM(amount_cents) par le nombre de lignes du produit (ici x4).
  const tierA = await db.upsertTier(creator.id, { order: 1, label: "A", priceCents: 500, currency: "EUR", url: "https://x/1" });
  await db.upsertTier(creator.id, { order: 2, label: "B", priceCents: 1500, currency: "EUR", url: "https://x/2" });
  await db.declareSale({ creatorId: creator.id, tierId: tierA.id, amountCents: 999, currency: "EUR", note: "" });
  await db.appendMessage({ creatorId: creator.id, chatId: "chat-1", role: "user", content: "salut" });
  await db.appendMessage({ creatorId: creator.id, chatId: "chat-1", role: "assistant", content: "coucou" });

  const rows = await db.adminListCreators();
  const row = rows.find((r) => r.id === creator.id);
  assert.ok(row, "la créatrice doit apparaître dans la liste admin");
  assert.equal(row.tierCount, 2);
  assert.equal(row.totalDeclaredCents, 999, "le total déclaré ne doit PAS être multiplié par le nombre de paliers/messages");
  assert.equal(row.commissionOwedCents, Math.round(999 * db.COMMISSION_RATE));
  assert.equal(row.conversations30d, 1, "1 seul chatId distinct malgré 2 messages");
});

test("adminListCreators inclut une créatrice sans aucune activité (paliers/ventes/messages) avec des totaux à zéro", async () => {
  const creator = await makeCreator("admin-empty");
  const rows = await db.adminListCreators();
  const row = rows.find((r) => r.id === creator.id);
  assert.ok(row);
  assert.equal(row.tierCount, 0);
  assert.equal(row.totalDeclaredCents, 0);
  assert.equal(row.conversations30d, 0);
  assert.equal(row.commissionOwedCents, 0);
});

// --- Suppression de compte -------------------------------------------

test("deleteCreator supprime la créatrice et fait cascader la suppression des données liées", async () => {
  const creator = await makeCreator("delete-cascade");
  const tier = await db.upsertTier(creator.id, { order: 1, label: "A", priceCents: 500, currency: "EUR", url: "https://x/1" });
  await db.declareSale({ creatorId: creator.id, tierId: tier.id, amountCents: 500, currency: "EUR", note: "" });
  await db.appendMessage({ creatorId: creator.id, chatId: "chat-1", role: "user", content: "salut" });
  await db.createPasswordResetToken(creator.id);

  const deleted = await db.deleteCreator(creator.id);
  assert.equal(deleted, true);
  assert.equal(await db.getCreatorById(creator.id), null);

  const { rows: tierRows } = await rawPool.query("SELECT 1 FROM tiers WHERE creator_id = $1", [creator.id]);
  const { rows: saleRows } = await rawPool.query("SELECT 1 FROM sale_declarations WHERE creator_id = $1", [creator.id]);
  const { rows: msgRows } = await rawPool.query("SELECT 1 FROM conversation_messages WHERE creator_id = $1", [creator.id]);
  const { rows: resetRows } = await rawPool.query("SELECT 1 FROM password_resets WHERE creator_id = $1", [creator.id]);
  assert.equal(tierRows.length, 0);
  assert.equal(saleRows.length, 0);
  assert.equal(msgRows.length, 0);
  assert.equal(resetRows.length, 0);
});

test("deleteCreator renvoie false pour un id inconnu", async () => {
  assert.equal(await db.deleteCreator("id-qui-n-existe-pas"), false);
});
