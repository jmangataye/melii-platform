// Types volontairement permissifs pour ce MVP — voir index.js pour le
// détail des champs retournés par chaque fonction. Toutes les fonctions
// d'accès aux données sont asynchrones (PostgreSQL via `pg`).

export interface Creator {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  personaTone: string;
  personaBio: string;
  personaLanguage: string;
  telegramBotToken: string | null;
  telegramBotUsername: string | null;
  telegramWebhookSecret: string | null;
  telegramWebhookReady: boolean;
  ageConfirmed: boolean;
  subscriptionStatus: "trial" | "active" | "past_due" | "canceled" | string;
  trialEndsAt: string | null;
  subscriptionPlan: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  avatarUrl: string | null;
  accentColor: string | null;
  slug: string | null;
  galleryUrls: string[];
  referralCode: string | null;
  referredByCreatorId: string | null;
  totpEnabled: boolean;
  customDomain: string | null;
  customDomainVerifyToken: string | null;
  customDomainVerified: boolean;
  relanceEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Tier {
  id: string;
  creatorId: string;
  order: number;
  label: string;
  priceCents: number;
  currency: string;
  url: string;
  createdAt: string;
}

export interface Sale {
  id: string;
  tierId: string;
  tierLabel: string;
  amountCents: number;
  currency: string;
  note: string;
  declaredAt: string;
}

export interface DailyClicks {
  day: string;
  clicks: number;
}

export interface VisitsBySource {
  source: string;
  visits: number;
}

export interface FanSegmentation {
  newFans: number;
  returningFans: number;
}

export interface Stats {
  clicksByTier: Record<string, number>;
  clicksByDay: DailyClicks[];
  totalDeclaredCents: number;
  commissionRate: number;
  commissionOwedCents: number;
  referralCount: number;
  visitsBySource: VisitsBySource[];
  fanSegmentation: FanSegmentation;
}

export interface AdminCreatorSummary {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  subscriptionStatus: string;
  subscriptionPlan: string | null;
  trialEndsAt: string | null;
  telegramConnected: boolean;
  tierCount: number;
  totalDeclaredCents: number;
  conversations30d: number;
  referralCount: number;
  commissionRate: number;
  commissionOwedCents: number;
}

export interface FlaggedConversation {
  id: string;
  creatorId: string;
  chatId: string;
  content: string;
  createdAt: string;
  creatorDisplayName: string;
  creatorEmail: string;
}

export interface StalledTelegramConversation {
  creatorId: string;
  chatId: string;
  tierId: string | null;
  telegramBotToken: string | null;
  creatorDisplayName: string;
}

export function id(): string;
export function hashPassword(password: string): string;
export function verifyPassword(password: string, stored: string): boolean;
export function createCreator(input: { email: string; password: string; displayName: string; ageConfirmed: boolean; referralCode?: string | null }): Promise<Creator>;
export function getCreatorByEmail(email: string): Promise<Creator | null>;
export function getCreatorById(id: string): Promise<Creator | null>;
export function getCreatorBySlugOrId(value: string): Promise<Creator | null>;
export function getCreatorByReferralCode(code: string | null | undefined): Promise<Creator | null>;
export function updateCreatorSlug(creatorId: string, rawSlug: string): Promise<Creator>;
export class SlugTakenError extends Error {}
export function deleteCreator(id: string): Promise<boolean>;
export function updateCreatorPersona(id: string, input: { tone: string; bio: string; displayName: string; language?: string }): Promise<Creator>;
export function updateCreatorProfile(id: string, input: { avatarUrl?: string | null; accentColor?: string | null; galleryUrls?: string[] }): Promise<Creator | null>;
export function updateCreatorTelegram(id: string, input: { token: string | null; username: string | null; webhookSecret: string | null; webhookReady: boolean }): Promise<Creator>;
export function updateCreatorPasswordHash(id: string, passwordHash: string): Promise<void>;
export function updateCreatorSubscription(id: string, input: { status?: string; plan?: string | null; stripeCustomerId?: string | null; stripeSubscriptionId?: string | null }): Promise<Creator | null>;
export function getCreatorByStripeCustomerId(stripeCustomerId: string): Promise<Creator | null>;
export function createPasswordResetToken(creatorId: string): Promise<string>;
export function consumePasswordResetToken(rawToken: string, newPassword: string): Promise<boolean>;
export function listTiers(creatorId: string): Promise<Tier[]>;
export function getTierById(tierId: string): Promise<Tier | null>;
export function upsertTier(creatorId: string, input: { order: number; label: string; priceCents: number; currency?: string; url: string }): Promise<Tier>;
export function deleteTier(creatorId: string, tierId: string): Promise<void>;
export function logClick(input: { creatorId: string; tierId: string; telegramChatId?: string | null }): Promise<void>;
export function declareSale(input: { creatorId: string; tierId: string; amountCents: number; currency?: string; note?: string }): Promise<void>;
export function listSales(creatorId: string): Promise<Sale[]>;
export function getStats(creatorId: string, days?: number): Promise<Stats>;
export function getClicksByDay(creatorId: string, days?: number): Promise<DailyClicks[]>;
export function getReferralCount(creatorId: string): Promise<number>;
export function logLinkVisit(input: { creatorId: string; source?: string | null }): Promise<void>;
export function getVisitsBySource(creatorId: string, days?: number): Promise<VisitsBySource[]>;
export function getFanSegmentation(creatorId: string, days?: number): Promise<FanSegmentation>;
export function appendMessage(input: { creatorId: string; chatId: string; role: "user" | "assistant"; content: string; flagged?: boolean }): Promise<void>;
export function getRecentMessages(input: { creatorId: string; chatId: string; limit?: number }): Promise<{ role: string; content: string }[]>;
export function getConversationVolume(creatorId: string, sinceDays?: number): Promise<number>;
export function purgeOldConversations(days?: number): Promise<number>;
export function listFlaggedConversations(limit?: number): Promise<FlaggedConversation[]>;
export interface ContextMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  flagged: boolean;
}
export function getMessageContext(creatorId: string, chatId: string, messageId: string, contextSize?: number): Promise<ContextMessage[]>;
export function markFlagReviewed(messageId: string): Promise<boolean>;
export function adminListCreators(): Promise<AdminCreatorSummary[]>;

