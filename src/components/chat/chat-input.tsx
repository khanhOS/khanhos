"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Loader2,
  Paperclip,
  Plus,
  Search,
  Sparkles,
  Square,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AttachmentList } from "@/components/chat/attachments";
import { fileToAttachment } from "@/lib/files";
import { useChatStore } from "@/lib/chat-store";
import type { Attachment } from "@/lib/chat-store";

interface ChatInputProps {
  onSend: (text: string, attachments: Attachment[]) => void;
  onStop: () => void;
  isStreaming: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  onStop,
  isStreaming,
  placeholder = "Nhắn tin cho AI…",
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const deepThink = useChatStore((s) => s.deepThink);
  const webSearch = useChatStore((s) => s.webSearch);
  const toggleDeepThink = useChatStore((s) => s.toggleDeepThink);
  const toggleWebSearch = useChatStore((s) => s.toggleWebSearch);

  // auto-resize
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    const next = Math.min(el.scrollHeight, 200);
    el.style.height = `${next}px`;
  }, [value]);

  const canSend = value.trim().length > 0 || attachments.length > 0;

  const submit = () => {
    if (!canSend || isStreaming) return;
    onSend(value.trim(), attachments);
    setValue("");
    setAttachments([]);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) el.style.height = "auto";
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setPopoverOpen(false);
    try {
      const newOnes = await Promise.all(
        Array.from(files).map((f) => fileToAttachment(f)),
      );
      setAttachments((prev) => [...prev, ...newOnes]);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (id: string) =>
    setAttachments((prev) => prev.filter((a) => a.id !== id));

  return (
    <div className="mx-auto w-full max-w-3xl px-3 md:px-4">
      {/* Attachments preview row */}
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2 rounded-2xl border border-border bg-card p-2">
          <AttachmentList
            attachments={attachments}
            onRemove={removeAttachment}
          />
        </div>
      )}

      <div className="relative flex flex-col rounded-[1.5rem] border border-border bg-card px-2.5 py-2 shadow-lg shadow-black/5 transition focus-within:border-brand/40 focus-within:ring-2 focus-within:ring-brand/15">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder={placeholder}
          className="max-h-[200px] min-h-[24px] w-full resize-none bg-transparent px-1 py-1.5 text-[15px] leading-6 outline-none placeholder:text-muted-foreground"
        />

        {/* Bottom row: pills left, actions right */}
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* + button (features popover) */}
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Thêm tính năng"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-brand/40 hover:bg-brand/10 hover:text-brand"
                >
                  {uploading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Plus className="h-5 w-5" />
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="start"
                className="w-56 p-1.5"
                sideOffset={8}
              >
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition hover:bg-muted"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/15 text-brand">
                    <Paperclip className="h-4 w-4" />
                  </span>
                  <span className="flex flex-col items-start">
                    <span className="font-medium">Tải file lên</span>
                    <span className="text-xs text-muted-foreground">
                      Từ thiết bị của bạn
                    </span>
                  </span>
                </button>
                <div className="px-2.5 py-1.5 text-[11px] text-muted-foreground">
                  Thêm file ảnh, văn bản, code… AI sẽ đọc nội dung.
                </div>
              </PopoverContent>
            </Popover>

            {/* DeepThink pill */}
            <button
              type="button"
              onClick={toggleDeepThink}
              aria-pressed={deepThink}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                deepThink
                  ? "border-brand bg-brand text-brand-foreground shadow-sm shadow-brand/25"
                  : "border-border bg-background text-muted-foreground hover:border-brand/40 hover:text-brand",
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              DeepThink
            </button>

            {/* Search pill */}
            <button
              type="button"
              onClick={toggleWebSearch}
              aria-pressed={webSearch}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                webSearch
                  ? "border-brand bg-brand/15 text-brand"
                  : "border-border bg-background text-muted-foreground hover:border-brand/40 hover:text-brand",
              )}
            >
              <Search className="h-3.5 w-3.5" />
              Tìm web
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isStreaming ? (
              <button
                onClick={onStop}
                aria-label="Dừng"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition hover:opacity-90"
              >
                <Square className="h-4 w-4 fill-current" />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!canSend}
                aria-label="Gửi"
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-sm transition",
                  canSend
                    ? "bg-brand text-brand-foreground shadow-brand/25 hover:brightness-110 active:scale-95"
                    : "cursor-not-allowed bg-muted text-muted-foreground",
                )}
              >
                <ArrowUp className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <p className="mt-2 text-center text-xs text-muted-foreground">
        Nội dung do AI tạo, chỉ dùng làm tham khảo.
      </p>
    </div>
  );
}
