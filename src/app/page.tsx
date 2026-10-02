"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Code2,
  GraduationCap,
  Lightbulb,
  PanelLeft,
  PenLine,
  SquarePen,
} from "lucide-react";
import { Sidebar } from "@/components/chat/sidebar";
import { Message } from "@/components/chat/message";
import { ChatInput } from "@/components/chat/chat-input";
import { useChatStore, type Attachment, type ChatMessage } from "@/lib/chat-store";
import { useChatStream } from "@/hooks/use-chat-stream";
import { buildAIPromptText } from "@/lib/files";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  {
    icon: PenLine,
    title: "Viết một email cảm ơn",
    prompt: "Hãy giúp tôi viết một email cảm ơn khách hàng sau cuộc họp.",
  },
  {
    icon: Code2,
    title: "Giải thích code",
    prompt:
      "Giải thích cho tôi hàm `useEffect` trong React hoạt động như thế nào, kèm ví dụ.",
  },
  {
    icon: Lightbulb,
    title: "Ý tưởng kinh doanh",
    prompt: "Gợi ý 5 ý tưởng kinh doanh nhỏ cho sinh viên với vốn dưới 5 triệu.",
  },
  {
    icon: GraduationCap,
    title: "Học từ mới",
    prompt: "Dạy tôi 10 từ vựng tiếng Anh thông dụng về công nghệ kèm ví dụ.",
  },
];

function toAIMessages(msgs: ChatMessage[]) {
  return msgs.map((m) => ({
    role: m.role,
    content:
      m.role === "user" && m.attachments && m.attachments.length > 0
        ? buildAIPromptText(m.content, m.attachments)
        : m.content,
  }));
}

