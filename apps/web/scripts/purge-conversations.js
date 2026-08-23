// Purge des vieux messages de conversation — lancé par le cron job Render
// "melii-purge-conversations" (voir render.yaml), pas par le service web
// lui-même. On garde 90 jours d'historique : assez pour que le bot ait du
// contexte récent utile, sans faire grossir la base indéfiniment ni garder
// des conversations privées plus longtemps que nécessaire.
//
// Usage : node apps/web/scripts/purge-conversations.js [jours]
// (lancé depuis la racine du repo, DATABASE_URL doit être dans l'environnement)

const { purgeOldConversations } = require("@melii/db");

const days = Number(process.argv[2] || process.env.CONVERSATION_RETENTION_DAYS || 90);

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL manquant — abandon.");
    process.exit(1);
  }
  if (!Number.isFinite(days) || days <= 0) {
    console.error(`Nombre de jours invalide: ${process.argv[2]}`);
    process.exit(1);
  }

  const startedAt = Date.now();
  const deleted = await purgeOldConversations(days);
  const elapsedMs = Date.now() - startedAt;

  console.log(
    `[purge-conversations] ${deleted} message(s) de plus de ${days} jours supprimé(s) en ${elapsedMs}ms.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[purge-conversations] échec :", err);
    process.exit(1);
  });
