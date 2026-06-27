import type { Terminal } from "@xterm/xterm";

export type Disposable = { dispose: () => void };
export type TerminalSearchDirection = "next" | "previous";
export type TerminalSearchStatus =
  | "idle"
  | "pending"
  | "searching"
  | "found"
  | "not-found"
  | "error";
export type TerminalSearchPerformanceMode = "normal" | "busy" | "overloaded";
export type TerminalSearchDecorationPolicy = "never" | "stable" | "navigation" | "always";

export interface TerminalSearchDecorations {
  matchBackground?: string;
  matchBorder?: string;
  matchOverviewRuler: string;
  activeMatchBackground?: string;
  activeMatchBorder?: string;
  activeMatchColorOverviewRuler: string;
}

export interface TerminalSearchOptions {
  caseSensitive?: boolean;
  regex?: boolean;
  wholeWord?: boolean;
  incremental?: boolean;
  decorations?: TerminalSearchDecorations;
}

export interface TerminalSearchResultChangeEvent {
  resultIndex: number;
  resultCount: number;
}

export interface TerminalSearchAddon {
  findNext: (query: string, options?: TerminalSearchOptions) => unknown;
  findPrevious: (query: string, options?: TerminalSearchOptions) => unknown;
  clearDecorations?: () => void;
  clearActiveDecoration?: () => void;
  onDidChangeResults?: (listener: (event: TerminalSearchResultChangeEvent) => void) => Disposable;
}

export interface TerminalSearchState {
  query: string;
  status: TerminalSearchStatus;
  activeIndex: number | null;
  resultCount: number | null;
  lastDirection: TerminalSearchDirection;
  error: string | null;
  isPreview: boolean;
  isRegexValid: boolean;
}

export interface TerminalSearchControllerOptions {
  terminal: Terminal | null | undefined;
  searchAddon: TerminalSearchAddon | null | undefined;
  visible?: boolean;
  performanceMode?: TerminalSearchPerformanceMode;
  caseSensitive?: boolean;
  regex?: boolean;
  wholeWord?: boolean;
  incremental?: boolean;
  debounceMs?: number;
  minIncrementalQueryLength?: number;
  decorationPolicy?: TerminalSearchDecorationPolicy;
  decorations?: TerminalSearchDecorations;
  focusTerminalAfterNavigation?: boolean;
}

export interface TerminalSearchController {
  getState: () => TerminalSearchState;
  subscribe: (listener: () => void) => Disposable;
  setQuery: (query: string) => void;
  setOptions: (options: Partial<TerminalSearchControllerOptions>) => void;
  findNext: (query?: string) => void;
  findPrevious: (query?: string) => void;
  clear: () => void;
  dispose: () => void;
}

const DEFAULT_DECORATIONS: TerminalSearchDecorations = {
  matchBackground: "#4f3f12",
  matchBorder: "#f5c542",
  matchOverviewRuler: "#f5c542",
  activeMatchBackground: "#ff9800",
  activeMatchBorder: "#ffb74d",
  activeMatchColorOverviewRuler: "#ff9800",
};

interface NormalizedTerminalSearchControllerOptions {
  terminal: Terminal | null;
  searchAddon: TerminalSearchAddon | null;
  visible: boolean;
  performanceMode: TerminalSearchPerformanceMode;
  caseSensitive: boolean;
  regex: boolean;
  wholeWord: boolean;
  incremental: boolean;
  debounceMs: number;
  minIncrementalQueryLength: number;
  decorationPolicy: TerminalSearchDecorationPolicy;
  decorations: TerminalSearchDecorations;
  focusTerminalAfterNavigation: boolean;
}

