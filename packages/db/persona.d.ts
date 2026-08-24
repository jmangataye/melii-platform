export interface TonePreset {
  label: string;
  description: string;
  voice: string;
}

export const TONE_PRESETS: Record<string, TonePreset>;

export type PersonaLanguage = "fr" | "en" | "es";
export const VALID_LANGUAGES: PersonaLanguage[];

export function buildSystemPrompt(input: {
  creatorName: string;
  tone: string;
  bio: string;
  tiers: { order: number; label: string; priceCents: number; currency: string; shortUrl: string; sellAngle?: string }[];
  language?: string;
  fanNotes?: string | null;
  fanPotential?: string | null;
}): string;

export function containsSafetyKeyword(text: string): boolean;
export const SAFE_FALLBACK_REPLY: string;
export const SAFE_FALLBACK_REPLIES: Record<string, string>;
export function getSafeFallbackReply(language: string | null | undefined): string;
