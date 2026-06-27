import type { Terminal } from "@xterm/xterm";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  createTerminalSearchController,
  type TerminalSearchAddon,
  type TerminalSearchController,
  type TerminalSearchControllerOptions,
  type TerminalSearchDecorationPolicy,
  type TerminalSearchDecorations,
  type TerminalSearchPerformanceMode,
  type TerminalSearchState,
} from "@/lib/terminalSearch";

export interface UseTerminalSearchOptions {
  terminal?: Terminal | null;
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

export interface UseTerminalSearchResult {
  searchAddonRef: React.MutableRefObject<TerminalSearchAddon | null>;
  showSearchBar: boolean;
  setShowSearchBar: (show: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchState: TerminalSearchState;
  handleSearchNext: (query?: string) => void;
  handleSearchPrev: (query?: string) => void;
  handleCloseSearch: () => void;
}

export function useTerminalSearch(
  terminalRef: React.RefObject<Terminal | null>,
  options: UseTerminalSearchOptions = {},
): UseTerminalSearchResult {
  const searchAddonRef = useRef<TerminalSearchAddon | null>(null);
  const [showSearchBar, setShowSearchBarState] = useState(false);
  const controllerRef = useRef<TerminalSearchController | null>(null);
  const {
    terminal,
    performanceMode,
    caseSensitive,
    regex,
    wholeWord,
    incremental,
    debounceMs,
    minIncrementalQueryLength,
    decorationPolicy,
    decorations,
    focusTerminalAfterNavigation,
  } = options;
  const visible = (options.visible ?? true) && showSearchBar;

  if (!controllerRef.current) {
    controllerRef.current = createTerminalSearchController(
      toControllerOptions(terminalRef, searchAddonRef.current, options, visible),
    );
  }

  const controller = controllerRef.current;

  useEffect(() => {
    controller.setOptions(
      toControllerOptions(
        terminalRef,
        searchAddonRef.current,
        {
          terminal,
          performanceMode,
          caseSensitive,
          regex,
          wholeWord,
          incremental,
          debounceMs,
          minIncrementalQueryLength,
          decorationPolicy,
          decorations,
          focusTerminalAfterNavigation,
        },
        visible,
      ),
    );
  }, [
    controller,
    terminalRef,
    terminal,
    performanceMode,
    caseSensitive,
    regex,
    wholeWord,
    incremental,
    debounceMs,
    minIncrementalQueryLength,
    decorationPolicy,
    decorations,
    focusTerminalAfterNavigation,
    visible,
  ]);

  useEffect(() => {
    return () => {
      controller.dispose();
    };
  }, [controller]);

  const searchState = useSyncExternalStore(
    (listener) => {
      const disposable = controller.subscribe(listener);
      return () => {
        disposable.dispose();
      };
    },
    controller.getState,
    controller.getState,
  );

  const setShowSearchBar = useCallback(
    (show: boolean) => {
      setShowSearchBarState(show);
      if (!show) {
        controller.clear();
      }
    },
    [controller],
  );

  const setSearchQuery = useCallback(
    (query: string) => {
      controller.setQuery(query);
    },
    [controller],
  );

  const handleSearchNext = useCallback(
    (query?: string) => {
      controller.findNext(query);
    },
    [controller],
  );

  const handleSearchPrev = useCallback(
    (query?: string) => {
      controller.findPrevious(query);
    },
    [controller],
  );

  const handleCloseSearch = useCallback(() => {
    setShowSearchBarState(false);
    controller.clear();
    terminalRef.current?.focus();
  }, [controller, terminalRef]);

  return useMemo(
    () => ({
      searchAddonRef,
      showSearchBar,
      setShowSearchBar,
      searchQuery: searchState.query,
      setSearchQuery,
      searchState,
      handleSearchNext,
      handleSearchPrev,
      handleCloseSearch,
    }),
    [
      showSearchBar,
      setShowSearchBar,
      searchState,
      setSearchQuery,
      handleSearchNext,
      handleSearchPrev,
      handleCloseSearch,
    ],
  );
}

function toControllerOptions(
  terminalRef: React.RefObject<Terminal | null>,
  searchAddon: TerminalSearchAddon | null,
  options: UseTerminalSearchOptions,
  visible: boolean,
): TerminalSearchControllerOptions {
  return {
    terminal: options.terminal ?? terminalRef.current,
    searchAddon,
    visible,
    performanceMode: options.performanceMode,
    caseSensitive: options.caseSensitive,
    regex: options.regex,
    wholeWord: options.wholeWord,
    incremental: options.incremental,
    debounceMs: options.debounceMs,
    minIncrementalQueryLength: options.minIncrementalQueryLength,
    decorationPolicy: options.decorationPolicy,
    decorations: options.decorations,
    focusTerminalAfterNavigation: options.focusTerminalAfterNavigation,
  };
}