export function createTerminalSearchController(
  initialOptions: TerminalSearchControllerOptions,
): TerminalSearchController {
  let options = normalizeOptions(initialOptions);
  let state = createDefaultState();
  let disposed = false;
  let pendingTimer: number | null = null;
  let pendingFrame: number | null = null;
  let searchVersion = 0;
  let resultChangeDisposable: Disposable | null = null;
  let latestAddonResults: TerminalSearchResultChangeEvent | null = null;
  const listeners = new Set<() => void>();

  const emit = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const updateState = (next: Partial<TerminalSearchState>) => {
    state = { ...state, ...next };
    emit();
  };

  const cancelPending = () => {
    if (pendingTimer !== null) {
      window.clearTimeout(pendingTimer);
      pendingTimer = null;
    }
    if (pendingFrame !== null) {
      window.cancelAnimationFrame(pendingFrame);
      pendingFrame = null;
    }
  };

  const clearDecorations = () => {
    try {
      options.searchAddon?.clearDecorations?.();
      options.searchAddon?.clearActiveDecoration?.();
    } catch {
      // Decoration cleanup should never make the search UI unusable.
    }
  };

  const subscribeToResultChanges = (searchAddon: TerminalSearchAddon | null) => {
    resultChangeDisposable?.dispose();
    resultChangeDisposable = null;
    latestAddonResults = null;

    if (!searchAddon?.onDidChangeResults) {
      return;
    }

    resultChangeDisposable = searchAddon.onDidChangeResults((event) => {
      latestAddonResults = event;
      if (disposed || !state.query || state.status === "idle" || state.status === "pending") {
        return;
      }

      updateState({
        activeIndex: normalizeResultIndex(event.resultIndex),
        resultCount: event.resultCount,
        status: event.resultCount > 0 ? "found" : "not-found",
      });
    });
  };

  subscribeToResultChanges(options.searchAddon);

  const shouldRunIncrementalSearch = (query: string) => {
    if (!options.visible || !options.incremental || options.performanceMode === "overloaded") {
      return false;
    }
    return query.length >= options.minIncrementalQueryLength;
  };

  const schedulePreviewSearch = (query: string) => {
    cancelPending();
    searchVersion += 1;

    if (!query) {
      clearDecorations();
      updateState(createDefaultState());
      return;
    }

    const isRegexValid = validateSearchRegex(query, options.regex);
    const shouldSearch = shouldRunIncrementalSearch(query) && isRegexValid;

    updateState({
      query,
      status: shouldSearch ? "pending" : "idle",
      activeIndex: null,
      resultCount: null,
      error: isRegexValid ? null : "Invalid regular expression",
      isPreview: true,
      isRegexValid,
    });

    if (!shouldSearch) {
      clearDecorations();
      return;
    }

    const version = searchVersion;
    pendingTimer = window.setTimeout(() => {
      pendingTimer = null;
      pendingFrame = window.requestAnimationFrame(() => {
        pendingFrame = null;
        if (version !== searchVersion || disposed) {
          return;
        }
        runSearch(query, "next", true);
      });
    }, options.debounceMs);
  };

  const runSearch = (query: string, direction: TerminalSearchDirection, isPreview: boolean) => {
    if (disposed) {
      return;
    }

    if (!query || !options.terminal || !options.searchAddon) {
      clearDecorations();
      updateState({
        query,
        status: query ? "error" : "idle",
        activeIndex: null,
        resultCount: null,
        lastDirection: direction,
        error: query ? "Terminal search is not ready" : null,
        isPreview,
        isRegexValid: true,
      });
      return;
    }

    if (!validateSearchRegex(query, options.regex)) {
      updateState({
        query,
        status: "error",
        activeIndex: null,
        resultCount: null,
        lastDirection: direction,
        error: "Invalid regular expression",
        isPreview,
        isRegexValid: false,
      });
      return;
    }

    updateState({
      query,
      status: "searching",
      lastDirection: direction,
      error: null,
      isPreview,
      isRegexValid: true,
    });

    try {
      latestAddonResults = null;
      const decorationsEnabled = shouldEnableDecorations(options.decorationPolicy, isPreview);
      if (!decorationsEnabled) {
        clearDecorations();
      }

      const searchOptions = buildSearchOptions(options, isPreview, decorationsEnabled);
      const result =
        direction === "next"
          ? options.searchAddon.findNext(query, searchOptions)
          : options.searchAddon.findPrevious(query, searchOptions);
      const normalizedResult = normalizeSearchResult(result, latestAddonResults);

      updateState({
        query,
        status: normalizedResult.found ? "found" : "not-found",
        activeIndex: normalizedResult.activeIndex,
        resultCount: normalizedResult.resultCount,
        lastDirection: direction,
        error: null,
        isPreview,
        isRegexValid: true,
      });

      if (!isPreview && options.focusTerminalAfterNavigation) {
        options.terminal.focus();
      }
    } catch (error) {
      updateState({
        query,
        status: "error",
        activeIndex: null,
        resultCount: null,
        lastDirection: direction,
        error: error instanceof Error ? error.message : String(error),
        isPreview,
      });
    }
  };

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return {
        dispose: () => {
          listeners.delete(listener);
        },
      };
    },
    setQuery: schedulePreviewSearch,
    setOptions: (nextOptions) => {
      const previousSearchAddon = options.searchAddon;
      options = normalizeOptions({ ...options, ...nextOptions });
      if (previousSearchAddon !== options.searchAddon) {
        subscribeToResultChanges(options.searchAddon);
      }
      if (state.query) {
        schedulePreviewSearch(state.query);
      }
    },
    findNext: (query) => {
      cancelPending();
      searchVersion += 1;
      runSearch(query ?? state.query, "next", false);
    },
    findPrevious: (query) => {
      cancelPending();
      searchVersion += 1;
      runSearch(query ?? state.query, "previous", false);
    },
    clear: () => {
      cancelPending();
      searchVersion += 1;
      clearDecorations();
      updateState(createDefaultState());
    },
    dispose: () => {
      disposed = true;
      cancelPending();
      resultChangeDisposable?.dispose();
      resultChangeDisposable = null;
      clearDecorations();
      listeners.clear();
    },
  };
}