export function setCustomDomainPending(creatorId: string, domain: string | null): Promise<Creator>;
export function markCustomDomainVerified(creatorId: string): Promise<Creator>;
export function getCreatorByCustomDomain(domain: string | null | undefined): Promise<Creator | null>;

export function beginTotpEnrollment(): string;
export function enableTotp(creatorId: string, secret: string): Promise<string[]>;
export function disableTotp(creatorId: string): Promise<void>;
export function getTotpSecretRaw(creatorId: string): Promise<{ secret: string | null; enabled: boolean } | null>;
export function verifyTotpCode(secret: string, code: string, window?: number): boolean;
export function totpAuthUrl(secret: string, email: string): string;
export function consumeBackupCode(creatorId: string, code: string): Promise<boolean>;

export function findStalledTelegramConversations(limit?: number): Promise<StalledTelegramConversation[]>;
export function recordRelanceSent(input: { creatorId: string; chatId: string; tierId?: string | null }): Promise<void>;
export function updateCreatorRelance(creatorId: string, enabled: boolean): Promise<Creator>;
/** Exporté uniquement pour les tests — voir le commentaire dans index.js. */
export function backfillLegacyCreators(): Promise<void>;

export const COMMISSION_RATE: number;
export const REFERRAL_DISCOUNT_PER_REFERRAL: number;
export const REFERRAL_DISCOUNT_CAP: number;
export const TRIAL_DAYS: number;
