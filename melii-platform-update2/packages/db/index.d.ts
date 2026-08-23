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

export interface Stats {
  clicksByTier: Record<string, number>;
  totalDeclaredCents: number;
  commissionRate: number;
  commissionOwedCents: number;
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
  commissionOwedCents: number;
}

export function id(): string;
export function hashPassword(password: string): string;
export function verifyPassword(password: string, stored: string): boolean;
export function createCreator(input: { email: string; password: string; displayName: string; ageConfirmed: boolean }): Promise<Creator>;
export function getCreatorByEmail(email: string): Promise<Creator | null>;
export function getCreatorById(id: string): Promise<Creator | null>;
export function deleteCreator(id: string): Promise<boolean>;
export function updateCreatorPersona(id: string, input: { tone: string; bio: string; displayName: string }): Promise<Creator>;
export function updateCreatorProfile(id: string, input: { avatarUrl: string | null; accentColor: string | null }): Promise<Creator>;
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
export function getStats(creatorId: string): Promise<Stats>;
export function appendMessage(input: { creatorId: string; chatId: string; role: "user" | "assistant"; content: string }): Promise<void>;
export function getRecentMessages(input: { creatorId: string; chatId: string; limit?: number }): Promise<{ role: string; content: string }[]>;
export function getConversationVolume(creatorId: string, sinceDays?: number): Promise<number>;
export function purgeOldConversations(days?: number): Promise<number>;
export function adminListCreators(): Promise<AdminCreatorSummary[]>;
export const COMMISSION_RATE: number;
export const TRIAL_DAYS: number;
