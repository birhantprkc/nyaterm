import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { MdClose, MdKeyboardArrowDown, MdKeyboardArrowUp } from "react-icons/md";
import type { TerminalSearchState } from "@/lib/terminalSearch";

interface TerminalSearchBarProps {
  show: boolean;
  searchQuery: string;
  searchState: TerminalSearchState;
  setSearchQuery: (val: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

export default function TerminalSearchBar({
  show,
  searchQuery,
  searchState,
  setSearchQuery,
  onNext,
  onPrev,
  onClose,
}: TerminalSearchBarProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (show) {
      inputRef.current?.focus();
    }
  }, [show]);

  const statusLabel = useMemo(() => getStatusLabel(searchState, t), [searchState, t]);

  if (!show) return null;

  return (
    <div
      className="absolute top-1 right-1 flex items-center gap-1 px-2 py-1 rounded shadow-lg border z-50"
      style={{
        backgroundColor: "var(--df-bg-panel)",
        borderColor: "var(--df-border)",
        color: "var(--df-text)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        type="text"
        className="bg-transparent outline-none text-xs px-1 py-0.5"
        style={{ color: "var(--df-text)", width: "180px" }}
        placeholder={t("terminalCtx.find")}
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (e.shiftKey) onPrev();
            else onNext();
          } else if (e.key === "Escape") {
            onClose();
          }
        }}
      />
      {statusLabel && (
        <span
          className="min-w-10 text-right text-[11px] whitespace-nowrap"
          style={{
            color: searchState.status === "error" ? "var(--df-danger)" : "var(--df-text-muted)",
          }}
          title={searchState.error ?? statusLabel}
        >
          {statusLabel}
        </span>
      )}
      <MdKeyboardArrowUp
        className="text-sm cursor-pointer hover:opacity-80"
        style={{ color: "var(--df-text-muted)" }}
        onClick={onPrev}
        title={t("terminalCtx.findPrevious")}
      />
      <MdKeyboardArrowDown
        className="text-sm cursor-pointer hover:opacity-80"
        style={{ color: "var(--df-text-muted)" }}
        onClick={onNext}
        title={t("terminalCtx.findNext")}
      />
      <MdClose
        className="text-sm cursor-pointer hover:opacity-80"
        style={{ color: "var(--df-text-muted)" }}
        onClick={onClose}
        title={t("about.close")}
      />
    </div>
  );
}

function getStatusLabel(searchState: TerminalSearchState, t: (key: string) => string) {
  if (!searchState.query) {
    return null;
  }

  if (searchState.status === "pending" || searchState.status === "searching") {
    return t("terminalCtx.findSearching");
  }

  if (searchState.status === "error") {
    return searchState.isRegexValid
      ? t("terminalCtx.findError")
      : t("terminalCtx.findInvalidRegex");
  }

  if (searchState.status === "not-found") {
    return t("terminalCtx.findNoResults");
  }

  if (searchState.status !== "found") {
    return null;
  }

  if (searchState.resultCount === null) {
    return t("terminalCtx.findFound");
  }

  if (searchState.activeIndex === null) {
    return String(searchState.resultCount);
  }

  return `${searchState.activeIndex + 1}/${searchState.resultCount}`;
}
