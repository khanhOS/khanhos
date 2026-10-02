"use client";

import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy, Download } from "lucide-react";

// Map ngôn ngữ -> đuôi file để đặt tên khi download
const LANG_TO_EXT: Record<string, string> = {
  python: "py",
  py: "py",
  javascript: "js",
  js: "js",
  jsx: "jsx",
  typescript: "ts",
  ts: "ts",
  tsx: "tsx",
  java: "java",
  c: "c",
  cpp: "cpp",
  "c++": "cpp",
  csharp: "cs",
  cs: "cs",
  go: "go",
  golang: "go",
  rust: "rs",
  rs: "rs",
  ruby: "rb",
  rb: "rb",
  php: "php",
  bash: "sh",
  sh: "sh",
  shell: "sh",
  html: "html",
  css: "css",
  scss: "scss",
  json: "json",
  yaml: "yml",
  yml: "yml",
  xml: "xml",
  sql: "sql",
  markdown: "md",
  md: "md",
  vue: "vue",
  svelte: "svelte",
  swift: "swift",
  kotlin: "kt",
  dart: "dart",
  r: "r",
  matlab: "m",
  lua: "lua",
  perl: "pl",
  powershell: "ps1",
  dockerfile: "dockerfile",
  makefile: "mk",
  graphql: "graphql",
  ini: "ini",
  toml: "toml",
  diff: "diff",
  plaintext: "txt",
  text: "txt",
};

function fileExtension(language: string): string {
  const key = (language || "").toLowerCase().trim();
  return LANG_TO_EXT[key] || "txt";
}

function CodeBlock({
  language,
  value,
}: {
  language: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const onDownload = () => {
    try {
      const ext = fileExtension(language);
      const filename = `snippet.${ext}`;
      const blob = new Blob([value], {
        type: "text/plain;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="group relative my-3 overflow-hidden rounded-lg border border-border bg-[#282c34]">
      <div className="flex items-center justify-between border-b border-white/10 bg-black/30 px-3 py-1.5">
        <span className="font-mono text-xs text-zinc-400">
          {language || "text"}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onCopy}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" /> Copy
              </>
            )}
          </button>
          <button
            onClick={onDownload}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100"
            title="Tải code về file"
          >
            {downloaded ? (
              <>
                <Check className="h-3 w-3" /> Saved
              </>
            ) : (
              <>
                <Download className="h-3 w-3" /> Download
              </>
            )}
          </button>
        </div>
      </div>
      <SyntaxHighlighter
        language={language || "text"}
        style={oneDark}
        customStyle={{
          margin: 0,
          background: "transparent",
          padding: "0.875rem 1rem",
          fontSize: "0.8125rem",
          lineHeight: 1.6,
        }}
        codeTagProps={{ style: { fontFamily: "var(--font-geist-mono), monospace" } }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
}

export const Markdown = memo(function Markdown({ content }: { content: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || "");
            const value = String(children).replace(/\n$/, "");
            const isInline = !className && !value.includes("\n");
            if (isInline) {
              return (
                <code
                  className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <CodeBlock language={match?.[1] || ""} value={value} />
            );
          },
          pre({ children }: any) {
            return <>{children}</>;
          },
          a({ children, href }: any) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-2 hover:opacity-80"
              >
                {children}
              </a>
            );
          },
          ul({ children }: any) {
            return (
              <ul className="my-2 list-disc space-y-1 pl-6">{children}</ul>
            );
          },
          ol({ children }: any) {
            return (
              <ol className="my-2 list-decimal space-y-1 pl-6">{children}</ol>
            );
          },
          blockquote({ children }: any) {
            return (
              <blockquote className="my-2 border-l-2 border-border pl-3 italic text-muted-foreground">
                {children}
              </blockquote>
            );
          },
          h1: ({ children }: any) => (
            <h1 className="mb-2 mt-3 text-lg font-semibold">{children}</h1>
          ),
          h2: ({ children }: any) => (
            <h2 className="mb-2 mt-3 text-base font-semibold">{children}</h2>
          ),
          h3: ({ children }: any) => (
            <h3 className="mb-1.5 mt-2 text-sm font-semibold">{children}</h3>
          ),
          p: ({ children }: any) => (
            <p className="mb-3 leading-8 last:mb-0">{children}</p>
          ),
          table: ({ children }: any) => (
            <div className="my-3 overflow-x-auto">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          th: ({ children }: any) => (
            <th className="border border-border bg-muted px-3 py-1.5 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }: any) => (
            <td className="border border-border px-3 py-1.5">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
