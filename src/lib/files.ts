import type { Attachment } from "@/lib/chat-store";

const TEXT_EXTENSIONS = [
  "txt",
  "md",
  "markdown",
  "json",
  "js",
  "mjs",
  "cjs",
  "ts",
  "tsx",
  "jsx",
  "py",
  "java",
  "c",
  "cpp",
  "cc",
  "h",
  "hpp",
  "cs",
  "go",
  "rs",
  "rb",
  "php",
  "sh",
  "bash",
  "zsh",
  "yml",
  "yaml",
  "toml",
  "xml",
  "html",
  "htm",
  "css",
  "scss",
  "csv",
  "tsv",
  "ini",
  "conf",
  "sql",
  "vue",
  "svelte",
  "env",
  "log",
  "ipynb",
];

const TEXT_TYPE_PREFIXES = [
  "text/",
  "application/json",
  "application/javascript",
  "application/x-javascript",
  "application/xml",
  "application/x-yaml",
  "application/yaml",
  "application/x-sh",
  "application/x-python",
];

export function isTextFile(file: File): boolean {
  if (file.type && TEXT_TYPE_PREFIXES.some((p) => file.type.startsWith(p))) {
    return true;
  }
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return TEXT_EXTENSIONS.includes(ext);
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

const MAX_TEXT_BYTES = 200_000; // ~200KB cap for AI context

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Reads a File from the user's device into an Attachment object.
 * - text files: content is read (capped) into textContent
 * - images: read as data URL for preview
 * - other: metadata only
 */
export async function fileToAttachment(file: File): Promise<Attachment> {
  const base: Attachment = {
    id: uid(),
    name: file.name,
    size: file.size,
    type: file.type,
  };

  if (isTextFile(file)) {
    try {
      const text = await file.slice(0, MAX_TEXT_BYTES).text();
      const truncated = file.size > MAX_TEXT_BYTES;
      base.textContent =
        text +
        (truncated
          ? `\n\n…[nội dung đã cắt bớ còn ${MAX_TEXT_BYTES} byte đầu, file gốc ${file.size} byte]`
          : "");
    } catch {
      /* ignore read errors */
    }
  } else if (isImageFile(file)) {
    try {
      base.dataUrl = await readAsDataURL(file);
    } catch {
      /* ignore */
    }
  }

  return base;
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Builds the text sent to the AI from a user message: the typed text plus
 * the content of any text-file attachments (so the AI can "see" the file).
 */
export function buildAIPromptText(
  text: string,
  attachments: Attachment[] = [],
): string {
  const fileContents = attachments
    .filter((a) => a.textContent)
    .map((a) => {
      const ext = a.name.split(".").pop()?.toLowerCase() || "";
      return `\n\n--- File đính kèm: ${a.name} ---\n\`\`\`${ext}\n${a.textContent}\n\`\`\``;
    })
    .join("");

  const imageNotes = attachments
    .filter((a) => a.type.startsWith("image/"))
    .map((a) => `[Người dùng đã đính kèm ảnh: ${a.name}]`)
    .join(" ");

  const otherNotes = attachments
    .filter((a) => !a.textContent && !a.type.startsWith("image/"))
    .map((a) => `[Người dùng đã đính kèm file: ${a.name} (${formatFileSize(a.size)})]`)
    .join(" ");

  return [text, fileContents, imageNotes, otherNotes].filter(Boolean).join(" ");
}
