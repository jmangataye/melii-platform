import { promises as dns } from "node:dns";

// Convention : la créatrice pose le jeton reçu de setCustomDomainPending()
// comme enregistrement TXT sur `_melii-challenge.<son-domaine>` — un
// sous-domaine dédié plutôt que le domaine racine, pour ne jamais entrer en
// conflit avec un TXT existant (SPF, vérification Google, etc.) déjà posé
// sur le domaine lui-même.
export function challengeHostFor(domain: string): string {
  return `_melii-challenge.${domain}`;
}

/**
 * Vérifie que le jeton attendu est bien présent dans les enregistrements TXT
 * du sous-domaine de challenge. Un enregistrement TXT peut être découpé en
 * plusieurs chaînes par le résolveur — on les recolle avant de comparer.
 * Ne lève jamais : un domaine mal configuré ou pas encore propagé doit juste
 * renvoyer false, pas planter la route qui appelle cette fonction.
 */
export async function verifyDomainToken(domain: string, token: string): Promise<boolean> {
  try {
    const records = await dns.resolveTxt(challengeHostFor(domain));
    return records.some((chunks) => chunks.join("") === token);
  } catch {
    return false;
  }
}
