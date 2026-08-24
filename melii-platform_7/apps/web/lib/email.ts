// Envoi d'email minimal, prêt pour Resend (https://resend.com) — un
// fournisseur d'emails à créer soi-même (comme Anthropic/Stripe : identité
// + compte, donc pas quelque chose que Claude peut faire à la place de
// l'utilisateur). Tant que RESEND_API_KEY n'est pas configuré, on se
// contente de logger l'email côté serveur (visible dans les logs Render) —
// ça permet de tester tout le flux (mot de passe oublié, etc.) sans
// attendre d'avoir connecté un vrai fournisseur.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || "Melii <onboarding@resend.dev>";

export async function sendEmail({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}) {
  if (!RESEND_API_KEY) {
    console.warn(
      `[email] RESEND_API_KEY absent — email non envoyé, affiché ici à la place.\nÀ: ${to}\nSujet: ${subject}\n${text}`
    );
    return { delivered: false };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, text }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("Échec envoi email (Resend):", res.status, body);
    return { delivered: false };
  }

  return { delivered: true };
}
