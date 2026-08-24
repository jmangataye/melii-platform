"use client";

import { useEffect, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

function getOrCreateVisitorId(creatorId: string): string {
  const key = `melii_visitor_${creatorId}`;
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    window.localStorage.setItem(key, fresh);
    return fresh;
  } catch {
    // localStorage indisponible (navigation privée stricte, etc.) : on
    // retombe sur un id de session qui ne survit pas au rechargement —
    // dégradation acceptable plutôt qu'un chat cassé.
    return crypto.randomUUID();
  }
}

export default function ChatWidget({
  creatorId,
  displayName,
  accentColor,
}: {
  creatorId: string;
  displayName: string;
  accentColor?: string | null;
}) {
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = getOrCreateVisitorId(creatorId);
    setChatId(id);
    (async () => {
      try {
        const res = await fetch(`/api/chat/${creatorId}?chatId=${encodeURIComponent(id)}`);
        if (res.ok) {
          const json = await res.json();
          setMessages(json.messages || []);
        }
      } finally {
        setLoadingHistory(false);
      }
    })();
  }, [creatorId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || !chatId || sending) return;
    setInput("");
    setSending(true);
    setMessages((m) => [...m, { role: "user", content: text }]);
    try {
      const res = await fetch(`/api/chat/${creatorId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chatId, message: text }),
      });
      const json = await res.json();
      if (res.ok && json.reply) {
        setMessages((m) => [...m, { role: "assistant", content: json.reply }]);
      } else {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: "Petit bug de mon côté, réessaie dans une minute 😅" },
        ]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Petit bug de mon côté, réessaie dans une minute 😅" },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col card p-0 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[50vh]">
        {loadingHistory && (
          <div className="space-y-3">
            <div className="max-w-[70%] h-9 rounded-2xl rounded-bl-sm bg-surface-2 animate-pulse" />
            <div className="max-w-[50%] h-9 rounded-2xl rounded-bl-sm bg-surface-2 animate-pulse ml-0" />
          </div>
        )}
        {!loadingHistory && messages.length === 0 && (
          <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-surface-2 px-4 py-2 text-sm">
            Hey toi 😊 contente que tu sois là ! Raconte-moi un peu qui tu es, je suis{" "}
            {displayName}.
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap break-words ${
              m.role === "user"
                ? "ml-auto rounded-br-sm gradient-btn text-white"
                : "rounded-bl-sm bg-surface-2"
            }`}
            style={m.role === "user" && accentColor ? { background: accentColor } : undefined}
          >
            {m.content}
          </div>
        ))}
        {sending && (
          <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-surface-2 px-4 py-3 flex items-center gap-1.5" aria-label={`${displayName} est en train d'écrire`}>
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="border-t border-border p-3 flex items-center gap-2"
      >
        <input
          className="input flex-1"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Écris un message..."
          disabled={!chatId}
        />
        <button
          type="submit"
          disabled={!input.trim() || sending || !chatId}
          className="gradient-btn rounded-full px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60 shrink-0"
          style={accentColor ? { background: accentColor } : undefined}
        >
          Envoyer
        </button>
      </form>
    </div>
  );
}
