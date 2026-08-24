import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Next.js 16 a renommé middleware.ts -> proxy.ts (voir
// node_modules/next/dist/docs/.../file-conventions/proxy.md) — même
// fonctionnement, juste un nom de fichier/export différent.
//
// Rôle ici : quand une créatrice a branché un domaine perso vérifié
// (ex. lunabot.com — voir /api/custom-domain), on réécrit la racine "/" de
// ce domaine vers sa page de chat publique /c/[creatorId], pour qu'elle
// s'affiche directement sans redirection visible dans la barre d'adresse.
// Le domaine principal de l'app (SITE_HOST) n'est jamais concerné.
//
// La résolution DB passe par un fetch interne vers /api/resolve-domain
// plutôt qu'un import direct de @melii/db ici : le driver `pg` charge `fs`
// conditionnellement, et le bundle webpack de proxy.ts échoue à le résoudre
// même si Proxy tourne sous le runtime Node.js (constaté en dev — voir
// commentaire sur la route resolve-domain).

function siteHost(): string {
  try {
    return new URL(
      process.env.PUBLIC_WEB_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:3000"
    ).hostname;
  } catch {
    return "localhost";
  }
}

export async function proxy(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase() || "";

  if (!host || host === siteHost() || host === "localhost" || request.nextUrl.pathname !== "/") {
    return NextResponse.next();
  }

  let creatorId: string | null = null;
  try {
    const resolveUrl = new URL("/api/resolve-domain", request.url);
    resolveUrl.searchParams.set("host", host);
    const res = await fetch(resolveUrl, { headers: { "x-melii-internal": "proxy" } });
    if (res.ok) {
      const json = (await res.json()) as { creatorId: string | null };
      creatorId = json.creatorId;
    }
  } catch {
    // Domaine mal configuré / route interne injoignable : on laisse passer
    // la requête normalement plutôt que de renvoyer une erreur au visiteur.
    return NextResponse.next();
  }

  if (!creatorId) {
    return NextResponse.next();
  }

  return NextResponse.rewrite(new URL(`/c/${creatorId}`, request.url));
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
