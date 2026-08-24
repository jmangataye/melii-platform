// Tests purs, sans base de données — les garde-fous de sécurité (mots-clés
// de détresse/minorité, refus de contenu explicite) sont le point le plus
// critique de toute la plateforme : une régression silencieuse ici serait
// grave. On les teste donc en premier, isolément.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  containsSafetyKeyword,
  buildSystemPrompt,
  SAFE_FALLBACK_REPLY,
  TONE_PRESETS,
  VALID_LANGUAGES,
  getSafeFallbackReply,
} = require("../persona");

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

test("buildSystemPrompt inclut l'argument de vente d'un palier seulement s'il est fourni", () => {
  const tiers = [
    { order: 1, label: "Photos", priceCents: 500, currency: "EUR", shortUrl: "https://x/l/1", sellAngle: "Insiste sur l'exclusivité" },
    { order: 2, label: "VIP", priceCents: 2000, currency: "EUR", shortUrl: "https://x/l/2" },
  ];
  const prompt = buildSystemPrompt({ creatorName: "Luna", tone: "doux_complice", bio: "", tiers });
  assert.match(prompt, /Comment le présenter : Insiste sur l'exclusivité/);
  // Le palier VIP n'a pas de sellAngle : sa ligne ne doit pas avoir de sous-ligne "Comment le présenter".
  const vipLine = prompt.split("\n").find((l) => l.includes('"VIP"'));
  const vipLineIndex = prompt.split("\n").indexOf(vipLine);
  assert.ok(!prompt.split("\n")[vipLineIndex + 1]?.includes("Comment le présenter"));
});

test("buildSystemPrompt inclut la bio seulement si elle est fournie", () => {
  const withBio = buildSystemPrompt({ creatorName: "Luna", tone: "doux_complice", bio: "Passionnée de yoga", tiers: [] });
  const withoutBio = buildSystemPrompt({ creatorName: "Luna", tone: "doux_complice", bio: "", tiers: [] });
  assert.match(withBio, /Passionnée de yoga/);
  assert.doesNotMatch(withoutBio, /Contexte sur toi/);
});

// --- Mémoire fan (notes IA) & potentiel -------------------------------------

test("buildSystemPrompt inclut fanNotes seulement si fourni, sans jamais dire qu'il s'agit de 'notes'", () => {
  const withNotes = buildSystemPrompt({
    creatorName: "Luna",
    tone: "doux_complice",
    bio: "",
    tiers: [],
    fanNotes: "Aime la moto, encore hésitante sur le palier 2",
  });
  const withoutNotes = buildSystemPrompt({ creatorName: "Luna", tone: "doux_complice", bio: "", tiers: [] });
  assert.match(withNotes, /Aime la moto, encore hésitante sur le palier 2/);
  assert.match(withNotes, /ne récite jamais ces notes mot pour mot/);
  assert.doesNotMatch(withoutNotes, /te souviens de cette personne/);
});

test("buildSystemPrompt avec potentiel 'élevé' encourage à avancer vers les offres, sans forcer", () => {
  const prompt = buildSystemPrompt({ creatorName: "Luna", tone: "doux_complice", bio: "", tiers: [], fanPotential: "élevé" });
  assert.match(prompt, /particulièrement engagée/);
  assert.match(prompt, /sans pour autant forcer le sujet/);
});

test("buildSystemPrompt avec potentiel 'faible' privilégie la connexion plutôt que la vente", () => {
  const prompt = buildSystemPrompt({ creatorName: "Luna", tone: "doux_complice", bio: "", tiers: [], fanPotential: "faible" });
  assert.match(prompt, /peu engagée/);
  assert.match(prompt, /inutile\s+d'insister/);
});

test("buildSystemPrompt sans potentiel (ou 'moyen', ou inconnu) n'ajoute aucune nuance de rythme", () => {
  for (const fanPotential of [undefined, null, "moyen", "valeur-inconnue"]) {
    const prompt = buildSystemPrompt({ creatorName: "Luna", tone: "doux_complice", bio: "", tiers: [], fanPotential });
    assert.doesNotMatch(prompt, /particulièrement engagée/);
    assert.doesNotMatch(prompt, /peu engagée/);
  }
});

test("buildSystemPrompt garde toujours les deux garde-fous [GARDE-FOU], même avec fanNotes et un potentiel élevé", () => {
  const prompt = buildSystemPrompt({
    creatorName: "Luna",
    tone: "doux_complice",
    bio: "",
    tiers: [],
    fanNotes: "Fan très engagé, a déjà acheté deux paliers",
    fanPotential: "élevé",
  });
  assert.match(prompt, /\[GARDE-FOU\]/g);
});

// --- Langue du bot (multilingue) -------------------------------------------

test("VALID_LANGUAGES contient fr, en, es (et rien d'autre pour l'instant)", () => {
  assert.deepEqual(VALID_LANGUAGES.slice().sort(), ["en", "es", "fr"]);
});

test("buildSystemPrompt sans langue précisée retombe sur le comportement français historique", () => {
  const prompt = buildSystemPrompt({ creatorName: "Luna", tone: "doux_complice", bio: "", tiers: [] });
  assert.match(prompt, /Réponds toujours en français/);
});

test("buildSystemPrompt avec language: 'en' instruit une réponse par défaut en anglais", () => {
  const prompt = buildSystemPrompt({ creatorName: "Luna", tone: "doux_complice", bio: "", tiers: [], language: "en" });
  assert.match(prompt, /Always reply in English/);
  assert.doesNotMatch(prompt, /Réponds toujours en français/);
});

test("buildSystemPrompt avec language: 'es' instruit une réponse par défaut en espagnol", () => {
  const prompt = buildSystemPrompt({ creatorName: "Luna", tone: "doux_complice", bio: "", tiers: [], language: "es" });
  assert.match(prompt, /Responde siempre en español/);
});

test("buildSystemPrompt avec une langue inconnue retombe sur le français plutôt que de planter", () => {
  const prompt = buildSystemPrompt({ creatorName: "Luna", tone: "doux_complice", bio: "", tiers: [], language: "de" });
  assert.match(prompt, /Réponds toujours en français/);
});

test("buildSystemPrompt garde toujours les deux garde-fous [GARDE-FOU], quelle que soit la langue configurée", () => {
  for (const language of [...VALID_LANGUAGES, undefined]) {
    const prompt = buildSystemPrompt({ creatorName: "Luna", tone: "doux_complice", bio: "", tiers: [], language });
    assert.match(prompt, /\[GARDE-FOU\]/);
  }
});

test("containsSafetyKeyword détecte les signaux de détresse/minorité en anglais, pas seulement en français", () => {
  assert.equal(containsSafetyKeyword("i want to kill myself"), true);
  assert.equal(containsSafetyKeyword("i'm a minor btw"), true);
  assert.equal(containsSafetyKeyword("this is blackmail"), true);
});

test("containsSafetyKeyword détecte les signaux de détresse/minorité en espagnol, pas seulement en français", () => {
  assert.equal(containsSafetyKeyword("quiero morir"), true);
  assert.equal(containsSafetyKeyword("soy menor de edad"), true);
  assert.equal(containsSafetyKeyword("es un chantaje"), true);
});

test("containsSafetyKeyword reste indépendant de la langue configurée du bot : un mot-clé anglais déclenche même sans language passé en argument", () => {
  // containsSafetyKeyword ne prend pas la langue du bot en paramètre — elle
  // vérifie systématiquement toutes les langues gérées, quel que soit le
  // réglage persona_language de la créatrice qui reçoit ce message.
  assert.equal(containsSafetyKeyword("please don't tell anyone, blackmail"), true);
});

test("containsSafetyKeyword ne déclenche pas sur un message normal en anglais ou en espagnol", () => {
  assert.equal(containsSafetyKeyword("hey, how are you doing today?"), false);
  assert.equal(containsSafetyKeyword("hola, quiero ver tus fotos"), false);
});

test("getSafeFallbackReply renvoie une réponse localisée par langue, sans lien ni ton commercial", () => {
  for (const language of VALID_LANGUAGES) {
    const reply = getSafeFallbackReply(language);
    assert.ok(reply.length > 0);
    assert.equal(/https?:\/\//.test(reply), false);
  }
  assert.notEqual(getSafeFallbackReply("en"), getSafeFallbackReply("fr"));
  assert.notEqual(getSafeFallbackReply("es"), getSafeFallbackReply("fr"));
});

test("getSafeFallbackReply retombe sur le français pour une langue inconnue ou absente", () => {
  assert.equal(getSafeFallbackReply("de"), SAFE_FALLBACK_REPLY);
  assert.equal(getSafeFallbackReply(undefined), SAFE_FALLBACK_REPLY);
});
