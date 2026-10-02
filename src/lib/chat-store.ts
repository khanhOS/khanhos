"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  // Nội dung text cho file dạng text (đã truncate nếu quá lớn)
  textContent?: string;
  // Data URL cho ảnh (chỉ giữ trong session, không persist)
  dataUrl?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
  // DeepThink: phần suy nghĩ (reasoning) của AI
  reasoning?: string;
  reasoningTimeMs?: number;
  // feedback người dùng (👍 / 👎)
  feedback?: "up" | "down" | null;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

interface ChatState {
  conversations: Conversation[];
  activeId: string | null;
  isStreaming: boolean;
  sidebarCollapsed: boolean;
  deepThink: boolean;
  webSearch: boolean;

  // selectors / helpers
  getActive: () => Conversation | null;

  // actions
  newConversation: () => string;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  clearAll: () => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  toggleDeepThink: () => void;
  toggleWebSearch: () => void;

  // message mutations
  addUserMessage: (
    content: string,
    attachments?: Attachment[],
  ) => string | null;
  appendAssistantChunk: (messageId: string, chunk: string) => void;
  appendReasoningChunk: (messageId: string, chunk: string) => void;
  setAssistantContent: (messageId: string, content: string) => void;
  setReasoning: (messageId: string, reasoning: string) => void;
  setReasoningTime: (messageId: string, ms: number) => void;
  finalizeAssistant: (messageId: string) => void;
  setStreaming: (v: boolean) => void;
  editLastUserMessage: (content: string) => void;
  setMessageFeedback: (messageId: string, fb: "up" | "down" | null) => void;
  // Clear the last assistant message and return its id + the messages to resend
  prepareRegenerate: () => { assistantId: string | null; messages: ChatMessage[] };
}

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function makeTitle(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "New chat";
  return clean.length > 40 ? clean.slice(0, 40) + "..." : clean;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeId: null,
      isStreaming: false,
      sidebarCollapsed: true,
      deepThink: false,
      webSearch: false,

      getActive: () => {
        const { conversations, activeId } = get();
        if (!activeId) return null;
        return conversations.find((c) => c.id === activeId) || null;
      },

      newConversation: () => {
        const id = uid();
        const now = Date.now();
        const conv: Conversation = {
          id,
          title: "New chat",
          messages: [],
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({
          conversations: [conv, ...s.conversations],
          activeId: id,
        }));
        return id;
      },

      selectConversation: (id) => set({ activeId: id }),

      deleteConversation: (id) =>
        set((s) => {
          const conversations = s.conversations.filter((c) => c.id !== id);
          const activeId =
            s.activeId === id
              ? conversations[0]?.id ?? null
              : s.activeId;
          return { conversations, activeId };
        }),

      renameConversation: (id, title) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, title: title || "New chat" } : c,
          ),
        })),

      clearAll: () => set({ conversations: [], activeId: null }),

      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      toggleDeepThink: () => set((s) => ({ deepThink: !s.deepThink })),
      toggleWebSearch: () => set((s) => ({ webSearch: !s.webSearch })),

      addUserMessage: (content, attachments) => {
        const state = get();
        let activeId = state.activeId;
        const now = Date.now();
        const userMsg: ChatMessage = {
          id: uid(),
          role: "user",
          content,
          attachments: attachments && attachments.length > 0 ? attachments : undefined,
        };
        const assistantMsg: ChatMessage = {
          id: uid(),
          role: "assistant",
          content: "",
        };

        if (!activeId) {
          activeId = uid();
          const conv: Conversation = {
            id: activeId,
            title: makeTitle(content || attachments?.[0]?.name || "New chat"),
            messages: [userMsg, assistantMsg],
            createdAt: now,
            updatedAt: now,
          };
          set((s) => ({
            conversations: [conv, ...s.conversations],
            activeId,
            isStreaming: true,
          }));
          return assistantMsg.id;
        }

        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === activeId
              ? {
                  ...c,
                  title:
                    c.messages.length === 0
                      ? makeTitle(content || attachments?.[0]?.name || "New chat")
                      : c.title,
                  messages: [...c.messages, userMsg, assistantMsg],
                  updatedAt: now,
                }
              : c,
          ),
          isStreaming: true,
        }));
        return assistantMsg.id;
      },

      appendAssistantChunk: (messageId, chunk) =>
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== s.activeId) return c;
            return {
              ...c,
              updatedAt: Date.now(),
              messages: c.messages.map((m) =>
                m.id === messageId
                  ? { ...m, content: m.content + chunk }
                  : m,
              ),
            };
          }),
        })),

      appendReasoningChunk: (messageId, chunk) =>
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== s.activeId) return c;
            return {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId
                  ? { ...m, reasoning: (m.reasoning || "") + chunk }
                  : m,
              ),
            };
          }),
        })),

      setAssistantContent: (messageId, content) =>
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== s.activeId) return c;
            return {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId ? { ...m, content } : m,
              ),
            };
          }),
        })),

      setReasoning: (messageId, reasoning) =>
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== s.activeId) return c;
            return {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId ? { ...m, reasoning } : m,
              ),
            };
          }),
        })),

      setReasoningTime: (messageId, ms) =>
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== s.activeId) return c;
            return {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId ? { ...m, reasoningTimeMs: ms } : m,
              ),
            };
          }),
        })),

      setMessageFeedback: (messageId, fb) =>
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== s.activeId) return c;
            return {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId
                  ? { ...m, feedback: m.feedback === fb ? null : fb }
                  : m,
              ),
            };
          }),
        })),

      finalizeAssistant: (messageId) =>
        set((s) => ({
          isStreaming: false,
          conversations: s.conversations.map((c) => {
            if (c.id !== s.activeId) return c;
            return {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId
                  ? { ...m, content: m.content || "" }
                  : m,
              ),
            };
          }),
        })),

      setStreaming: (v) => set({ isStreaming: v }),

      editLastUserMessage: (content) => {
        const state = get();
        const active = state.getActive();
        if (!active) return;
        const now = Date.now();
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== active.id) return c;
            const msgs = [...c.messages];
            // find last user message
            for (let i = msgs.length - 1; i >= 0; i--) {
              if (msgs[i].role === "user") {
                msgs[i] = { ...msgs[i], content };
                break;
              }
            }
            return { ...c, messages: msgs, updatedAt: now };
          }),
        }));
      },

      prepareRegenerate: () => {
        const state = get();
        const active = state.getActive();
        if (!active) return { assistantId: null, messages: [] };
        const msgs = active.messages;
        // find last assistant message
        let lastAssistantIdx = -1;
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].role === "assistant") {
            lastAssistantIdx = i;
            break;
          }
        }
        if (lastAssistantIdx === -1)
          return { assistantId: null, messages: [] };
        const assistantId = msgs[lastAssistantIdx].id;
        // messages to resend = everything up to (not including) the assistant msg
        const toResend = msgs.slice(0, lastAssistantIdx);
        // clear the assistant message content
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === active.id
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantId ? { ...m, content: "" } : m,
                  ),
                  updatedAt: Date.now(),
                }
              : c,
          ),
          isStreaming: true,
        }));
        return { assistantId, messages: toResend };
      },
    }),
    {
      name: "ai-chat-store",
      version: 3,
      skipHydration: true,
      partialize: (s) => ({
        conversations: s.conversations.map((c) => ({
          ...c,
          // strip image dataUrls to keep localStorage small; keep metadata + text
          messages: c.messages.map((m) =>
            m.attachments
              ? {
                  ...m,
                  attachments: m.attachments.map((a) => ({
                    id: a.id,
                    name: a.name,
                    size: a.size,
                    type: a.type,
                    textContent: a.textContent,
                  })),
                }
              : m,
          ),
        })),
        activeId: s.activeId,
        sidebarCollapsed: s.sidebarCollapsed,
        deepThink: s.deepThink,
        webSearch: s.webSearch,
      }),
      migrate: (persisted: any, version: number) => {
        const next = { ...persisted };
        if (version < 2) next.sidebarCollapsed = false;
        if (version < 3) {
          next.deepThink = false;
          next.webSearch = false;
        }
        return next;
      },
    },
  ),
);
