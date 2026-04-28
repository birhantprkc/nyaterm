import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { memo, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  MdAutoAwesome,
  MdClose,
  MdContentCopy,
  MdExpandLess,
  MdExpandMore,
  MdHistory,
  MdInput,
  MdOutlineSettings,
  MdSave,
  MdSearch,
  MdSend,
  MdStop,
} from "react-icons/md";
import { LuMessageSquarePlus } from "react-icons/lu";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import PanelHeader from "@/components/layout/PanelHeader";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/context/AppContext";
import type { AIErrorDetectedDetail, AIOpenIntent } from "@/lib/aiEvents";
import { AI_ERROR_DETECTED_EVENT } from "@/lib/aiEvents";
import { getErrorMessage } from "@/lib/errors";
import { invoke } from "@/lib/invoke";
import { buildAIContext, getTerminalContextProvider } from "@/lib/terminalContext";
import { openSettings } from "@/lib/windowManager";
import { collectSessionPanes } from "@/lib/workspaceTabs";
import type {
  AIAction,
  AICommandCard,
  AIContext,
  AIMessage,
  AISession,
  AIStreamEventPayload,
  AIStreamStart,
  QuickCommand,
  QuickCommandCategory,
  QuickCommandsConfig,
  RiskLevel,
  SavedConnection,
  SessionPane,
} from "@/types/global";

interface AIAssistantPanelProps {
  activePane: SessionPane | null;
  activeConnection?: SavedConnection | null;
  intent: AIOpenIntent | null;
}

const riskClassName: Record<RiskLevel, string> = {
  low: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-600",
  high: "border-orange-500/30 bg-orange-500/10 text-orange-600",
  critical: "border-red-500/30 bg-red-500/10 text-red-600",
};

function actionTitle(action: AIAction) {
  switch (action) {
    case "generate_command":
      return "生成命令";
    case "explain_output":
      return "解释最近输出";
    case "explain_selected":
      return "解释选中内容";
    case "analyze_error":
      return "分析错误";
    case "repair_from_selection":
      return "生成修复命令";
  }
}

function createLocalMessage(role: "user" | "assistant", content: string, sessionId = "local") {
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    sessionId,
    role,
    content,
    createdAt: new Date().toISOString(),
    reasoningContent: null,
    commandCards: [],
  } satisfies AIMessage;
}

function slugCategory(name: string) {
  return `ai-${
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "commands"
  }`;
}

function mapRiskColor(riskLevel: RiskLevel) {
  switch (riskLevel) {
    case "critical":
      return "red";
    case "high":
      return "yellow";
    case "medium":
      return "blue";
    case "low":
      return "green";
  }
}

type MarkdownNodeProps = {
  children?: ReactNode;
  href?: string;
};

function looksLikeStructuredJsonOutput(content: string) {
  const trimmed = content.trimStart();
  return (
    trimmed.startsWith("{") ||
    trimmed.startsWith("```json") ||
    trimmed.startsWith("```") ||
    (trimmed.includes('"text"') && trimmed.includes('"commandCards"'))
  );
}

