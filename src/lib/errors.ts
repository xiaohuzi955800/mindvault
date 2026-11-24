/**
 * Friendly messages for AI provider errors.
 *
 * The Firebase AI Logic SDK surfaces raw errors like
 * "AI: Error fetching from https://…/models/gemini-3.8-flash:generateContent:
 * [429 ] You exceeded your current quota …" — accurate, but a wall of
 * technical text for a diary app. `friendlyAiError` maps the two transient
 * failure modes a user can actually do something about (rate limits and
 * service overload) to a short message with a retry hint, and passes
 * everything else through unchanged. The raw text is always kept alongside
 * the friendly message so it stays inspectable (the UI shows it behind a
 * "Details" toggle) — verification and debugging never lose the exact error.
 */
export interface FriendlyError {
  /** Short user-facing message (the raw text when no mapping applies). */
  message: string;
  /** The original error text, always preserved. */
  raw: string;
  /** True when `message` is a friendly rewrite rather than the raw text. */
  friendly: boolean;
}

export function friendlyAiError(raw: string): FriendlyError {
  const text = raw.toLowerCase();
  // 429 — free-tier rate limit. The SDK format is "[429 ] …" (note the
  // space before the bracket); keyword fallbacks cover format drift.
  if (
    /\[429\s*\]/.test(raw) ||
    text.includes('quota') ||
    text.includes('rate limit') ||
    text.includes('rate-limit')
  ) {
    return {
      message:
        "Google's free tier is rate-limited — please wait a minute and try again.",
      raw,
      friendly: true,
    };
  }
  // 500 / 503 — Google's service is overloaded. Spikes are usually temporary.
  if (
    /\[50[03]\s*\]/.test(raw) ||
    text.includes('high demand') ||
    text.includes('overload')
  ) {
    return {
      message:
        "Google's service is busy right now — please try again in a bit.",
      raw,
      friendly: true,
    };
  }
  return { message: raw, raw, friendly: false };
}
