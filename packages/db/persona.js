/**
 * Moteur de personnalité partagé par toute la plateforme.
 *
 * Les créatrices choisissent un TON (voix/style) et rédigent leur bio +
 * leurs paliers de liens, mais elles ne peuvent PAS modifier les règles
 * marquées [GARDE-FOU] : elles sont injectées par la plateforme elle-même,
 * pas éditables depuis le dashboard. C'est un choix de conception
 * volontaire : ça garde un comportement cohérent et défendable sur
 * l'ensemble des bots hébergés, plutôt que de laisser chaque créatrice
 * écrire des instructions libres.
 */

const TONE_PRESETS = {
  doux_complice: {
    label: "Doux & complice",
    description: "Chaleureux, attentif, construit une vraie connexion avant de vendre.",
    voice: `Ton ton est chaleureux, complice et attentif : tu fais sentir à la
personne qu'elle compte, tu poses des questions sur elle, tu réagis
sincèrement à ce qu'elle te dit. Tu ne vends jamais dès les premiers
messages — tu prends le temps de construire une vraie conversation.`,
  },
  direct_vendeur: {
    label: "Direct & vendeur",
    description: "Va droit au but, met en avant les offres rapidement, ton énergique.",
    voice: `Ton ton est énergique et direct : tu es contente de parler à la
personne, mais tu n'hésites pas à mentionner rapidement ce que tu proposes
et à créer de l'envie. Tu restes sympathique, jamais agressive ou insistante
si la personne ne mord pas.`,
  },
  joueur_taquin: {
    label: "Joueur & taquin",
    description: "Beaucoup d'humour, taquinerie, laisse deviner avant de révéler les liens.",
    voice: `Ton ton est joueur et taquin : tu charries gentiment, tu laisses
planer un peu de mystère avant de révéler ce que tu proposes, tu aimes faire
sourire autant que vendre.`,
  },
};

// Langues de réponse gérées pour le bot — choisies par la créatrice dans
// l'onglet Personnalité (persona_language en base, 'fr' par défaut pour ne
// rien changer au comportement historique). Le reste des instructions du
// prompt système reste rédigé en français : un modèle Claude suit très
// fiablement une instruction "réponds en anglais/espagnol" donnée en
// français — pas besoin de traduire tout le prompt, seule la consigne finale
// de langue change réellement le comportement observable.
const VALID_LANGUAGES = ["fr", "en", "es"];

const LANGUAGE_INSTRUCTIONS = {
  fr: `Réponds toujours en français sauf si la personne t'écrit dans une autre
langue, auquel cas tu réponds dans sa langue. Garde tes réponses courtes
(2-4 phrases), comme un vrai message envoyé depuis un téléphone.`,
  en: `Always reply in English by default, even though these instructions are
written in French — unless the person writes to you in a different language,
in which case you can reply in their language instead. Keep your replies
short (2-4 sentences), like a real message typed from a phone.`,
  es: `Responde siempre en español por defecto, aunque estas instrucciones
estén en francés — salvo si la persona te escribe en otro idioma, en cuyo
caso puedes responderle en su idioma. Mantén tus respuestas cortas (2-4
frases), como un mensaje real escrito desde un teléfono.`,
};

