"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, Loader2, Lock, Sparkles, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function AIChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setError(null);
    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-10),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403) {
          setBlocked(data.error);
        } else if (res.status === 429) {
          setError(data.error);
        } else {
          setError(data.error || "Error al enviar mensaje");
        }
        setLoading(false);
        return;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      if (typeof data.remaining === "number") setRemaining(data.remaining);
    } catch {
      setError("Error de conexión");
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (blocked) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="rounded-full bg-primary/10 p-4 mb-4">
          <Lock className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">Chat IA — Plan Professional</h2>
        <p className="mt-2 text-sm text-muted-foreground text-center max-w-md">{blocked}</p>
        <a
          href="/dashboard/billing"
          className="mt-4 rounded-lg gradient-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Actualizar Plan
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Chat IA
          </h1>
          <p className="text-sm text-muted-foreground">Consultor empresarial inteligente</p>
        </div>
        {remaining !== null && (
          <span className="text-xs text-muted-foreground">{remaining} mensajes restantes hoy</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-card p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <MessageSquare className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-base font-semibold">Consultor Empresarial IA</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md">
              Pregúntame sobre estrategia, finanzas, marketing, ventas u operaciones.
              Tengo acceso a las métricas de tu negocio para darte recomendaciones personalizadas.
            </p>
            <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2 w-full max-w-lg">
              {[
                "¿Cómo puedo mejorar mi margen de utilidad?",
                "Analiza mis métricas de marketing",
                "¿Qué estrategia de precios me recomiendas?",
                "Dame un plan de acción para este mes",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); inputRef.current?.focus(); }}
                  className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5 text-left text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[70%]",
                msg.role === "user"
                  ? "gradient-bg text-white rounded-br-md"
                  : "bg-secondary/50 text-foreground rounded-bl-md"
              )}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2 [&>ul]:mb-2 [&>ol]:mb-2 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm" dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }} />
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-secondary/50 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Pensando...
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="mt-3 flex gap-2">
        <div className="relative flex-1">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pregunta sobre tu negocio..."
            rows={1}
            className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 pr-12 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg gradient-bg p-2 text-white disabled:opacity-30 hover:opacity-90 transition-opacity"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function formatMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="rounded bg-secondary px-1 py-0.5 text-xs">$1</code>')
    .replace(/^### (.+)$/gm, '<h3 class="font-semibold mt-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="font-semibold mt-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="font-bold mt-2">$1</h1>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal">$2</li>')
    .replace(/\n/g, "<br />");
}