export default function Home() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeId = useChatStore((s) => s.activeId);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const sidebarCollapsed = useChatStore((s) => s.sidebarCollapsed);
  const deepThink = useChatStore((s) => s.deepThink);
  const webSearch = useChatStore((s) => s.webSearch);
  const addUserMessage = useChatStore((s) => s.addUserMessage);
  const newConversation = useChatStore((s) => s.newConversation);
  const prepareRegenerate = useChatStore((s) => s.prepareRegenerate);
  const setSidebarCollapsed = useChatStore((s) => s.setSidebarCollapsed);

  const { stream, stop } = useChatStream();

  const active = useChatStore((s) =>
    s.activeId ? s.conversations.find((c) => c.id === s.activeId) ?? null : null,
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const autoScroll = useRef(true);

  // Rehydrate the persisted store once on the client. skipHydration is set
  // in the store so the first client render matches SSR (empty), avoiding
  // hydration mismatches.
  useEffect(() => {
    void useChatStore.persist.rehydrate();
  }, []);

  // Track whether the user is near the bottom; if so, auto-scroll while streaming
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      autoScroll.current = dist < 120;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll to bottom when conversation / message count changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    autoScroll.current = true;
  }, [active?.messages.length, activeId]);

  // Auto-scroll while content is streaming in
  useEffect(() => {
    if (!active) return;
    const last = active.messages[active.messages.length - 1];
    if (!last || last.role !== "assistant") return;
    if (autoScroll.current) {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [active?.messages]);

  const send = async (text: string, attachments: Attachment[] = []) => {
    if (isStreaming) return;
    const assistantId = addUserMessage(text, attachments);
    if (!assistantId) return;
    const conv = useChatStore
      .getState()
      .conversations.find((c) => c.id === useChatStore.getState().activeId);
    if (!conv) return;
    const toSend = toAIMessages(
      conv.messages.filter((m) => m.id !== assistantId),
    );
    await stream({
      messages: toSend,
      assistantMessageId: assistantId,
      deepThink,
      webSearch,
    });
  };

  const regenerate = async () => {
    if (isStreaming) return;
    const { assistantId, messages } = prepareRegenerate();
    if (!assistantId) return;
    await stream({
      messages: toAIMessages(messages),
      assistantMessageId: assistantId,
      deepThink,
      webSearch,
    });
  };

  const messages = active?.messages ?? [];
  const showEmpty = messages.length === 0;
  // Lời chào tĩnh để tránh hydration mismatch (không phụ thuộc thời gian).
  const greeting = "Xin chào! 👋";

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background text-foreground">
      {/* Desktop sidebar (collapsible, DeepSeek-style) */}
      <aside
        className={cn(
          "hidden shrink-0 overflow-hidden border-r border-sidebar-border bg-sidebar transition-[width] duration-300 ease-in-out md:block",
          sidebarCollapsed ? "w-[60px]" : "w-[280px]",
        )}
      >
        <div className="h-full w-[280px]">
          <Sidebar
            collapsed={sidebarCollapsed}
            onCollapse={() => setSidebarCollapsed(true)}
            onExpand={() => setSidebarCollapsed(false)}
          />
        </div>
      </aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 left-0 z-50 w-[280px] border-r border-border md:hidden"
            >
              <Sidebar onClose={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border/60 bg-background/70 px-3 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
          {/* Sidebar toggle (mobile drawer / desktop collapse) */}
          <button
            onClick={() => {
              if (window.matchMedia("(max-width: 767px)").matches) {
                setMobileOpen(true);
              } else {
                setSidebarCollapsed(!sidebarCollapsed);
              }
            }}
            className="rounded-lg p-2 transition hover:bg-muted"
            aria-label="Toggle sidebar"
          >
            <PanelLeft className="h-5 w-5" />
          </button>

          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold">
              {showEmpty ? greeting : (active?.title ?? "AI Chat")}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-border bg-card/60 px-2.5 py-1 text-xs text-muted-foreground sm:flex">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
              </span>
              Z.ai Model
            </span>
            <button
              onClick={() => newConversation()}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:border-brand/40 hover:bg-brand/10 hover:text-brand"
              aria-label="Chat mới"
              title="Chat mới"
            >
              <SquarePen className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="chat-canvas relative flex-1 overflow-y-auto">
          {showEmpty ? (
            <div className="relative flex h-full flex-col items-center justify-center px-4 py-8">
              {/* glow backdrop màu brand */}
              <div
                className="pointer-events-none absolute left-1/2 top-[38%] h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 blur-3xl"
                style={{
                  background:
                    "radial-gradient(circle, color-mix(in oklab, var(--brand) 42%, transparent), transparent 70%)",
                }}
              />
              {/* Logo với pulse ring */}
              <div className="relative mb-7">
                <div
                  className="absolute inset-0 animate-ping rounded-3xl bg-brand/30"
                  style={{ animationDuration: "2.5s" }}
                  aria-hidden="true"
                />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-brand to-brand/80 text-brand-foreground shadow-xl shadow-brand/30 ring-1 ring-brand/50">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-8 w-8"
                    fill="currentColor"
                  >
                    <path d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2Zm3.06 5.94a.75.75 0 0 0-1.06 0L12 9.94l-2-2a.75.75 0 1 0-1.06 1.06l2 2-2 2a.75.75 0 1 0 1.06 1.06l2-2 2 2a.75.75 0 0 0 1.06-1.06l-2-2 2-2a.75.75 0 0 0 0-1.06Z" />
                  </svg>
                </div>
              </div>
              <h1 className="text-gradient relative text-center text-3xl font-semibold tracking-tight md:text-4xl">
                Tôi có thể giúp gì cho bạn?
              </h1>
              <p className="relative mt-3 text-center text-sm text-muted-foreground md:text-base">
                Hỏi bất cứ điều gì, hoặc tải file lên để AI đọc giúp bạn.
              </p>

              <div className="relative mt-9 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
                {SUGGESTIONS.map((s, i) => (
                  <motion.button
                    key={s.title}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * i, duration: 0.3 }}
                    onClick={() => !isStreaming && send(s.prompt)}
                    className="group flex flex-col gap-1.5 rounded-2xl border border-border bg-card/50 p-4 text-left backdrop-blur-sm transition hover:-translate-y-1 hover:border-brand/40 hover:bg-card hover:shadow-xl hover:shadow-brand/10"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-muted-foreground transition group-hover:bg-brand/15 group-hover:text-brand">
                        <s.icon className="h-4 w-4" />
                      </span>
                      {s.title}
                    </span>
                    <span className="line-clamp-2 pl-10 text-xs text-muted-foreground">
                      {s.prompt}
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            <div className="pb-6">
              {messages.map((m, idx) => {
                const isLast = idx === messages.length - 1;
                const isStreamingThis =
                  isLast && m.role === "assistant" && isStreaming;
                return (
                  <Message
                    key={m.id}
                    message={m}
                    isStreaming={isStreamingThis}
                    onRegenerate={
                      isLast && m.role === "assistant" && !isStreaming
                        ? regenerate
                        : undefined
                    }
                  />
                );
              })}
            </div>
          )}
          <div ref={bottomRef} className="h-px w-full" />
        </div>

        {/* Input */}
        <div className="shrink-0 bg-background px-2 pb-3 pt-2 md:px-4 md:pb-4">
          <ChatInput
            onSend={send}
            onStop={stop}
            isStreaming={isStreaming}
          />
        </div>
      </div>
    </div>
  );
}
