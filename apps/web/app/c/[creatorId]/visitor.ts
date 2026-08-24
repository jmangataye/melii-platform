// Identifiant de visiteur partagé entre AgeGate.tsx (qui doit enregistrer le
// consentement d'âge sous le même id que la conversation) et ChatWidget.tsx
// (qui l'utilise pour charger/poster les messages) — un seul générateur pour
// éviter que les deux composants créent chacun un id différent.

export function getOrCreateVisitorId(creatorId: string): string {
  const key = `melii_visitor_${creatorId}`;
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    window.localStorage.setItem(key, fresh);
    return fresh;
  } catch {
    // localStorage indisponible (navigation privée stricte, etc.) : on
    // retombe sur un id de session qui ne survit pas au rechargement —
    // dégradation acceptable plutôt qu'un chat cassé.
    return crypto.randomUUID();
  }
}
