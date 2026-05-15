import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Markdown } from "./markdown";

export type ChatMessage = { id: string; role: string; content: string; created_at?: string };

export function ChatPanel({
  messages, onSend, sending, placeholder, emptyTitle, emptySubtitle,
}: {
  messages: ChatMessage[];
  onSend: (content: string) => Promise<void> | void;
  sending: boolean;
  placeholder: string;
  emptyTitle: string;
  emptySubtitle: string;
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, sending]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    const text = input;
    setInput("");
    await onSend(text);
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] flex-col">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-1 pb-4">
        {messages.length === 0 && !sending && (
          <div className="grid h-full place-items-center text-center">
            <div>
              <h3 className="text-lg font-semibold">{emptyTitle}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{emptySubtitle}</p>
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              m.role === "user"
                ? "gradient-brand text-primary-foreground shadow-glow whitespace-pre-wrap"
                : "glass border border-border"
            }`}>
              {m.role === "user" ? m.content : <Markdown>{m.content}</Markdown>}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="glass rounded-2xl border border-border px-4 py-3 text-sm text-muted-foreground">
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/60" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/60" style={{ animationDelay: "120ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/60" style={{ animationDelay: "240ms" }} />
              </span>
            </div>
          </div>
        )}
      </div>
      <form onSubmit={submit} className="glass flex items-center gap-2 rounded-2xl border border-border p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
          disabled={sending}
        />
        <button type="submit" disabled={sending || !input.trim()}
          className="grid h-9 w-9 place-items-center rounded-xl gradient-brand text-primary-foreground shadow-glow disabled:opacity-50">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
