import crypto from "node:crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE = "melii_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 jours

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) {
    throw new Error(
      "SESSION_SECRET manquant dans l'environnement (voir .env.example)."
    );
  }
  return s;
}

function base64url(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function sign(payload: string): string {
  return base64url(crypto.createHmac("sha256", secret()).update(payload).digest());
}

/** Crée un jeton de session signé pour une créatrice donnée. */
export function createSessionToken(creatorId: string): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = base64url(Buffer.from(JSON.stringify({ sub: creatorId, exp })));
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

/** Vérifie un jeton de session et retourne le creatorId si valide. */
export function verifySessionToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expectedSig = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
    if (typeof decoded.exp !== "number" || decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return decoded.sub as string;
  } catch {
    return null;
  }
}

export async function setSessionCookie(creatorId: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, createSessionToken(creatorId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** À utiliser dans les Server Components / route handlers. */
export async function getCurrentCreatorId(): Promise<string | null> {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
}

/**
 * Helper pour les route handlers : renvoie le creatorId connecté, ou lève
 * une NextResponse 401 (à catcher / retourner directement) sinon.
 */
export class Unauthorized extends Error {}

export async function requireCreatorId(): Promise<string> {
  const creatorId = await getCurrentCreatorId();
  if (!creatorId) throw new Unauthorized();
  return creatorId;
}

/**
 * Le dashboard admin (voir app/admin) est réservé aux emails listés dans
 * ADMIN_EMAILS (séparés par des virgules) — pas une vraie gestion de rôles,
 * volontairement minimal pour un usage à une seule personne (vous).
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowlist = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.trim().toLowerCase());
}
