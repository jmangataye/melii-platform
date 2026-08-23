export interface TonePreset {
  label: string;
  description: string;
  voice: string;
}

export const TONE_PRESETS: Record<string, TonePreset>;

export function buildSystemPrompt(input: {
  creatorName: string;
  tone: string;
  bio: string;
  tiers: { order: number; label: string; priceCents: number; currency: string; shortUrl: string }[];
}): string;

export function containsSafetyKeyword(text: string): boolean;
export const SAFE_FALLBACK_REPLY: string;
