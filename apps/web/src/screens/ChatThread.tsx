/**
 * Chat (2.3, spec §4.3): WhatsApp-style rows — last-message preview, unread
 * badge, timestamp, pinned chats, new-chat FAB. Thread view: flat rows with
 * hairlines (no bubbles — A1), reply/quote, edit window, delete own, read
 * receipts, typing indicator, optimistic sends (L6), pin-to-feed bridge.
 * Library components only (M2).
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Api } from "../api.js";
import { Button, Badge } from "@fedites/ui";
import type { ChatMessage } from "../phase2-types.js";

const inputStyle: React.CSSProperties = {
  width: "100%", minHeight: 44, border: "none", borderBottom: "1px solid var(--hairline-color)", background: "transparent", font: "15px var(--font-ui)", color: "var(--c-base-contrast)",
};

export function ChatThreadScreen({ type, id, onNavigate, remoteTyping = null, ssrData }: {
  type: "group" | "dm"; id: string; onNavigate: (to: string) => void;
  remoteTyping?: { threadId: string; name: string } | null;
  ssrData?: { messages?: { messages: ChatMessage[] } };
}): React.ReactElement {
  const [messages, setMessages] = useState<ChatMessage[] | null>(ssrData?.messages?.messages ?? null);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [typing, setTyping] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback((): void => {
    Api.threadMessages(type, id).then((r) => setMessages(r.messages)).catch(() => setMessages([]));
  }, [type, id]);
  // Read receipt on open (I5: watermark moves; badges agree).
  useEffect(() => {
    void Api.markThreadRead(type, id).catch(() => undefined);
  }, [type, id, messages]);

  useEffect(() => {
    if (remoteTyping !== null && remoteTyping.threadId === id) {
      setTyping(remoteTyping.name);
      const t = setTimeout(() => setTyping(null), 3000);
      return () => clearTimeout(t);
    }
  }, [remoteTyping, id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const onDraft = (v: string): void => {
    setDraft(v);
    void Api.sendTyping(type, id).catch(() => undefined);
  };

  const send = async (): Promise<void> => {
    if (draft.trim().length === 0) return;
    const bodyText = draft;
    setDraft("");
    if (editing !== null) {
      await Api.editMessage(editing, bodyText).catch(() => undefined);
      setEditing(null);
      load();
      return;
    }
    // Optimistic send (L6): appears instantly, reconciles from the server.
    const optimistic: ChatMessage = {
      id: `pending-${Date.now()}`, authorId: "me", author: "", body: bodyText,
      kind: "text", mediaId: null, isMine: true, replyTo: replyTo !== null ? { id: replyTo.id, body: replyTo.body, author: replyTo.author } : null,
      editedAt: null, createdAt: new Date().toISOString(), pending: true,
    };
    setMessages((m) => [...(m ?? []), optimistic]);
    setReplyTo(null);
    try {
      const saved = type === "group" ? await Api.sendGroupMessage(id, { body: bodyText, replyToId: optimistic.replyTo?.id }) : await Api.sendDm(id, { body: bodyText, replyToId: optimistic.replyTo?.id });
      setMessages((m) => (m ?? []).map((x) => (x.id === optimistic.id ? saved : x)));
    } catch {
      setMessages((m) => (m ?? []).map((x) => (x.id === optimistic.id ? { ...x, pending: false, body: `${x.body} (failed to send)` } : x)));
    }
  };

  const remove = async (messageId: string): Promise<void> => {
    await Api.deleteMessage(messageId).catch(() => undefined);
    load();
  };

  const pin = async (messageId: string): Promise<void> => {
    await Api.pinToFeed(messageId).catch(() => undefined);
    onNavigate(`/groups/${id}`);
  };

  if (messages === null) return <main className="screen-pad" />;

  return (
    <main className="screen-pad" style={{ paddingBottom: 140 }}>
      <Button kind="underline-link" small onClick={() => onNavigate(type === "group" ? `/groups/${id}` : "/chat")}>
        {type === "group" ? "Open group space" : "Back to chats"}
      </Button>
      <div>
        {messages.map((m) => (
          <div key={m.id} style={{ borderBottom: "var(--hairline) solid var(--hairline-color)", padding: "var(--space-3) var(--density-pad-x)", opacity: m.pending === true ? 0.6 : 1 }}>
            <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "baseline" }}>
              <span style={{ font: "var(--weight-semibold) var(--type-body2) var(--font-ui)" }}>{m.isMine ? "You" : m.author}</span>
              <span className="micro tabular">{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              {m.editedAt !== null && <Badge variant="dot">edited</Badge>}
              {m.isMine === true && m.pending !== true && <span className="micro" style={{ marginLeft: "auto" }}>Sent</span>}
            </div>
            {m.replyTo !== null && (
              <div style={{ borderLeft: "2px solid var(--c-accent)", paddingLeft: "var(--space-2)", margin: "var(--space-1) 0", font: "var(--type-body2) var(--font-ui)", color: "var(--c-neutral-500)" }}>
                {m.replyTo.author}: {m.replyTo.body}
              </div>
            )}
            <div style={{ font: "var(--type-body) var(--font-ui)", color: "var(--c-base-contrast)" }}>{m.body}</div>
            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              <Button kind="underline-link" small onClick={() => setReplyTo(m)}>Reply</Button>
              {m.isMine && (
                <>
                  <Button kind="underline-link" small onClick={() => { setEditing(m.id); setDraft(m.body ?? ""); }}>Edit</Button>
                  <Button kind="underline-link" small onClick={() => void remove(m.id)}>Delete</Button>
                </>
              )}
              {type === "group" && (
                <Button kind="underline-link" small onClick={() => void pin(m.id)}>Pin to feed</Button>
              )}
              <Button kind="underline-link" small onClick={() => void Api.report({ messageId: m.id, reason: "Reported from chat" }).catch(() => undefined)}>Report</Button>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {typing !== null && <div className="micro" style={{ padding: "var(--space-1) var(--density-pad-x)" }}>{typing} is typing</div>}

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, borderTop: "var(--hairline) solid var(--hairline-color)", background: "var(--c-base)", display: "flex", gap: "var(--space-2)", padding: "var(--space-2)", zIndex: 30 }}>
        {replyTo !== null && (
          <span className="micro" style={{ alignSelf: "center" }}>Replying to {replyTo.author} · <button type="button" onClick={() => setReplyTo(null)}>cancel</button></span>
        )}
        <input
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void send(); }}
          placeholder={editing !== null ? "Edit your message…" : "Message"}
          aria-label="Message"
          style={inputStyle}
        />
        <Button kind="filled" small onClick={() => void send()}>{editing !== null ? "Save" : "Send"}</Button>
      </div>
    </main>
  );
}
