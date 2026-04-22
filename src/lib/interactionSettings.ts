export const DEFAULT_COMMAND_SUGGESTION_MAX_CHARS = 64;
export const MIN_COMMAND_SUGGESTION_MAX_CHARS = 1;
export const MAX_COMMAND_SUGGESTION_MAX_CHARS = 500;

export function normalizeCommandSuggestionMaxChars(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_COMMAND_SUGGESTION_MAX_CHARS;
  }

  return Math.min(
    MAX_COMMAND_SUGGESTION_MAX_CHARS,
    Math.max(MIN_COMMAND_SUGGESTION_MAX_CHARS, Math.trunc(value)),
  );
}
