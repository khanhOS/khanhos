"use client";

import { useCallback, useRef } from "react";
import { useChatStore } from "@/lib/chat-store";

interface StreamOptions {
  messages: { role: "user" | "assistant"; content: string }[];
  assistantMessageId: string;
  deepThink?: boolean;
  webSearch?: boolean;
  signal?: AbortSignal;
}

const API = process.env.NEXT_PUBLIC_API_URL || "";

export function useChatStream() {
  const appendAssistantChunk = useChatStore((s) => s.appendAssistantChunk);
  const finalizeAssistant = useChatStore((s) => s.finalizeAssistant);
  const setStreaming = useChatStore((s) => s.setStreaming);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }, [setStreaming]);

  const stream = useCallback(
    async ({ messages, assistantMessageId, signal }: StreamOptions) => {
      const controller = new AbortController();
      abortRef.current = controller;
      if (signal) signal.addEventListener("abort", () => controller.abort());

      try {
        if (!API) {
          appendAssistantChunk(
            assistantMessageId,
            "\u26a0\ufe0f Ch\u01b0a c\u1ea5u h\u00ecnh NEXT_PUBLIC_API_URL",
          );
          finalizeAssistant(assistantMessageId);
          return;
        }

        // L\u1ea5y prompt cu\u1ed1i c\u00f9ng c\u1ee7a user
        const lastUser = [...messages].reverse().find((m) => m.role === "user");
        const prompt = lastUser?.content || "";

        const res = await fetch(`${API}/code`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            max_new_tokens: 1024,
            temperature: 0.2,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          appendAssistantChunk(
            assistantMessageId,
            `\u26a0\ufe0f Backend l\u1ed7i ${res.status}`,
          );
          finalizeAssistant(assistantMessageId);
          return;
        }

        const data = await res.json();
        const text: string = data.text || "";

        // Gi\u1ea3 streaming: chia text th\u00e0nh t\u1eebng chunk nh\u1ecf
        const chunkSize = 4;
        for (let i = 0; i < text.length; i += chunkSize) {
          if (controller.signal.aborted) break;
          appendAssistantChunk(assistantMessageId, text.slice(i, i + chunkSize));
          await new Promise((r) => setTimeout(r, 12));
        }

        finalizeAssistant(assistantMessageId);
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          appendAssistantChunk(
            assistantMessageId,
            `\u26a0\ufe0f ${e?.message || "L\u1ed7i kh\u00f4ng x\u00e1c \u0111\u1ecbnh"}`,
          );
        }
        finalizeAssistant(assistantMessageId);
      } finally {
        abortRef.current = null;
        setStreaming(false);
      }
    },
    [appendAssistantChunk, finalizeAssistant, setStreaming],
  );

  return { stream, stop };
}
