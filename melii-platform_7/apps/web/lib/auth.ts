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

type TokenPayload = { sub: string; exp: number; purpose?: string };

function encodeToken(payload: TokenPayload): string {
  const encoded = base64url(Buffer.from(JSON.stringify(payload)));
  return `${encoded}.${sign(encoded)}`;
}

/** Décode et vérifie la signature + l'expiration d'un jeton — ne vérifie PAS
 * `purpose`, c'est aux appelants (verifySessionToken / verifyPending2faToken)
 * de s'assurer qu'un jeton d'un type n'est jamais accepté comme un autre
 * (ex. un jeton "2FA en attente" ne doit jamais valoir comme session réelle). */
function decodeToken(token: string | undefined | null): TokenPayload | null {
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
    if (typeof decoded.sub !== "string") return null;
    return decoded as TokenPayload;
  } catch {
    return null;
  }
}

/** Crée un jeton de session signé pour une créatrice donnée. */
export function createSessionToken(creatorId: string): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  return encodeToken({ sub: creatorId, exp });
}

/** Vérifie un jeton de session et retourne le creatorId si valide. Refuse
 * explicitement un jeton "2FA en attente" (purpose="2fa") : sans ce check,
 * un jeton émis pendant l'étape intermédiaire de connexion (avant saisie du
 * code) pourrait être rejoué comme une vraie session, ce qui court-circuiterait
 * le 2FA. */
export function verifySessionToken(token: string | undefined | null): string | null {
  const decoded = decodeToken(token);
  if (!decoded || decoded.purpose) return null;
  return decoded.sub;
}

// Jeton intermédiaire très courte durée émis juste après un mot de passe
// correct quand le 2FA est activé — n'autorise RIEN d'autre que de finir la
// connexion via /api/auth/verify-2fa, jamais accepté par verifySessionToken.
const PENDING_2FA_TTL_SECONDS = 5 * 60;

export function createPending2faToken(creatorId: string): string {
  const exp = Math.floor(Date.now() / 1000) + PENDING_2FA_TTL_SECONDS;
  return encodeToken({ sub: creatorId, exp, purpose: "2fa" });
}

export function verifyPending2faToken(token: string | undefined | null): string | null {
  const decoded = decodeToken(token);
  if (!decoded || decoded.purpose !== "2fa") return null;
  return decoded.sub;
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