function AnimatedStatusText({ label }: { label: string }) {
  return <span className="df-thinking-text font-medium">{label}</span>;
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="break-words text-xs leading-5">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }: MarkdownNodeProps) => (
            <p className="my-2 first:mt-0 last:mb-0">{children}</p>
          ),
          ul: ({ children }: MarkdownNodeProps) => (
            <ul className="my-2 list-disc pl-5">{children}</ul>
          ),
          ol: ({ children }: MarkdownNodeProps) => (
            <ol className="my-2 list-decimal pl-5">{children}</ol>
          ),
          li: ({ children }: MarkdownNodeProps) => <li className="my-0.5">{children}</li>,
          a: ({ children, href }: MarkdownNodeProps) => (
            <a
              className="text-primary underline underline-offset-2"
              href={href}
              target="_blank"
              rel="noreferrer"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }: MarkdownNodeProps) => (
            <blockquote className="my-2 border-l-2 border-border pl-3 text-muted-foreground">
              {children}
            </blockquote>
          ),
          pre: ({ children }: MarkdownNodeProps) => (
            <pre className="terminal-scroll my-2 max-h-64 overflow-auto rounded-md border border-border/60 bg-muted/30 p-3 font-mono text-[0.6875rem] leading-5">
              {children}
            </pre>
          ),
          code: ({ children }: MarkdownNodeProps) => (
            <code className="rounded bg-muted/40 px-1 py-0.5 font-mono text-[0.6875rem]">
              {children}
            </code>
          ),
          table: ({ children }: MarkdownNodeProps) => (
            <div className="terminal-scroll my-2 overflow-auto">
              <table className="w-full border-collapse text-left">{children}</table>
            </div>
          ),
          th: ({ children }: MarkdownNodeProps) => (
            <th className="border border-border/60 px-2 py-1 font-medium">{children}</th>
          ),
          td: ({ children }: MarkdownNodeProps) => (
            <td className="border border-border/60 px-2 py-1">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function AssistantReasoning({ message, loading }: { message: AIMessage; loading: boolean }) {
  const { t } = useTranslation();
  const reasoningContent = message.reasoningContent?.trim();
  const [open, setOpen] = useState(false);

  if (!reasoningContent) {
    return loading ? (
      <div className="mt-3 overflow-hidden rounded-md border border-primary/25 bg-primary/8 shadow-sm">
        <div className="px-3 py-2.5 text-[0.6875rem]">
          <AnimatedStatusText label={t("ai.thinking")} />
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent animate-pulse" />
      </div>
    ) : null;
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={`mt-3 rounded-md border bg-background/40 ${
        loading ? "border-primary/25 bg-primary/6 shadow-sm" : "border-border/60"
      }`}
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[0.6875rem] font-medium transition hover:text-foreground ${
            loading ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <span className="flex min-w-0 items-center gap-2">
            {loading ? (
              <AnimatedStatusText label={t("ai.thinking")} />
            ) : (
              <span>{t("ai.reasoning")}</span>
            )}
          </span>
          <span className="flex items-center gap-1">
            {open ? t("ai.collapseReasoning") : t("ai.expandReasoning")}
            {open ? <MdExpandLess className="text-sm" /> : <MdExpandMore className="text-sm" />}
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t border-border/60 px-3 py-3">
          <MarkdownContent content={reasoningContent} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function AssistantResponse({ message, loading }: { message: AIMessage; loading: boolean }) {
  const { t } = useTranslation();

  if (loading && looksLikeStructuredJsonOutput(message.content)) {
    return (
      <div className="mt-3 overflow-hidden rounded-md border border-primary/20 bg-primary/6 shadow-sm">
        <div className="px-3 py-2.5 text-[0.6875rem]">
          <AnimatedStatusText label={t("ai.formattingResponse")} />
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent animate-pulse" />
      </div>
    );
  }

  return <MarkdownContent content={message.content} />;
}

function AICommandCardView({
  card,
  onInsert,
  onSave,
}: {
  card: AICommandCard;
  onInsert: (card: AICommandCard) => void;
  onSave: (card: AICommandCard) => void;
}) {
  const { t } = useTranslation();

  const copy = async () => {
    await navigator.clipboard.writeText(card.command);
    toast.success(t("ai.commandCopied"));
  };

  return (
    <div className="rounded-md border border-border/70 bg-background/65 p-3 text-xs">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{card.title}</div>
          <div
            className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium ${riskClassName[card.riskLevel]}`}
          >
            {card.riskLevel}
          </div>
        </div>
      </div>
      <pre className="mt-3 max-h-32 overflow-auto rounded-md border border-border/60 bg-muted/30 p-2 font-mono text-[0.6875rem] leading-5 terminal-scroll whitespace-pre-wrap break-all">
        {card.command}
      </pre>
      <div className="mt-3 space-y-1 leading-5 text-muted-foreground">
        <p>{card.explanation}</p>
        <p>{card.riskReason}</p>
        <p>{card.expectedEffect}</p>
        {card.rollback ? <p>{card.rollback}</p> : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Button size="xs" onClick={() => onInsert(card)}>
          <MdInput />
          {t("ai.insertTerminal")}
        </Button>
        <Button size="xs" variant="outline" onClick={() => void copy()}>
          <MdContentCopy />
          {t("ai.copy")}
        </Button>
        <Button size="xs" variant="outline" onClick={() => onSave(card)}>
          <MdSave />
          {t("ai.saveQuickCommand")}
        </Button>
      </div>
    </div>
  );
}

function AIAssistantPanel({ activePane, activeConnection, intent }: AIAssistantPanelProps) {
  const { t } = useTranslation();
  const { appSettings, tabs, savedConnections } = useApp();
  const aiSettings = appSettings.ai;
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [sessions, setSessions] = useState<AISession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [streamingAssistantId, setStreamingAssistantId] = useState<string | null>(null);
  const [detectedError, setDetectedError] = useState<AIErrorDetectedDetail | null>(null);
  const [targetPanes, setTargetPanes] = useState<SessionPane[]>([]);
  const [showMentionPopover, setShowMentionPopover] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const handledIntentIdRef = useRef<string | null>(null);
  const historyButtonRef = useRef<HTMLButtonElement | null>(null);
  const historyCardRef = useRef<HTMLDivElement | null>(null);
  const mentionPopoverRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const streamUnlistenRef = useRef<UnlistenFn | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const cancelledRef = useRef(false);

  const activeProfile = useMemo(
    () =>
      aiSettings.provider_profiles.find((profile) => profile.id === aiSettings.active_profile_id) ??
      aiSettings.provider_profiles.find((profile) => profile.enabled),
    [aiSettings.active_profile_id, aiSettings.provider_profiles],
  );

  const allSessionPanes = useMemo(() => {
    const panes: SessionPane[] = [];
    for (const tab of tabs) {
      for (const pane of collectSessionPanes(tab.root)) {
        if (!pane.connecting && !pane.connectError) {
          panes.push(pane);
        }
      }
    }
    return panes;
  }, [tabs]);

  const filteredMentionPanes = useMemo(() => {
    const q = mentionQuery.toLowerCase();
    if (!q) return allSessionPanes;
    return allSessionPanes.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sessionId.toLowerCase().includes(q) ||
        p.type.toLowerCase().includes(q),
    );
  }, [allSessionPanes, mentionQuery]);

  useEffect(() => {
    setMentionIndex(0);
  }, [filteredMentionPanes]);

  const effectivePanes = targetPanes.length > 0 ? targetPanes : activePane ? [activePane] : [];
  const effectiveSessionId = effectivePanes[0]?.sessionId ?? null;

  const activeSessionId = activePane?.sessionId ?? null;
  const filteredSessions = useMemo(() => {
    const keyword = historyQuery.trim().toLowerCase();
    if (!keyword) return sessions;

    return sessions.filter((session) =>
      [session.title, session.createdAt, session.updatedAt, session.id].some((value) =>
        value.toLowerCase().includes(keyword),
      ),
    );
  }, [historyQuery, sessions]);

  useEffect(() => {
    return () => {
      streamUnlistenRef.current?.();
    };
  }, []);

  useEffect(() => {
    const watchedIds = new Set(effectivePanes.map((p) => p.sessionId));
    if (activeSessionId) watchedIds.add(activeSessionId);
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<AIErrorDetectedDetail>).detail;
      if (!detail || !watchedIds.has(detail.sessionId)) return;
      setDetectedError(detail);
    };
    window.addEventListener(AI_ERROR_DETECTED_EVENT, handler);
    return () => window.removeEventListener(AI_ERROR_DETECTED_EVENT, handler);
  }, [activeSessionId, effectivePanes]);

  const handleMessagesScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    shouldAutoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }, []);

  useEffect(() => {
    if (!shouldAutoScrollRef.current) return;
    requestAnimationFrame(() => {
      const el = scrollContainerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [messages]);

  const loadSessions = useCallback(async () => {
    try {
      setSessions(await invoke<AISession[]>("get_ai_sessions"));
    } catch {
      setSessions([]);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const loadSessionMessages = useCallback(async (sessionId: string) => {
    try {
      const items = await invoke<AIMessage[]>("get_ai_messages", { sessionId });
      setCurrentSessionId(sessionId);
      setMessages(items);
      setShowHistory(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }, []);

  const appendAudit = useCallback(
    (params: {
      action: string;
      userInput?: string;
      generatedCommand?: string;
      riskLevel?: RiskLevel;
      insertedToTerminal?: boolean;
      blocked?: boolean;
    }) => {
      void invoke("append_ai_audit", {
        request: {
          connectionId: activeConnection?.id ?? null,
          action: params.action,
          userInput: params.userInput,
          generatedCommand: params.generatedCommand,
          riskLevel: params.riskLevel,
          insertedToTerminal: params.insertedToTerminal ?? false,
          executed: false,
          blocked: params.blocked ?? false,
        },
      }).catch(() => {});
    },
    [activeConnection?.id],
  );

  const buildMergedContext = useCallback(
    async (panes: SessionPane[], selectedText?: string): Promise<AIContext> => {
      if (panes.length === 0) {
        return buildAIContext({
          pane: null,
          connection: null,
          lineLimit: aiSettings.context_line_limit,
          selectedText,
        });
      }
      if (panes.length === 1) {
        const conn = panes[0].connectionId
          ? (savedConnections.find((c) => c.id === panes[0].connectionId) ?? null)
          : activeConnection;
        return buildAIContext({
          pane: panes[0],
          connection: conn,
          lineLimit: aiSettings.context_line_limit,
          selectedText,
        });
      }
      const contexts = await Promise.all(
        panes.map((p) => {
          const conn = p.connectionId
            ? (savedConnections.find((c) => c.id === p.connectionId) ?? null)
            : null;
          return buildAIContext({
            pane: p,
            connection: conn,
            lineLimit: Math.floor(aiSettings.context_line_limit / panes.length),
          });
        }),
      );
      const merged: AIContext = {
        connectionName: contexts.map((c) => c.connectionName ?? "-").join(", "),
        host: contexts.map((c) => c.host ?? "-").join(", "),
        port: contexts[0]?.port ?? null,
        username: contexts.map((c) => c.username ?? "-").join(", "),
        cwd: contexts.map((c) => c.cwd ?? "-").join(", "),
        os: contexts[0]?.os ?? null,
        arch: contexts[0]?.arch ?? null,
        recentOutput: contexts
          .map((c, i) => `[${panes[i].name}]\n${c.recentOutput}`)
          .filter((s) => s.trim().length > panes[0].name.length + 4)
          .join("\n---\n"),
        selectedText:
          selectedText ??
          contexts
            .map((c) => c.selectedText)
            .filter(Boolean)
            .join("\n"),
        inputBuffer: contexts
          .map((c) => c.inputBuffer)
          .filter(Boolean)
          .join("\n"),
      };
      return merged;
    },
    [activeConnection, aiSettings.context_line_limit, savedConnections],
  );

  const startChat = useCallback(
    async (action: AIAction, userInput: string, selectedText?: string) => {
      const panes = effectivePanes;
      if (panes.length === 0) {
        toast.error(t("panel.noActiveSessions"));
        return;
      }
      if (!aiSettings.enabled) {
        toast.error(t("ai.disabled"));
        return;
      }

      setDetectedError(null);
      setLoading(true);
      cancelledRef.current = false;
      streamUnlistenRef.current?.();
      streamUnlistenRef.current = null;

      const userMessage = createLocalMessage("user", userInput, currentSessionId ?? "local");
      const assistantId = `assistant-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setMessages((prev) => [
        ...prev,
        userMessage,
        {
          id: assistantId,
          sessionId: currentSessionId ?? "local",
          role: "assistant",
          content: "",
          createdAt: new Date().toISOString(),
          reasoningContent: null,
          commandCards: [],
        },
      ]);
      setStreamingAssistantId(assistantId);

      try {
        const context = await buildMergedContext(panes, selectedText);
        const primaryConn = panes[0].connectionId
          ? (savedConnections.find((c) => c.id === panes[0].connectionId) ?? null)
          : activeConnection;

        const result = await invoke<AIStreamStart>("start_ai_chat_stream", {
          request: {
            sessionId: currentSessionId,
            connectionId: primaryConn?.id ?? null,
            action,
            userInput,
            context,
            options: {
              maxOutputCommands: 5,
              language: "zh-CN",
              safetyMode: "strict",
            },
          },
        });
        setCurrentSessionId(result.sessionId);
        setStreamId(result.streamId);

        const unlisten = await listen<AIStreamEventPayload>(
          `ai-stream-${result.streamId}`,
          (event) => {
            const payload = event.payload;
            if (payload.type === "delta" && payload.textDelta) {
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantId
                    ? { ...message, content: `${message.content}${payload.textDelta}` }
                    : message,
                ),
              );
              return;
            }

            if (payload.type === "reasoning_delta" && payload.reasoningDelta) {
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantId
                    ? {
                        ...message,
                        reasoningContent: `${message.reasoningContent ?? ""}${payload.reasoningDelta}`,
                      }
                    : message,
                ),
              );
              return;
            }

            if (payload.type === "done") {
              setLoading(false);
              setStreamId(null);
              setStreamingAssistantId(null);
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantId && payload.message ? payload.message : message,
                ),
              );
              void loadSessions();
              return;
            }

            if (payload.type === "error") {
              const wasCancelled = cancelledRef.current;
              setLoading(false);
              setStreamId(null);
              setStreamingAssistantId(null);
              if (!wasCancelled) {
                setMessages((prev) =>
                  prev.map((message) =>
                    message.id === assistantId
                      ? {
                          ...message,
                          content: payload.error ?? t("ai.requestFailed"),
                        }
                      : message,
                  ),
                );
                toast.error(payload.error ?? t("ai.requestFailed"));
              }
            }
          },
        );
        streamUnlistenRef.current = unlisten;
        appendAudit({ action: `ai.${action}`, userInput });
      } catch (error) {
        setLoading(false);
        setStreamId(null);
        setStreamingAssistantId(null);
        if (!cancelledRef.current) {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId
                ? { ...message, content: getErrorMessage(error) }
                : message,
            ),
          );
          toast.error(getErrorMessage(error));
        }
      }
    },
    [
      activeConnection,
      aiSettings.enabled,
      appendAudit,
      buildMergedContext,
      currentSessionId,
      effectivePanes,
      loadSessions,
      savedConnections,
      t,
    ],
  );

  useEffect(() => {
    if (!intent || handledIntentIdRef.current === intent.id) return;
    handledIntentIdRef.current = intent.id;
    const fallbackText = actionTitle(intent.action);
    void startChat(intent.action, intent.userInput?.trim() || fallbackText, intent.selectedText);
  }, [intent, startChat]);

  const submit = useCallback(() => {
    const value = input.trim();
    if (!value || loading) return;
    setInput("");
    shouldAutoScrollRef.current = true;
    void startChat("generate_command", value);
  }, [input, loading, startChat]);

  const cancelStream = useCallback(() => {
    if (!streamId) return;
    cancelledRef.current = true;
    void invoke("cancel_ai_chat_stream", { streamId }).catch(() => {});
    setLoading(false);
    setStreamId(null);
    setStreamingAssistantId(null);
  }, [streamId]);

  const insertCommand = useCallback(
    (card: AICommandCard) => {
      const insertSessionId = effectiveSessionId ?? activeSessionId;
      const provider = getTerminalContextProvider(insertSessionId);
      if (!provider) {
        toast.error(t("ai.noTerminal"));
        return;
      }
      void provider
        .insertCommand(card.command)
        .then(() => {
          provider.focus();
          appendAudit({
            action: "ai.insert_command",
            generatedCommand: card.command,
            riskLevel: card.riskLevel,
            insertedToTerminal: true,
          });
        })
        .catch((error) => toast.error(getErrorMessage(error)));
    },
    [activeSessionId, appendAudit, effectiveSessionId, t],
  );

  const saveQuickCommand = useCallback(
    async (card: AICommandCard) => {
      if (!aiSettings.allow_save_command) {
        toast.error(t("ai.saveDisabled"));
        return;
      }

      try {
        const config = await invoke<QuickCommandsConfig>("get_quick_commands");
        const categoryName = card.category || t("ai.quickCommandCategory");
        const existingCategory = config.categories.find((item) => item.name === categoryName);
        const newCategory: QuickCommandCategory | undefined = existingCategory
          ? undefined
          : { id: slugCategory(categoryName), name: categoryName };
        const categoryId = existingCategory?.id ?? newCategory?.id;
        const command: QuickCommand = {
          id: `ai-${crypto.randomUUID()}`,
          label: card.title,
          command: card.command,
          category_id: categoryId,
          description: `${card.explanation}\n${card.riskReason}`,
          color_tag: mapRiskColor(card.riskLevel),
          icon_tag: "terminal",
          pinned: false,
          execution_mode: "append",
          source: "ai",
          risk_level: card.riskLevel,
        };
        await invoke("upsert_quick_command", { command, newCategory });
        await emit("quick-command-saved", { command, newCategory });
        appendAudit({
          action: "ai.save_quick_command",
          generatedCommand: card.command,
          riskLevel: card.riskLevel,
        });
        toast.success(t("ai.savedQuickCommand"));
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    },
    [aiSettings.allow_save_command, appendAudit, t],
  );

  const clearHistory = useCallback(async () => {
    await invoke("clear_ai_history");
    setMessages([]);
    setCurrentSessionId(null);
    setHistoryQuery("");
    await loadSessions();
  }, [loadSessions]);

  const newChat = useCallback(() => {
    if (loading) return;
    setMessages([]);
    setCurrentSessionId(null);
    setInput("");
    setDetectedError(null);
    setTargetPanes([]);
    setShowMentionPopover(false);
    shouldAutoScrollRef.current = true;
  }, [loading]);

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = event.target.value;
      setInput(value);

      const cursorPos = event.target.selectionStart;
      const textBeforeCursor = value.slice(0, cursorPos);
      const atMatch = textBeforeCursor.match(/@(\S*)$/);
      if (atMatch) {
        setMentionQuery(atMatch[1]);
        if (!showMentionPopover) setMentionIndex(0);
        setShowMentionPopover(true);
      } else {
        setShowMentionPopover(false);
        setMentionQuery("");
      }
    },
    [showMentionPopover],
  );

  const selectMentionPane = useCallback(
    (pane: SessionPane) => {
      setTargetPanes((prev) => {
        const exists = prev.some((p) => p.sessionId === pane.sessionId);
        return exists ? prev.filter((p) => p.sessionId !== pane.sessionId) : [...prev, pane];
      });

      const cursorPos = textareaRef.current?.selectionStart ?? input.length;
      const textBeforeCursor = input.slice(0, cursorPos);
      const textAfterCursor = input.slice(cursorPos);
      const cleaned = textBeforeCursor.replace(/@\S*$/, "");
      setInput(`${cleaned}${textAfterCursor}`);
      setShowMentionPopover(false);
      setMentionQuery("");
      textareaRef.current?.focus();
    },
    [input],
  );

  const removeTargetPane = useCallback((sessionId: string) => {
    setTargetPanes((prev) => prev.filter((p) => p.sessionId !== sessionId));
  }, []);

  return (
    <div
      className="relative flex h-full flex-col"
      style={{ backgroundColor: "var(--df-bg-panel)" }}
      onPointerDownCapture={(event) => {
        const target = event.target as Node;
        if (showHistory) {
          if (
            !historyCardRef.current?.contains(target) &&
            !historyButtonRef.current?.contains(target)
          ) {
            setShowHistory(false);
          }
        }
        if (showMentionPopover && !mentionPopoverRef.current?.contains(target)) {
          setShowMentionPopover(false);
        }
      }}
    >
      <PanelHeader
        title={t("ai.title")}
        meta={activeProfile?.name ?? t("ai.notConfigured")}
        actions={
          <>
            <Button
              ref={historyButtonRef}
              size="icon-sm"
              variant="ghost"
              onClick={() => setShowHistory((value) => !value)}
              title={t("ai.history")}
              aria-expanded={showHistory}
            >
              <MdHistory />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => openSettings("ai")}
              title={t("ai.settings")}
            >
              <MdOutlineSettings />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={newChat}
              disabled={loading}
              title={t("ai.newChat")}
            >
              <LuMessageSquarePlus />
            </Button>
          </>
        }
      />

      {showHistory ? (
        <div
          ref={historyCardRef}
          className="absolute left-2 right-2 top-10 z-30 flex flex-col overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg"
          style={{
            borderColor: "var(--df-border)",
            maxHeight: "min(22rem, calc(100% - 3rem))",
          }}
        >
          <div className="border-b border-border/70 p-2">
            <div className="relative">
              <MdSearch className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" />
              <Input
                value={historyQuery}
                placeholder={t("ai.historySearchPlaceholder")}
                className="h-8 pl-8 text-xs"
                autoFocus
                onChange={(event) => setHistoryQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setShowHistory(false);
                  }
                }}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-2 py-1.5">
            <span className="text-xs font-medium">{t("ai.history")}</span>
            <Button
              size="xs"
              variant="ghost"
              disabled={sessions.length === 0}
              onClick={() => void clearHistory()}
            >
              {t("common.delete")}
            </Button>
          </div>
          <div className="min-h-0 overflow-auto p-2 terminal-scroll">
            {filteredSessions.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">
                {sessions.length === 0 ? t("ai.noHistory") : t("ai.noHistoryMatches")}
              </div>
            ) : (
              filteredSessions.map((session) => (
                <button
                  key={session.id}
                  className="mb-1 block w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted/60"
                  onClick={() => void loadSessionMessages(session.id)}
                >
                  <div className="truncate font-medium">{session.title}</div>
                  <div className="truncate text-[0.6875rem] text-muted-foreground">
                    {session.updatedAt}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}

      {detectedError ? (
        <div className="border-b border-border/70 bg-amber-500/10 p-3 text-xs">
          <div className="font-medium text-amber-600">{t("ai.errorDetected")}</div>
          <div className="mt-2 flex gap-1.5">
            <Button
              size="xs"
              onClick={() => void startChat("analyze_error", t("ai.analyzeDetectedError"))}
            >
              {t("ai.analyze")}
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setDetectedError(null)}>
              {t("common.close")}
            </Button>
          </div>
        </div>
      ) : null}

      <div
        ref={scrollContainerRef}
        onScroll={handleMessagesScroll}
        className="flex-1 overflow-auto p-3 terminal-scroll"
      >
        {messages.length === 0 ? (
          <div className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
            <MdAutoAwesome className="text-3xl" />
            <div>{t("ai.empty")}</div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-md border p-3 text-xs leading-5 ${
                  message.role === "user"
                    ? "border-primary/25 bg-primary/10"
                    : "border-border/70 bg-muted/20"
                }`}
              >
                <div className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {message.role === "user" ? "User" : "AI"}
                </div>
                {message.role === "assistant" ? (
                  <AssistantReasoning
                    message={message}
                    loading={loading && streamingAssistantId === message.id}
                  />
                ) : null}
                {message.role === "assistant" ? (
                  <AssistantResponse
                    message={message}
                    loading={loading && streamingAssistantId === message.id}
                  />
                ) : (
                  <div className="whitespace-pre-wrap break-words">{message.content}</div>
                )}
                {message.commandCards?.length ? (
                  <div className="mt-3 space-y-2">
                    {message.commandCards.map((card) => (
                      <AICommandCardView
                        key={card.id}
                        card={card}
                        onInsert={insertCommand}
                        onSave={(item) => void saveQuickCommand(item)}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border/70 p-2">
        {targetPanes.length > 0 ? (
          <div className="mb-1.5 flex flex-wrap items-center gap-1">
            <span className="text-[0.625rem] font-medium text-muted-foreground">
              {t("ai.targetSession")}:
            </span>
            {targetPanes.map((p) => (
              <span
                key={p.sessionId}
                className="inline-flex items-center gap-0.5 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[0.625rem] font-medium text-primary"
              >
                {p.name}
                <button
                  type="button"
                  className="ml-0.5 rounded-full p-0 hover:text-destructive"
                  onClick={() => removeTargetPane(p.sessionId)}
                >
                  <MdClose className="text-[0.625rem]" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <div className="relative">
          {showMentionPopover ? (
            <div
              ref={mentionPopoverRef}
              className="absolute bottom-full left-0 right-0 z-30 mb-1 flex max-h-48 flex-col overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg"
              style={{ borderColor: "var(--df-border)" }}
            >
              <div className="min-h-0 overflow-auto p-1 terminal-scroll">
                {filteredMentionPanes.length === 0 ? (
                  <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                    {t("ai.noSessions")}
                  </div>
                ) : (
                  filteredMentionPanes.map((pane, idx) => {
                    const isSelected = targetPanes.some((p) => p.sessionId === pane.sessionId);
                    const isFocused = idx === mentionIndex;
                    return (
                      <button
                        key={pane.sessionId}
                        ref={(el) => {
                          if (isFocused && el) el.scrollIntoView({ block: "nearest" });
                        }}
                        type="button"
                        className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted/60 ${isFocused ? "bg-accent" : ""} ${isSelected ? "bg-primary/10" : ""}`}
                        onClick={() => selectMentionPane(pane)}
                        onPointerEnter={() => setMentionIndex(idx)}
                      >
                        <span
                          className={`size-2 shrink-0 rounded-full ${isSelected ? "bg-primary" : "bg-muted-foreground/40"}`}
                        />
                        <span className="min-w-0 truncate font-medium">{pane.name}</span>
                        <span className="ml-auto shrink-0 text-[0.625rem] text-muted-foreground">
                          {pane.type}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              disabled={loading}
              placeholder={t("ai.placeholder")}
              className="max-h-32 min-h-16 resize-none overflow-y-auto text-xs terminal-scroll"
              onChange={handleInputChange}
              onKeyDown={(event) => {
                if (showMentionPopover) {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setShowMentionPopover(false);
                    return;
                  }
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setMentionIndex((i) =>
                      filteredMentionPanes.length === 0 ? 0 : (i + 1) % filteredMentionPanes.length,
                    );
                    return;
                  }
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setMentionIndex((i) =>
                      filteredMentionPanes.length === 0
                        ? 0
                        : (i - 1 + filteredMentionPanes.length) % filteredMentionPanes.length,
                    );
                    return;
                  }
                  if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    const target = filteredMentionPanes[mentionIndex];
                    if (target) selectMentionPane(target);
                    else setShowMentionPopover(false);
                    return;
                  }
                }
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  submit();
                }
              }}
            />
            {loading ? (
              <Button size="icon-sm" variant="outline" onClick={cancelStream}>
                <MdStop />
              </Button>
            ) : (
              <Button size="icon-sm" onClick={submit} disabled={!input.trim()}>
                <MdSend />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(AIAssistantPanel);