function createDefaultState(): TerminalSearchState {
  return {
    query: "",
    status: "idle",
    activeIndex: null,
    resultCount: null,
    lastDirection: "next",
    error: null,
    isPreview: false,
    isRegexValid: true,
  };
}

function normalizeOptions(
  options: TerminalSearchControllerOptions,
): NormalizedTerminalSearchControllerOptions {
  const performanceMode = options.performanceMode ?? "normal";

  return {
    terminal: options.terminal ?? null,
    searchAddon: options.searchAddon ?? null,
    visible: options.visible ?? true,
    performanceMode,
    caseSensitive: options.caseSensitive ?? false,
    regex: options.regex ?? false,
    wholeWord: options.wholeWord ?? false,
    incremental: performanceMode === "overloaded" ? false : (options.incremental ?? true),
    debounceMs: options.debounceMs ?? (performanceMode === "busy" ? 220 : 150),
    minIncrementalQueryLength:
      options.minIncrementalQueryLength ?? (performanceMode === "normal" ? 2 : 3),
    decorationPolicy: options.decorationPolicy ?? "navigation",
    decorations: options.decorations ?? DEFAULT_DECORATIONS,
    focusTerminalAfterNavigation: options.focusTerminalAfterNavigation ?? false,
  };
}

function buildSearchOptions(
  options: NormalizedTerminalSearchControllerOptions,
  isPreview: boolean,
  decorationsEnabled: boolean,
): TerminalSearchOptions {
  const searchOptions: TerminalSearchOptions = {
    caseSensitive: options.caseSensitive,
    regex: options.regex,
    wholeWord: options.wholeWord,
    incremental: isPreview,
  };

  if (decorationsEnabled) {
    searchOptions.decorations = options.decorations;
  }

  return searchOptions;
}

function shouldEnableDecorations(
  policy: TerminalSearchDecorationPolicy,
  isPreview: boolean,
): boolean {
  if (policy === "always") {
    return true;
  }
  if (policy === "never") {
    return false;
  }
  if (policy === "navigation") {
    return !isPreview;
  }
  return isPreview;
}

function normalizeSearchResult(
  result: unknown,
  resultChangeEvent: TerminalSearchResultChangeEvent | null,
): {
  found: boolean;
  activeIndex: number | null;
  resultCount: number | null;
} {
  if (result && typeof result === "object") {
    const searchResult = result as {
      resultIndex?: number;
      resultCount?: number;
    };
    const resultCount =
      typeof searchResult.resultCount === "number" ? searchResult.resultCount : null;
    const activeIndex = normalizeResultIndex(searchResult.resultIndex);

    return {
      found: resultCount === null ? activeIndex !== null : resultCount > 0,
      activeIndex,
      resultCount,
    };
  }

  if (resultChangeEvent) {
    return {
      found: resultChangeEvent.resultCount > 0,
      activeIndex: normalizeResultIndex(resultChangeEvent.resultIndex),
      resultCount: resultChangeEvent.resultCount,
    };
  }

  if (typeof result === "boolean") {
    return {
      found: result,
      activeIndex: null,
      resultCount: result ? null : 0,
    };
  }

  return {
    found: false,
    activeIndex: null,
    resultCount: null,
  };
}

function normalizeResultIndex(index: unknown) {
  return typeof index === "number" && index >= 0 ? index : null;
}

function validateSearchRegex(query: string, regex: boolean): boolean {
  if (!regex) {
    return true;
  }

  try {
    new RegExp(query);
    return true;
  } catch {
    return false;
  }
}
