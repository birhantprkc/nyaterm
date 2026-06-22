import { isMacOS } from "./platform";

export const XTERM_PERFORMANCE_CONFIG = {
  highlighting: {
    /** Debounce delay in ms before re-scanning after new output is written. */
    debounceMs: 80,
    /** Throttle interval in ms for scroll-triggered viewport refreshes. */
    throttleMs: 80,
    /** Lines above and below the viewport to keep decorated on most platforms. */
    overscanLines: 50,
    /** macOS WebView benefits from a slightly smaller highlighted active zone. */
    macosOverscanLines: 40,
    /** Hard cap for total keyword highlight decorations held by one terminal. */
    maxDecorations: 1_000,
    /** Hard cap for new keyword highlight decorations created by one refresh. */
    maxDecorationsPerRefresh: 500,
    /** Hard cap for accepted keyword highlight matches on one physical line. */
    maxMatchesPerLine: 20,
    /** Main-thread time budget for one viewport refresh. */
    maxRefreshTimeMs: 12,
  },
  output: {
    /** Max characters to write into xterm in a single call. */
    writeChunkChars: 32 * 1024,
    /** Pause backend output when visible terminal backlog exceeds this size. */
    visiblePauseHighWatermark: 256 * 1024,
    /** Resume backend output when visible terminal backlog drops below this size. */
    visiblePauseLowWatermark: 64 * 1024,
    /** Pause backend output sooner while the terminal is hidden. */
    hiddenPauseHighWatermark: 128 * 1024,
    /** Resume backend output sooner while the terminal is hidden. */
    hiddenPauseLowWatermark: 32 * 1024,
    /** Queue cap while the terminal is visible. */
    visibleBacklogCap: 1_000_000,
    /** Queue cap while the terminal is hidden. */
    hiddenBacklogCap: 250_000,
    /** Recovery threshold after overload while visible. */
    visibleRecoveryThreshold: 200_000,
    /** Recovery threshold after overload while hidden. */
    hiddenRecoveryThreshold: 50_000,
    /** How long to keep the recovery notice visible. */
    recoveryNoticeMs: 3_000,
  },
} as const;

export function getKeywordHighlightPerformanceConfig() {
  const highlighting = XTERM_PERFORMANCE_CONFIG.highlighting;
  return {
    ...highlighting,
    resolvedOverscanLines: isMacOS ? highlighting.macosOverscanLines : highlighting.overscanLines,
  };
}
