"use client";

import { useEffect, useRef, useState } from "react";
import { getOrCreateVisitorId } from "./visitor";

type Message = { role: "user" | "assistant"; content: string };

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
  const [slowHistory, setSlowHistory] = useState(false);
  const [slowSend, setSlowSend] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Le service (Render, plan gratuit) peut s'être mis en veille — la
  // première requête après une période d'inactivité prend alors bien plus
  // longtemps qu'un aller-retour réseau normal. Sans indice, ça ressemble à
  // un bot cassé plutôt qu'à un simple réveil ; on ajoute donc un message
  // rassurant seulement si l'attente dépasse ce qu'on verrait normalement.
  useEffect(() => {
    if (!loadingHistory) return;
    const t = setTimeout(() => setSlowHistory(true), 4000);
    return () => {
      clearTimeout(t);
      setSlowHistory(false);
    };
  }, [loadingHistory]);

  useEffect(() => {
    if (!sending) return;
    const t = setTimeout(() => setSlowSend(true), 5000);
    return () => {
      clearTimeout(t);
      setSlowSend(false);
    };
  }, [sending]);

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
    <div className="flex-1 flex flex-col card glow p-0 overflow-hidden relative">
      <div
        aria-hidden
        className="absolute -top-20 -left-16 w-64 h-64 rounded-full opacity-[0.08] blur-3xl pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${accentColor || "var(--accent-2)"}, transparent 70%)`,
        }}
      />
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[50vh] relative">
        {loadingHistory && (
          <div className="space-y-3">
            <div className="max-w-[70%] h-9 rounded-2xl rounded-bl-sm bg-surface-2 animate-pulse" />
            <div className="max-w-[50%] h-9 rounded-2xl rounded-bl-sm bg-surface-2 animate-pulse ml-0" />
            {slowHistory && (
              <p className="fade-in-up text-xs text-muted text-center pt-2">
                Ça prend un peu plus longtemps que d&apos;habitude — le service se réveille, patiente quelques secondes.
              </p>
            )}
          </div>
        )}
        {!loadingHistory && messages.length === 0 && (
          <div className="fade-in-up max-w-[85%] rounded-2xl rounded-bl-sm bg-surface-2 px-4 py-2.5 text-sm shadow-sm">
            Hey toi 😊 contente que tu sois là ! Raconte-moi un peu qui tu es, je suis{" "}
            {displayName}.
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`fade-in-up max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words shadow-sm ${
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
          <div className="space-y-2 fade-in-up">
            <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-surface-2 px-4 py-3 flex items-center gap-1.5" aria-label={`${displayName} est en train d'écrire`}>
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
            {slowSend && (
              <p className="fade-in-up text-xs text-muted">
                Ça prend un peu plus longtemps que d&apos;habitude, patiente quelques secondes.
              </p>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="border-t border-border p-3 flex items-center gap-2 relative bg-surface"
      >
        <input
          className="input flex-1 rounded-full"
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
