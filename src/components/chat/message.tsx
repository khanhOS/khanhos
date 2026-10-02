"use client";

import { memo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  Copy,
  Pencil,
  RefreshCw,
  Share2,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  Square,
  Brain,
} from "lucide-react";
import { Markdown } from "@/components/chat/markdown";
import { AttachmentList } from "@/components/chat/attachments";
import { cn } from "@/lib/utils";
import { useChatStore, type ChatMessage } from "@/lib/chat-store";

interface MessageProps {
  message: ChatMessage;
  isStreaming: boolean;
  onRegenerate?: () => void;
}

function UserAvatar() {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center self-end rounded-lg border border-border bg-muted text-muted-foreground">
      <span className="text-xs font-semibold">Bạn</span>
    </div>
  );
}

function ZAvatar() {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground shadow-sm shadow-brand/20 ring-1 ring-brand/30">
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2Zm3.06 5.94a.75.75 0 0 0-1.06 0L12 9.94l-2-2a.75.75 0 1 0-1.06 1.06l2 2-2 2a.75.75 0 1 0 1.06 1.06l2-2 2 2a.75.75 0 0 0 1.06-1.06l-2-2 2-2a.75.75 0 0 0 0-1.06Z" />
      </svg>
    </div>
  );
}

function formatDuration(ms: number) {
  const s = ms / 1000;
  if (s < 1) return `${Math.round(s * 10) / 10}s`;
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m ${rem}s`;
}

function ActionButton({
  icon,
  label,
  onClick,
  active,
  activeClass,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
  activeClass?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground",
        active && (activeClass || "text-brand"),
      )}
    >
      {icon}
    </button>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <ActionButton
      icon={
        copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />
      }
      label={copied ? "Đã sao chép" : "Sao chép"}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          toast.success("Đã sao chép vào clipboard");
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Không sao chép được");
        }
      }}
      active={copied}
    />
  );
}

function TTSButton({ text }: { text: string }) {
  const [speaking, setSpeaking] = useState(false);
  return (
    <ActionButton
      icon={
        speaking ? (
          <Square className="h-4 w-4" />
        ) : (
          <Volume2 className="h-4 w-4" />
        )
      }
      label={speaking ? "Dừng đọc" : "Đọc thành tiếng"}
      active={speaking}
      activeClass="text-brand"
      onClick={() => {
        if (typeof window === "undefined" || !("speechSynthesis" in window))
          return;
        if (speaking) {
          window.speechSynthesis.cancel();
          setSpeaking(false);
          return;
        }
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "vi-VN";
        u.onend = () => setSpeaking(false);
        u.onerror = () => setSpeaking(false);
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
        setSpeaking(true);
        toast.info("Đang đọc thành tiếng…");
      }}
    />
  );
}

function ShareButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <ActionButton
      icon={
        done ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />
      }
      label="Chia sẻ"
      active={done}
      onClick={async () => {
        const shareData = { text };
        try {
          if (typeof navigator !== "undefined" && navigator.share) {
            await navigator.share(shareData);
          } else {
            await navigator.clipboard.writeText(text);
            setDone(true);
            toast.success("Đã sao chép để chia sẻ");
            setTimeout(() => setDone(false), 1500);
          }
        } catch {
          /* user cancelled */
        }
      }}
    />
  );
}

function FeedbackButtons({ messageId }: { messageId: string }) {
  const feedback = useChatStore((s) => {
    const conv = s.conversations.find((c) => c.id === s.activeId);
    return conv?.messages.find((m) => m.id === messageId)?.feedback ?? null;
  });
  const setMessageFeedback = useChatStore((s) => s.setMessageFeedback);
  return (
    <>
      <ActionButton
        icon={<ThumbsUp className="h-4 w-4" />}
        label="Hữu ích"
        active={feedback === "up"}
        activeClass="text-brand"
        onClick={() => {
          setMessageFeedback(messageId, "up");
          if (feedback !== "up") toast.success("Cảm ơn phản hồi của bạn!");
        }}
      />
      <ActionButton
        icon={<ThumbsDown className="h-4 w-4" />}
        label="Không hữu ích"
        active={feedback === "down"}
        activeClass="text-destructive"
        onClick={() => {
          setMessageFeedback(messageId, "down");
          if (feedback !== "down") toast.success("Đã ghi nhận phản hồi");
        }}
      />
    </>
  );
}

function ReasoningBox({
  reasoning,
  timeMs,
  isStreaming,
}: {
  reasoning: string;
  timeMs?: number;
  isStreaming: boolean;
}) {
  const [open, setOpen] = useState(true);
  if (!reasoning) return null;
  return (
    <div className="mb-3 rounded-xl border border-border bg-muted/40">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-muted-foreground transition hover:text-foreground"
      >
        <Brain className="h-3.5 w-3.5 text-brand" />
        <span className="font-medium">
          {isStreaming
            ? "Đang suy nghĩ…"
            : `Đã suy nghĩ trong ${timeMs ? formatDuration(timeMs) : "1 giây"}`}
        </span>
        <ChevronDown
          className={cn(
            "ml-auto h-3.5 w-3.5 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="border-t border-border px-3 py-2.5 text-[13px] leading-6 text-muted-foreground">
          <Markdown content={reasoning} />
        </div>
      )}
    </div>
  );
}

function MessageImpl({ message, isStreaming, onRegenerate }: MessageProps) {
  const isUser = message.role === "user";
  const isAssistant = !isUser;
  const showThinkingDots =
    isAssistant &&
    isStreaming &&
    message.content === "" &&
    !message.reasoning;

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="group/msg w-full px-3 py-4 md:px-4"
      >
        <div className="mx-auto flex max-w-3xl flex-col items-end gap-1.5">
          <div className="flex items-start justify-end gap-3">
            <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-brand px-4 py-2.5 text-[15px] leading-7 text-brand-foreground shadow-md shadow-brand/20">
              {message.attachments && message.attachments.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  <AttachmentList attachments={message.attachments} compact />
                </div>
              )}
              {message.content && (
                <div className="whitespace-pre-wrap break-words">
                  {message.content}
                </div>
              )}
            </div>
            <UserAvatar />
          </div>
          <div className="flex items-center gap-0.5 pr-10 opacity-0 transition group-hover/msg:opacity-100">
            <ActionButton
              icon={<Copy className="h-3.5 w-3.5" />}
              label="Sao chép"
              onClick={() => {
                navigator.clipboard?.writeText(message.content);
                toast.success("Đã sao chép");
              }}
            />
            <ActionButton
              icon={<Pencil className="h-3.5 w-3.5" />}
              label="Chỉnh sửa"
            />
          </div>
        </div>
      </motion.div>
    );
  }

  // Assistant
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="group/msg w-full px-3 py-4 md:px-4"
    >
      <div className="mx-auto flex max-w-3xl gap-3 md:gap-4">
        <ZAvatar />
        <div className="min-w-0 flex-1">
          {message.reasoning && (
            <ReasoningBox
              reasoning={message.reasoning}
              timeMs={message.reasoningTimeMs}
              isStreaming={isStreaming && !message.content}
            />
          )}

          {showThinkingDots ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-brand [animation-delay:-0.3s] [animation-duration:0.8s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-brand [animation-delay:-0.15s] [animation-duration:0.8s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-brand [animation-duration:0.8s]" />
              </span>
              <span className="text-sm">Đang suy nghĩ…</span>
            </div>
          ) : (
            <>
              <Markdown content={message.content} />
              {isStreaming && message.content && (
                <span className="ml-0.5 inline-block h-4 w-2 translate-y-0.5 animate-pulse rounded-full bg-brand align-middle" />
              )}
            </>
          )}

          {isAssistant && !isStreaming && message.content && (
            <div className="mt-2 flex items-center gap-0.5 opacity-0 transition group-hover/msg:opacity-100">
              <CopyButton text={message.content} />
              {onRegenerate && (
                <ActionButton
                  icon={<RefreshCw className="h-4 w-4" />}
                  label="Tạo lại"
                  onClick={() => {
                    onRegenerate();
                    toast.info("Đang tạo lại câu trả lời…");
                  }}
                />
              )}
              <FeedbackButtons messageId={message.id} />
              <TTSButton text={message.content} />
              <ShareButton text={message.content} />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export const Message = memo(MessageImpl);
