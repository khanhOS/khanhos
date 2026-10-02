import { NextRequest } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface IncomingMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

const OPEN_TAG = "<think>";
const CLOSE_TAG = "</think>";

/** Trả về (emit, hold) trong đó hold là hậu tố dài nhất của buf mà là tiền tố của tag. */
function splitPartialTag(buf: string, tag: string): { emit: string; hold: string } {
  for (let n = Math.min(buf.length, tag.length - 1); n > 0; n--) {
    if (tag.startsWith(buf.slice(buf.length - n))) {
      return { emit: buf.slice(0, buf.length - n), hold: buf.slice(buf.length - n) };
    }
  }
  return { emit: buf, hold: "" };
}

/**
 * Bộ phân tích streaming cho <think>...</think>: tách reasoning (trong thẻ) và
 * answer (sau thẻ) thành các sự kiện riêng, xử lý cả trường hợp thẻ bị cắt
 * ngang giữa các chunk.
 */
function createThinkParser(onReasoning: (s: string) => void, onContent: (s: string) => void) {
  let phase: "pre" | "think" | "answer" = "pre";
  let hold = "";

  const feed = (delta: string) => {
    let buf = hold + delta;
    hold = "";
    // tối đa 4 vòng lặp cho mỗi chunk (xử lý nhiều tag trong 1 chunk)
    for (let guard = 0; guard < 4 && buf.length > 0; guard++) {
      if (phase === "pre") {
        const idx = buf.indexOf(OPEN_TAG);
        if (idx >= 0) {
          if (idx > 0) onContent(buf.slice(0, idx));
          buf = buf.slice(idx + OPEN_TAG.length);
          phase = "think";
          continue;
        }
        const { emit, hold: h } = splitPartialTag(buf, OPEN_TAG);
        if (emit) onContent(emit);
        hold = h;
        return;
      }
      if (phase === "think") {
        const idx = buf.indexOf(CLOSE_TAG);
        if (idx >= 0) {
          if (idx > 0) onReasoning(buf.slice(0, idx));
          buf = buf.slice(idx + CLOSE_TAG.length);
          phase = "answer";
          continue;
        }
        const { emit, hold: h } = splitPartialTag(buf, CLOSE_TAG);
        if (emit) onReasoning(emit);
        hold = h;
        return;
      }
      // answer
      onContent(buf);
      buf = "";
    }
  };

  const flush = () => {
    if (hold) {
      if (phase === "pre" || phase === "answer") onContent(hold);
      else onReasoning(hold);
      hold = "";
    }
  };

  return { feed, flush, getPhase: () => phase };
}

export async function POST(req: NextRequest) {
  let body: {
    messages?: IncomingMessage[];
    message?: string;
    deepThink?: boolean;
    webSearch?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const messages: IncomingMessage[] = Array.isArray(body.messages)
    ? body.messages
    : body.message
      ? [{ role: "user", content: body.message }]
      : [];

  if (messages.length === 0) {
    return new Response(JSON.stringify({ error: "messages is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const deepThink = !!body.deepThink;
  const webSearch = !!body.webSearch;

  const baseSystem =
    "You are a helpful, friendly AI assistant. Answer clearly and concisely. Use Markdown formatting (headings, lists, code blocks) when it improves readability. When sharing code, always use fenced code blocks with the correct language tag. Respond in the same language as the user (Vietnamese if they write Vietnamese).";

  const deepThinkInstruction =
    "You MUST begin EVERY response with a <think> ... </think> block. Inside <think>, briefly reason step-by-step in the user's language. After </think>, write your final answer. Example — User: 2+2? | You: <think>2+2 equals 4.</think>4. Never skip the <think> block and never mention the tags to the user.";

  const systemPrompt = deepThink
    ? `${baseSystem}\n\n${deepThinkInstruction}`
    : baseSystem;

  let fullMessages: IncomingMessage[] = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  // Web search: nếu bật, tìm web cho tin nhắn user cuối và ghép kết quả
  if (webSearch) {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser && lastUser.content.trim()) {
      const query = lastUser.content.trim().slice(0, 200);
      let resultsSnippet = "";
      try {
        const zai = await ZAI.create();
        const results = (await zai.functions.invoke("web_search", {
          query,
          num: 5,
        })) as Array<{
          name: string;
          url: string;
          snippet: string;
          host_name?: string;
        }>;
        if (Array.isArray(results) && results.length > 0) {
          resultsSnippet = results
            .slice(0, 5)
            .map(
              (r, i) =>
                `${i + 1}. ${r.name}\n   ${r.url}\n   ${r.snippet || ""}`,
            )
            .join("\n\n");
        }
      } catch (e) {
        /* ignore search errors */
      }
      if (resultsSnippet) {
        fullMessages = [
          { role: "system", content: systemPrompt },
          {
            role: "system",
            content:
              "Kết quả tìm web (chỉ dùng làm tham khảo, trích dẫn nguồn khi phù hợp):\n\n" +
              resultsSnippet,
          },
          ...messages,
        ];
      }
    }
  }

  fullMessages = fullMessages.slice(-22);

  let zai;
  try {
    zai = await ZAI.create();
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "AI service unavailable" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  let upstream: ReadableStream<Uint8Array> | null;
  try {
    const result = await zai.chat.completions.create({
      messages: fullMessages,
      stream: true,
      thinking: { type: "disabled" },
    });
    upstream = result as ReadableStream<Uint8Array>;
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e?.message || "AI request failed" }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!upstream) {
    return new Response(
      JSON.stringify({ error: "AI did not return a stream" }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream!.getReader();
      let buffer = "";
      let reasoningStart: number | null = null;

      function send(obj: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data:${JSON.stringify(obj)}\n\n`));
      }

      const parser = createThinkParser(
        (s) => {
          if (reasoningStart === null) reasoningStart = Date.now();
          send({ reasoning: s });
        },
        (s) => {
          if (reasoningStart !== null) {
            send({ reasoningTimeMs: Date.now() - reasoningStart });
            reasoningStart = null;
          }
          send({ content: s });
        },
      );

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || !line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (data === "[DONE]") continue;
            try {
              const json = JSON.parse(data);
              const delta = json?.choices?.[0]?.delta || {};
              const reasoning =
                delta?.reasoning_content ?? delta?.reasoning ?? "";
              const content =
                delta?.content ??
                json?.choices?.[0]?.message?.content ??
                "";
              // Nếu upstream có trả reasoning_content riêng thì dùng luôn
              if (reasoning) {
                if (reasoningStart === null) reasoningStart = Date.now();
                send({ reasoning });
              }
              if (content) parser.feed(content);
            } catch {
              /* ignore malformed */
            }
          }
        }
        parser.flush();
        send({});
        controller.enqueue(encoder.encode("data:[DONE]\n\n"));
      } catch (e) {
        send({ error: "Stream interrupted" });
        controller.enqueue(encoder.encode("data:[DONE]\n\n"));
      } finally {
        controller.close();
      }
    },
    cancel() {
      try {
        upstream?.cancel();
      } catch {
        /* ignore */
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
