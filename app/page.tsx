"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Role = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: Role;
  content: string;
};

const CONFETTI_COLORS = [
  "#f43f5e",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#38bdf8",
  "#a855f7",
  "#ec4899",
];

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function containsVictory(text: string) {
  if (!text) return false;
  const normalized = text.normalize("NFKC").toUpperCase();
  if (normalized.includes("VICTORY")) return true;
  return normalized.replace(/[^A-Z]/g, "").includes("VICTORY");
}

function mergeStreamText(
  previous: string,
  incoming: string,
  replace: boolean
) {
  if (replace) return incoming;
  if (!incoming) return previous;
  if (!previous) return incoming;
  if (incoming.startsWith(previous)) return incoming;
  return previous + incoming;
}

function parseDifyAnswerChunk(
  line: string
): { text: string; replace: boolean } | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return null;

  const payload = trimmed.slice(5).trim();
  if (!payload || payload === "[DONE]") return null;

  try {
    const data = JSON.parse(payload) as {
      event?: string;
      answer?: string;
      data?: { text?: string; answer?: string };
    };

    if (data.event === "ping" || data.event === "error") return null;

    if (typeof data.answer === "string" && data.answer) {
      return {
        text: data.answer,
        replace: data.event === "message_replace",
      };
    }

    const nestedText = data.data?.text || data.data?.answer;
    if (typeof nestedText === "string" && nestedText) {
      return { text: nestedText, replace: false };
    }
  } catch {
    return null;
  }

  return null;
}

export default function HomePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "嗨！我是你的小伙伴。\n\n想聊什么，**直接告诉我**吧～",
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioUnlockedRef = useRef(false);
  const victoryPlayedRef = useRef(false);
  const playingVictoryRef = useRef(false);
  const confettiTimerRef = useRef<number | null>(null);

  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 80 }, (_, index) => ({
        id: index,
        left: `${(index * 13) % 100}%`,
        delay: `${(index % 12) * 0.12}s`,
        duration: `${2.4 + (index % 8) * 0.25}s`,
        color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
        drift: `${(index % 2 === 0 ? -1 : 1) * (12 + (index % 20))}px`,
        size: 8 + (index % 7),
      })),
    []
  );

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isSending]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const maxHeight = 120;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, [input]);

  function unlockAudio() {
    const audio = audioRef.current;
    if (!audio || audioUnlockedRef.current) return;

    audio.muted = true;
    audio.volume = 0;
    audio
      .play()
      .then(() => {
        audioUnlockedRef.current = true;
        if (!playingVictoryRef.current) {
          audio.pause();
          audio.currentTime = 0;
        }
        audio.muted = false;
        audio.volume = 1;
      })
      .catch(() => {
        audio.muted = false;
        audio.volume = 1;
      });
  }

  function triggerVictory() {
    if (victoryPlayedRef.current) return;
    victoryPlayedRef.current = true;
    playingVictoryRef.current = true;
    setShowConfetti(true);

    const audio = audioRef.current;
    if (audio) {
      audio.muted = false;
      audio.volume = 1;
      try {
        audio.currentTime = 0;
      } catch {
        /* ignore */
      }
      void audio.play().catch(() => {
        void new Audio("/victory.mp3").play().catch(() => {});
      });
    }

    if (confettiTimerRef.current) {
      window.clearTimeout(confettiTimerRef.current);
    }
    confettiTimerRef.current = window.setTimeout(() => {
      setShowConfetti(false);
      playingVictoryRef.current = false;
    }, 5000);
  }

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last?.role === "assistant" && containsVictory(last.content)) {
      triggerVictory();
    }
  }, [messages]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const query = input.trim();
    if (!query || isSending) return;

    unlockAudio();
    victoryPlayedRef.current = false;
    setInput("");
    setIsSending(true);

    const userMessage: ChatMessage = {
      id: makeId(),
      role: "user",
      content: query,
    };
    const assistantId = makeId();
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, conversation_id: "" }),
      });

      if (!response.ok || !response.body) {
        const errorText = await response.text();
        throw new Error(errorText || "发送失败");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const chunk = parseDifyAnswerChunk(line);
          if (!chunk) continue;

          fullText = mergeStreamText(fullText, chunk.text, chunk.replace);
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId
                ? { ...message, content: fullText }
                : message
            )
          );

          if (containsVictory(fullText)) {
            triggerVictory();
          }
        }
      }

      const lastChunk = parseDifyAnswerChunk(buffer);
      if (lastChunk) {
        fullText = mergeStreamText(fullText, lastChunk.text, lastChunk.replace);
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId
              ? { ...message, content: fullText }
              : message
          )
        );
        if (containsVictory(fullText)) {
          triggerVictory();
        }
      }

      if (!fullText) {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId
              ? { ...message, content: "我刚才走神了，再试一次好不好？" }
              : message
          )
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId
            ? { ...message, content: "网络好像卡住了，稍后再试试吧。" }
            : message
        )
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main
      className="flex min-h-screen flex-col bg-blue-50"
      onPointerDown={unlockAudio}
    >
      <audio
        ref={audioRef}
        src="/victory.mp3"
        preload="auto"
        playsInline
      />

      {showConfetti && (
        <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden">
          {confettiPieces.map((piece) => (
            <span
              key={piece.id}
              className="confetti-piece rounded-sm"
              style={{
                left: piece.left,
                width: piece.size,
                height: piece.size * 1.4,
                backgroundColor: piece.color,
                animationDelay: piece.delay,
                animationDuration: piece.duration,
                ["--drift" as string]: piece.drift,
              }}
            />
          ))}
          <p className="absolute left-1/2 top-1/3 -translate-x-1/2 rounded-full bg-white/90 px-8 py-4 text-4xl font-extrabold text-amber-500 shadow-lg">
            撒花！太棒了！
          </p>
        </div>
      )}

      <header className="border-b border-sky-100 bg-white/80 px-4 py-4 text-center shadow-sm">
        <h1 className="text-3xl font-extrabold text-sky-600">言知Q-Know</h1>
        <p className="mt-1 text-lg text-sky-500">问我任何问题，我们一起玩</p>
      </header>

      <div
        ref={listRef}
        className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 overflow-y-auto px-4 py-6"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-3xl px-5 py-3 text-xl leading-relaxed shadow-sm ${
                message.role === "user"
                  ? "rounded-br-md bg-amber-300 text-amber-950"
                  : "markdown-bubble rounded-bl-md bg-white text-slate-700"
              }`}
            >
              {message.role === "assistant" ? (
                message.content ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.content}
                  </ReactMarkdown>
                ) : (
                  isSending && "..."
                )
              ) : (
                message.content
              )}
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        className="chat-composer sticky bottom-0 mx-auto flex w-full max-w-2xl items-end gap-3 bg-blue-50 px-4 pt-4"
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="输入你想说的话..."
          rows={1}
          disabled={isSending}
          className="max-h-[120px] min-h-14 flex-1 resize-none overflow-y-auto rounded-3xl border-2 border-sky-200 bg-white px-6 py-3 text-xl leading-8 text-slate-700 outline-none ring-sky-300 placeholder:text-slate-400 focus:ring-4 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isSending || !input.trim()}
          className="h-14 shrink-0 whitespace-nowrap rounded-full bg-sky-500 px-7 text-xl font-extrabold text-white shadow-md transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-sky-300"
        >
          发送
        </button>
      </form>
    </main>
  );
}
