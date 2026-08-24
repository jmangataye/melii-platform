// Rate limiting en mémoire — suffisant tant que le site tourne sur une
// seule instance (le cas sur le plan gratuit/starter Render). Si le service
// est un jour scalé sur plusieurs instances, ce compteur ne serait plus
// partagé entre elles et il faudrait passer par un store partagé (ex. Redis
// / Render Key Value) — à garder en tête, pas un problème avant longtemps.

const buckets = new Map<string, { count: number; resetAt: number }>();

// Purge périodique pour ne pas laisser grossir la Map indéfiniment.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}, 5 * 60 * 1000).unref?.();

/**
 * Renvoie true si la requête est autorisée, false si la limite est
 * dépassée. `key` doit inclure à la fois l'identité de l'appelant (IP) et
 * la route protégée, pour ne pas partager un même compteur entre routes.
 */
export function checkRateLimit(key: string, { limit, windowMs }: { limit: number; windowMs: number }): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;

  bucket.count += 1;
  return true;
}

/**
 * Extrait une IP client raisonnable derrière le proxy Render.
 *
 * Important : on prend le DERNIER maillon de X-Forwarded-For, pas le
 * premier. Le premier maillon est la valeur que le client a lui-même
 * envoyée (ou inventée) — un attaquant peut y mettre n'importe quoi pour
 * obtenir un nouveau compteur de rate-limit à chaque requête et contourner
 * la limite entièrement. Le dernier maillon est celui ajouté par le proxy
 * Render lui-même juste avant de nous transmettre la requête : c'est la
 * seule valeur de la chaîne que le client ne contrôle pas.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",").map((h) => h.trim()).filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }
  return "unknown";
}
