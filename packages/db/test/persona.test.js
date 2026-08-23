// Tests purs, sans base de données — les garde-fous de sécurité (mots-clés
// de détresse/minorité, refus de contenu explicite) sont le point le plus
// critique de toute la plateforme : une régression silencieuse ici serait
// grave. On les teste donc en premier, isolément.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { containsSafetyKeyword, buildSystemPrompt, SAFE_FALLBACK_REPLY, TONE_PRESETS } = require("../persona");

test("containsSafetyKeyword détecte les signaux de minorité", () => {
  assert.equal(containsSafetyKeyword("je suis mineure en fait"), true);
  assert.equal(containsSafetyKeyword("j'ai 15 ans j'ai menti"), true);
  assert.equal(containsSafetyKeyword("je suis encore au collège"), true);
});

test("containsSafetyKeyword détecte les signaux de détresse", () => {
  assert.equal(containsSafetyKeyword("j'ai envie de me tuer"), true);
  assert.equal(containsSafetyKeyword("je pense au suicide en ce moment"), true);
});

test("containsSafetyKeyword détecte chantage/menace/carte volée", () => {
  assert.equal(containsSafetyKeyword("c'est un chantage sinon je diffuse"), true);
  assert.equal(containsSafetyKeyword("je te menace de tout dire"), true);
  assert.equal(containsSafetyKeyword("j'ai payé avec une carte volée"), true);
});

test("containsSafetyKeyword est insensible à la casse", () => {
  assert.equal(containsSafetyKeyword("JE SUIS MINEURE"), true);
  assert.equal(containsSafetyKeyword("Envie De Mourir"), true);
});

test("containsSafetyKeyword ne déclenche pas sur un message normal", () => {
  assert.equal(containsSafetyKeyword("salut, ça va ? je découvre ton profil"), false);
  assert.equal(containsSafetyKeyword("je veux voir tes photos exclusives"), false);
  assert.equal(containsSafetyKeyword(""), false);
});

test("containsSafetyKeyword gère une entrée non-string sans planter", () => {
  assert.equal(containsSafetyKeyword(null), false);
  assert.equal(containsSafetyKeyword(undefined), false);
});

test("SAFE_FALLBACK_REPLY ne contient aucun lien ni ton commercial", () => {
  assert.equal(/https?:\/\//.test(SAFE_FALLBACK_REPLY), false);
});

test("buildSystemPrompt inclut toujours les deux garde-fous non modifiables", () => {
  const prompt = buildSystemPrompt({
    creatorName: "Luna",
    tone: "doux_complice",
    bio: "",
    tiers: [],
  });
  assert.match(prompt, /\[GARDE-FOU\]/);
  assert.match(prompt, /tu restes honnête/);
  assert.match(prompt, /jamais graphique/);
});

test("buildSystemPrompt retombe sur un ton par défaut si le ton est inconnu/absent", () => {
  const prompt = buildSystemPrompt({ creatorName: "Luna", tone: "ton_inexistant", bio: "", tiers: [] });
  assert.match(prompt, new RegExp(TONE_PRESETS.doux_complice.voice.split("\n")[0].slice(0, 20)));
});

test("buildSystemPrompt trie les paliers par ordre croissant même si donnés dans le désordre", () => {
  const tiers = [
    { order: 2, label: "VIP", priceCents: 2000, currency: "EUR", shortUrl: "https://x/l/2" },
    { order: 1, label: "Photos", priceCents: 500, currency: "EUR", shortUrl: "https://x/l/1" },
  ];
  const prompt = buildSystemPrompt({ creatorName: "Luna", tone: "doux_complice", bio: "", tiers });
  const idxPhotos = prompt.indexOf("Photos");
  const idxVip = prompt.indexOf("VIP");
  assert.ok(idxPhotos > -1 && idxVip > -1 && idxPhotos < idxVip, "le palier 1 doit apparaître avant le palier 2");
});

test("buildSystemPrompt inclut la bio seulement si elle est fournie", () => {
  const withBio = buildSystemPrompt({ creatorName: "Luna", tone: "doux_complice", bio: "Passionnée de yoga", tiers: [] });
  const withoutBio = buildSystemPrompt({ creatorName: "Luna", tone: "doux_complice", bio: "", tiers: [] });
  assert.match(withBio, /Passionnée de yoga/);
  assert.doesNotMatch(withoutBio, /Contexte sur toi/);
});