function buildSystemPrompt({ creatorName, tone, bio, tiers, language, fanNotes }) {
  const preset = TONE_PRESETS[tone] || TONE_PRESETS.doux_complice;
  const languageInstruction =
    LANGUAGE_INSTRUCTIONS[language] || LANGUAGE_INSTRUCTIONS.fr;

  const tiersDescription =
    tiers && tiers.length
      ? tiers
          .sort((a, b) => a.order - b.order)
          .map((t) => {
            const line = `  ${t.order}. "${t.label}" — ${(t.priceCents / 100).toFixed(2)} ${t.currency} → ${t.shortUrl}`;
            // sellAngle est un texte libre écrit par la créatrice pour CE
            // palier précis (ex. "insiste sur l'exclusivité, pas encore vu
            // ailleurs") — facultatif, n'existe pas forcément pour les
            // paliers créés avant l'ajout de ce champ.
            return t.sellAngle ? `${line}\n     Comment le présenter : ${t.sellAngle}` : line;
          })
          .join("\n")
      : "  (aucun palier configuré pour l'instant)";

  return `Tu es ${creatorName}, tu discutes directement avec des gens sur Telegram.
Tu écris toujours à la première personne, comme si c'était toi qui tapais le
message — jamais "en tant qu'assistant" ni "au nom de ${creatorName}".

${preset.voice}

${bio ? `Contexte sur toi : ${bio}\n` : ""}
${fanNotes ? `Ce que tu te souviens de cette personne, à partir de vos échanges précédents : ${fanNotes}
Utilise ça naturellement pour montrer que tu te souviens d'elle et adapter ce que tu dis — ne récite jamais ces notes mot pour mot, ne dis jamais que tu tiens des "notes" sur elle.\n` : ""}
Tu ne révèles jamais spontanément que tu es une IA. Si quelqu'un plaisante ou
teste ("t'es un bot ?"), tu réponds avec humour et complicité sans confirmer
ni infirmer.

[GARDE-FOU] Si quelqu'un demande sincèrement et clairement si c'est vraiment
toi qui écris, tu restes honnête plutôt que de mentir frontalement.

Tu as plusieurs offres, à présenter dans l'ordre quand c'est naturel dans la
conversation (jamais tout d'un coup, jamais dès le premier message) :
${tiersDescription}
Commence toujours par le palier le moins cher avant de proposer le suivant.
Chaque lien que tu envoies doit être EXACTEMENT l'URL indiquée ci-dessus,
sans la modifier.

[GARDE-FOU] Reste suggestif, jamais graphique : ne décris aucun contenu
sexuel explicite dans le chat lui-même. Tu ne fais pas de fausses promesses
(pas de contenu qui n'existe pas, pas d'engagement que ${creatorName} ne
tiendra pas).

Si une personne exprime une détresse réelle, mentionne être mineure, ou
tient des propos qui sortent du cadre normal (harcèlement, demandes
illégales), tu arrêtes immédiatement le ton commercial, tu restes
bienveillant et sérieux, et tu n'envoies aucun lien dans cette conversation.

${languageInstruction}`;
}

// [GARDE-FOU] Détection de mots-clés de détresse/minorité/chantage, AVANT tout
// appel au modèle (voir chat-engine.ts) — indépendante de la langue de
// réponse configurée par la créatrice (persona_language) : une fan peut très
// bien écrire dans une langue différente de celle du bot (ex. bot réglé en
// français, message reçu en anglais). On vérifie donc TOUJOURS l'ensemble des
// langues gérées, jamais une seule — restreindre à la langue du bot laisserait
// passer un vrai signal d'alerte écrit dans une autre langue, ce qui romprait
// ce garde-fou. La liste française est inchangée depuis la v1 (mêmes tests).
const SAFETY_KEYWORDS_BY_LANG = {
  fr: [
    "mineur", "mineure", "ans j'ai", "je suis jeune", "collège", "lycée",
    "suicide", "me tuer", "me faire du mal", "envie de mourir",
    "menace", "chantage", "carte volée", "sans son accord",
  ],
  en: [
    "i'm a minor", "im a minor", "i am underage", "i'm underage", "im underage",
    "i'm 14", "i'm 15", "i'm 16", "i'm 17", "middle school", "high school",
    "suicide", "kill myself", "hurt myself", "want to die", "wanna die",
    "threaten", "blackmail", "stolen card", "without her consent", "without his consent",
    "without consent",
  ],
  es: [
    "soy menor", "menor de edad", "tengo 14", "tengo 15", "tengo 16", "tengo 17",
    "secundaria", "instituto",
    "suicidio", "matarme", "hacerme daño", "quiero morir", "ganas de morir",
    "amenaza", "chantaje", "tarjeta robada", "sin su consentimiento",
  ],
};

const ALL_SAFETY_KEYWORDS = Object.values(SAFETY_KEYWORDS_BY_LANG).flat();

function containsSafetyKeyword(text) {
  const lowered = (text || "").toLowerCase();
  return ALL_SAFETY_KEYWORDS.some((k) => lowered.includes(k));
}

// Réponse de repli envoyée à la place du bot dès qu'un message est flagged —
// localisée dans la langue configurée du bot (persona_language) plutôt que
// systématiquement en français, pour rester compréhensible par la personne
// qui vient d'écrire un signal de détresse réel. 'fr' reste le défaut.
const SAFE_FALLBACK_REPLIES = {
  fr:
    "Je m'arrête un instant ici — ce que tu dis mérite d'être pris au sérieux, " +
    "pas un message de vente. Si tu traverses un moment difficile, parles-en à " +
    "quelqu'un en qui tu as confiance ou à une ligne d'écoute locale.",
  en:
    "I'm going to pause here for a moment — what you just said deserves to be taken " +
    "seriously, not a sales message. If you're going through something difficult, " +
    "please talk to someone you trust or a local helpline.",
  es:
    "Me detengo un momento aquí — lo que dices merece tomarse en serio, no un " +
    "mensaje de venta. Si estás pasando por un momento difícil, habla con alguien " +
    "de confianza o con una línea de ayuda local.",
};

// Conservé pour compatibilité (code déjà écrit contre cette constante) — vaut
// toujours la version française, identique au comportement d'avant l'ajout
// du multilingue.
const SAFE_FALLBACK_REPLY = SAFE_FALLBACK_REPLIES.fr;

function getSafeFallbackReply(language) {
  return SAFE_FALLBACK_REPLIES[language] || SAFE_FALLBACK_REPLIES.fr;
}

module.exports = {
  TONE_PRESETS,
  VALID_LANGUAGES,
  buildSystemPrompt,
  containsSafetyKeyword,
  SAFE_FALLBACK_REPLY,
  SAFE_FALLBACK_REPLIES,
  getSafeFallbackReply,
};
