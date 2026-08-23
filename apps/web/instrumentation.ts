// Lancé une fois quand le serveur Next.js démarre (voir la doc Next.js sur
// "instrumentation.js"). On l'utilise pour planifier la purge périodique
// des vieux messages de conversation directement dans le process du
// service web, plutôt que via un Render Cron Job séparé : un Cron Job
// Render nécessite un plan payant (donc une carte bancaire enregistrée sur
// le compte), alors que le service web tourne déjà en continu sur le plan
// gratuit. Même logique que le nettoyage périodique du rate limiter (voir
// lib/rate-limit.ts).
//
// Limite connue : sur le plan gratuit Render, le service se met en veille
// après une période d'inactivité et ne tourne donc pas 24h/24 — la purge ne
// s'exécute que quand le service est réveillé (visite d'un chat, connexion
// d'une créatrice, etc.). C'est suffisant pour purger régulièrement sans
// jamais bloquer indéfiniment ; ce n'est pas une garantie de passage exact
// toutes les 24h. Si le service passe un jour sur un plan payant "always
// on", ce même code donnera une purge quotidienne fiable sans rien changer.

const PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000; // une fois par jour
const FIRST_RUN_DELAY_MS = 60 * 1000; // laisse le serveur finir de démarrer

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const retentionDays = Number(process.env.CONVERSATION_RETENTION_DAYS || 90);
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) return;

  const { purgeOldConversations } = await import("@melii/db");

  async function runPurge() {
    try {
      const deleted = await purgeOldConversations(retentionDays);
      if (deleted > 0) {
        console.log(
          `[purge-conversations] ${deleted} message(s) de plus de ${retentionDays} jours supprimé(s).`
        );
      }
    } catch (err) {
      console.error("[purge-conversations] échec :", err);
    }
  }

  setTimeout(runPurge, FIRST_RUN_DELAY_MS).unref?.();
  setInterval(runPurge, PURGE_INTERVAL_MS).unref?.();
}
