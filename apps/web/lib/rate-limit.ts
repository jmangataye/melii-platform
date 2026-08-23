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

/** Extrait une IP client raisonnable derrière le proxy Render. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}
