import { NextResponse } from "next/server";
import { getCreatorById } from "@melii/db";
import { getCurrentCreatorId } from "@/lib/auth";

// "Vérifier la connexion" côté dashboard (onglet Telegram) — un simple appel
// à getMe confirme que le token est toujours valide et que Telegram répond,
// sans avoir besoin d'un chat_id existant (contrairement à l'envoi d'un vrai
// message de test). Utile pour rassurer une créatrice non technique avant
// qu'elle partage son lien t.me/... à sa communauté.
export async function POST() {
  const creatorId = await getCurrentCreatorId();
  if (!creatorId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const creator = await getCreatorById(creatorId);
  if (!creator?.telegramBotToken) {
    return NextResponse.json({ error: "Aucun bot Telegram connecté." }, { status: 400 });
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${creator.telegramBotToken}/getMe`);
    const json = await res.json();
    if (!json.ok) {
      return NextResponse.json(
        { error: "Le bot ne répond plus — le token a peut-être été révoqué depuis BotFather." },
        { status: 502 }
      );
    }
    return NextResponse.json({
      ok: true,
      username: json.result.username as string,
      firstName: json.result.first_name as string,
    });
  } catch {
    return NextResponse.json({ error: "Impossible de joindre Telegram. Réessayez." }, { status: 502 });
  }
}
