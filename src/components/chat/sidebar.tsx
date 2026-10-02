"use client";

import { useState } from "react";
import {
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useChatStore } from "@/lib/chat-store";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  onClose?: () => void;
  onCollapse?: () => void;
  onExpand?: () => void;
  collapsed?: boolean;
}

function BrandMark({ small }: { small?: boolean }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground shadow-sm shadow-brand/20 ring-1 ring-brand/30",
        small ? "h-8 w-8" : "h-7 w-7",
      )}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
        <path d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2Zm3.06 5.94a.75.75 0 0 0-1.06 0L12 9.94l-2-2a.75.75 0 1 0-1.06 1.06l2 2-2 2a.75.75 0 1 0 1.06 1.06l2-2 2 2a.75.75 0 0 0 1.06-1.06l-2-2 2-2a.75.75 0 0 0 0-1.06Z" />
      </svg>
    </div>
  );
}

function groupByDate(convs: { id: string; title: string; updatedAt: number }[]) {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startOfYesterday = startOfToday - 24 * 3600 * 1000;
  const startOf7 = startOfToday - 7 * 24 * 3600 * 1000;
  const startOf30 = startOfToday - 30 * 24 * 3600 * 1000;

  const groups: {
    label: string;
    items: { id: string; title: string; updatedAt: number }[];
  }[] = [
    { label: "Hôm nay", items: [] },
    { label: "Hôm qua", items: [] },
    { label: "7 ngày qua", items: [] },
    { label: "30 ngày qua", items: [] },
    { label: "Cũ hơn", items: [] },
  ];

  for (const c of convs) {
    if (c.updatedAt >= startOfToday) groups[0].items.push(c);
    else if (c.updatedAt >= startOfYesterday) groups[1].items.push(c);
    else if (c.updatedAt >= startOf7) groups[2].items.push(c);
    else if (c.updatedAt >= startOf30) groups[3].items.push(c);
    else groups[4].items.push(c);
  }
  return groups.filter((g) => g.items.length > 0);
}

function ThemeToggleMenuItem() {
  const { setTheme } = useTheme();
  return (
    <DropdownMenuItem
      onClick={() => {
        const isDark = document.documentElement.classList.contains("dark");
        setTheme(isDark ? "light" : "dark");
      }}
    >
      <span className="mr-2">🌙</span>
      Đổi giao diện (Sáng/Tối)
    </DropdownMenuItem>
  );
}

export function Sidebar({
  onClose,
  onCollapse,
  onExpand,
  collapsed,
}: SidebarProps) {
  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeId);
  const newConversation = useChatStore((s) => s.newConversation);
  const selectConversation = useChatStore((s) => s.selectConversation);
  const deleteConversation = useChatStore((s) => s.deleteConversation);
  const renameConversation = useChatStore((s) => s.renameConversation);
  const clearAll = useChatStore((s) => s.clearAll);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  const groups = groupByDate(sorted);

  const handleNew = () => {
    newConversation();
    onClose?.();
  };

  const startEdit = (id: string, title: string) => {
    setEditingId(id);
    setEditValue(title === "New chat" ? "" : title);
  };

  const commitEdit = () => {
    if (editingId) renameConversation(editingId, editValue.trim());
    setEditingId(null);
    setEditValue("");
  };

  // ===== Collapsed rail (icon only) =====
  if (collapsed) {
    return (
      <div className="flex h-full w-[280px] flex-col items-center bg-sidebar py-3">
        <div className="flex w-full flex-col items-center gap-2">
          <BrandMark small />
          <button
            onClick={handleNew}
            aria-label="Trò chuyện mới"
            title="Trò chuyện mới"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-sidebar-border text-sidebar-foreground transition hover:border-brand/40 hover:bg-brand/10 hover:text-brand"
          >
            <Plus className="h-5 w-5" />
          </button>
          <button
            aria-label="Tìm kiếm"
            title="Tìm kiếm"
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <Search className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-auto flex w-full flex-col items-center gap-2">
          <button
            onClick={onExpand}
            aria-label="Mở rộng sidebar"
            title="Mở rộng sidebar"
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <PanelLeftOpen className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  }

  // ===== Expanded sidebar =====
  return (
    <div className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-2">
          <BrandMark />
          <span className="text-sm font-semibold tracking-tight">AI Chat</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            aria-label="Tìm kiếm"
            title="Tìm kiếm"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <Search className="h-[18px] w-[18px]" />
          </button>
          {onCollapse && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onCollapse}
              aria-label="Thu gọn sidebar"
              title="Thu gọn sidebar"
            >
              <PanelLeftClose className="h-[18px] w-[18px]" />
            </Button>
          )}
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={onClose}
              aria-label="Đóng"
            >
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      {/* New chat pill */}
      <div className="px-3">
        <button
          onClick={handleNew}
          className="flex w-full items-center gap-2 rounded-full border border-sidebar-border bg-sidebar-accent/50 px-3 py-2.5 text-sm font-medium transition hover:bg-sidebar-accent"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sidebar-foreground/10 text-sidebar-foreground">
            <Plus className="h-3.5 w-3.5" />
          </span>
          Trò chuyện mới
        </button>
      </div>

      {/* Conversation list */}
      <nav className="mt-3 flex-1 overflow-y-auto px-2 pb-2">
        {groups.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">
            Chưa có cuộc trò chuyện nào.
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.label} className="mb-3">
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                {g.label}
              </div>
              <div className="space-y-0.5">
                {g.items.map((c) => (
                  <div
                    key={c.id}
                    className={cn(
                      "group/item relative flex items-center gap-1 rounded-lg px-2.5 py-2 text-sm transition",
                      c.id === activeId
                        ? "bg-sidebar-accent"
                        : "hover:bg-sidebar-accent/60",
                    )}
                  >
                    {c.id === activeId && (
                      <span
                        className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-brand"
                        aria-hidden="true"
                      />
                    )}
                    {editingId === c.id ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit();
                          if (e.key === "Escape") {
                            setEditingId(null);
                            setEditValue("");
                          }
                        }}
                        className="min-w-0 flex-1 rounded bg-sidebar px-1 py-0.5 text-sm outline-none ring-1 ring-brand/50"
                      />
                    ) : (
                      <button
                        onClick={() => {
                          selectConversation(c.id);
                          onClose?.();
                        }}
                        className="min-w-0 flex-1 truncate text-left"
                        title={c.title}
                      >
                        {c.title}
                      </button>
                    )}

                    {editingId !== c.id && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="ml-auto flex h-6 w-6 items-center justify-center rounded text-muted-foreground opacity-0 transition hover:bg-sidebar group-hover/item:opacity-100 data-[state=open]:opacity-100"
                            aria-label="Tùy chọn"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem
                            onClick={() => startEdit(c.id, c.title)}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Đổi tên
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => deleteConversation(c.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Xoá
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </nav>

      {/* Footer: user profile + settings menu */}
      <div className="border-t border-sidebar-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition hover:bg-sidebar-accent">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/20 text-sm font-semibold text-brand ring-1 ring-brand/30">
                K
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">Khách</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  Miễn phí
                </div>
              </div>
              <MoreHorizontal className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Cài đặt</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ThemeToggleMenuItem />
            {conversations.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => {
                    if (
                      confirm(
                        "Xoá toàn bộ cuộc trò chuyện? Việc này không thể hoàn tác.",
                      )
                    ) {
                      clearAll();
                    }
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Xoá tất cả cuộc trò chuyện
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
