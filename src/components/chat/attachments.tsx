"use client";

import { FileText, ImageIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/files";
import type { Attachment } from "@/lib/chat-store";

interface AttachmentChipProps {
  attachment: Attachment;
  onRemove?: () => void;
  compact?: boolean;
}

export function AttachmentChip({
  attachment,
  onRemove,
  compact,
}: AttachmentChipProps) {
  const isImage = attachment.type.startsWith("image/");
  const hasPreview = isImage && attachment.dataUrl;

  if (compact && hasPreview) {
    return (
      <div className="group/chip relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border">
        <img
          src={attachment.dataUrl}
          alt={attachment.name}
          className="h-full w-full object-cover"
        />
        {onRemove && (
          <button
            onClick={onRemove}
            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition group-hover/chip:opacity-100"
            aria-label="Xoá"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="group/chip flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-2.5 py-1.5"
      title={attachment.name}
    >
      {hasPreview ? (
        <img
          src={attachment.dataUrl}
          alt={attachment.name}
          className="h-7 w-7 shrink-0 rounded object-cover"
        />
      ) : isImage ? (
        <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
      ) : (
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0">
        <div className="max-w-[160px] truncate text-xs font-medium">
          {attachment.name}
        </div>
        {!compact && (
          <div className="text-[10px] text-muted-foreground">
            {formatFileSize(attachment.size)}
          </div>
        )}
      </div>
      {onRemove && (
        <button
          onClick={onRemove}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-background hover:text-foreground"
          aria-label="Xoá file"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

export function AttachmentList({
  attachments,
  onRemove,
  compact,
  className,
}: {
  attachments: Attachment[];
  onRemove?: (id: string) => void;
  compact?: boolean;
  className?: string;
}) {
  if (!attachments.length) return null;
  return (
    <div
      className={cn(
        "flex flex-wrap gap-2",
        compact && "gap-1.5",
        className,
      )}
    >
      {attachments.map((a) => (
        <AttachmentChip
          key={a.id}
          attachment={a}
          compact={compact}
          onRemove={onRemove ? () => onRemove(a.id) : undefined}
        />
      ))}
    </div>
  );
}
