/**
 * Chat (2.3, spec §4.3): WhatsApp-style rows — last-message preview, unread
 * badge, timestamp, pinned chats, new-chat FAB. Thread view: flat rows with
 * hairlines (no bubbles — A1), reply/quote, edit window, delete own, read
 * receipts, typing indicator, optimistic sends (L6), pin-to-feed bridge.
 */
import React, { useEffect, useRef, useState } from "react";
import { Api } from "../api.js";
import { Empty, SkeletonList } from "./InboxScreen.js";
import type { ChatThread, ChatMessage, MemberHit } from "../phase2-types.js";

export function ChatListScreen({ onNavigate }: { onNavigate: (to: string) => void }): React.ReactElement {
  const [threads, setThreads] = useState<ChatThread[] | null>(null);
  const [picker, setPicker] = useState(false);
  const [hits, setHits] = useState<MemberHit[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    Api.chatThreads().then((r) => setThreads(r.threads)).catch(() => setThreads([]));
  }, []);

  const search = (q: string): void => {
    setQuery(q);
    Api.searchMembers(q).then((r) => setHits(r.members)).catch(() => undefined);
  };

  if (threads === null) return <SkeletonList />;

  return (
    <main style={{ paddingBottom: 96 }}>
      <h1 className="screen-title">Chat</h1>
      {threads.length === 0 && (
        <Empty
          title="No conversations yet"
          body="Group chats appear with your groups; use the new-chat button for DMs."
        />
      )}
      {threads.map((t) => (
        <button
          key={`${t.type}:${t.id}`}
          type="button"
          className="row press"
          onClick={() => onNavigate(`/chats/${t.type}/${t.id}`)}
          style={{ cursor: "pointer" }}
        >
          <span aria-hidden="true" style={{ width: 40, height: 40, background: "var(--c-neutral-100)", color: "var(--c-base-contrast)", display: "flex", alignItems: "center", justifyContent: "center", font: "700 16px var(--font-masthead)", flexShrink: 0 }}>
            {t.name.slice(0, 1)}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ font: "600 15px var(--font-ui)", color: "var(--c-base-contrast)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.pinned ? "Pinned · " : ""}{t.name}
              </span>
              <span className="micro tabular">{t.lastAt !== null ? new Date(t.lastAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</span>
            </span>
            <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span className="micro tabular" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.preview}</span>
              {t.unread > 0 && (
                <span className="tabular" style={{ background: "var(--c-accent)", color: "var(--c-accent-contrast)", font: "600 11px var(--font-ui)", padding: "1px 6px", flexShrink: 0 }}>{t.unread}</span>
              )}
            </span>
          </span>
        </button>
      ))}

      <button
        type="button"
        className="press"
        aria-label="New chat"
        onClick={() => setPicker(true)}
        style={{ position: "fixed", bottom: 88, right: 16, minHeight: 56, minWidth: 56, background: "var(--c-accent)", color: "var(--c-accent-contrast)", border: "none", cursor: "pointer", font: "700 24px var(--font-ui)", zIndex: 20 }}
      >
        +
      </button>

      {picker && (
        <div role="dialog" aria-modal="true" aria-label="New chat" onClick={() => setPicker(false)} style={{ position: "fixed", inset: 0, background: "var(--c-scrim)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxHeight: "70%", overflowY: "auto", background: "var(--c-base)", borderTop: "1px solid var(--c-hairline)", padding: 16 }}>
            <div className="micro" style={{ paddingBottom: 8 }}>New chat</div>
            <input
              value={query} onChange={(e) => search(e.target.value)} placeholder="Search members by name or city" aria-label="Search members"
              style={{ width: "100%", minHeight: 44, border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "15px var(--font-ui)", color: "var(--c-base-contrast)" }}
            />
            {hits.map((m) => (
              <button key={m.id} type="button" className="row press" style={{ cursor: "pointer" }} onClick={() => onNavigate(`/chats/dm/${m.id}`)}>
                <span style={{ flex: 1, textAlign: "left", font: "500 15px var(--font-ui)" }}>
                  {m.display_name}
                  <span className="micro tabular">{m.set_year !== null ? ` · Set '${String(m.set_year).slice(-2)}` : ""} · {m.verification}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

export function ChatThreadScreen({ type, id, onNavigate, remoteTyping = null }: {
  type: "group" | "dm"; id: string; onNavigate: (to: string) => void;
  remoteTyping?: { threadId: string; name: string } | null;
}): React.ReactElement {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [typing, setTyping] = useState<string | null>(null);
  useEffect(() => {
    if (remoteTyping !== null && remoteTyping.threadId === id) {
      setTyping(remoteTyping.name);
      const t = setTimeout(() => setTyping(null), 3000);
      return () => clearTimeout(t);
    }
  }, [remoteTyping, id]);
  const [editing, setEditing] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const load = (): void => {
    Api.threadMessages(type, id).then((r) => setMessages(r.messages)).catch(() => setMessages([]));
  };
  useEffect(load, [type, id]);

  // Read receipt on open (I5: watermark moves; badges agree).
  useEffect(() => {
    void Api.markThreadRead(type, id).catch(() => undefined);
  }, [type, id, messages]);

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
      kind: "text", mediaId: null, isMine: true, replyTo: replyTo ? { id: replyTo.id, body: replyTo.body, author: replyTo.author } : null,
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

  if (messages === null) return <SkeletonList />;

  return (
    <main style={{ paddingBottom: 140 }}>
      <button type="button" className="btn btn--underline-link press" onClick={() => onNavigate(type === "group" ? `/groups/${id}` : "/chat")}>
        {type === "group" ? "Open group space" : "Back to chats"}
      </button>
      <div>
        {messages.map((m) => (
          <div key={m.id} style={{ borderBottom: "1px solid var(--c-hairline)", padding: "10px 16px", opacity: m.pending === true ? 0.6 : 1 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
              <span style={{ font: "600 13px var(--font-ui)" }}>{m.isMine ? "You" : m.author}</span>
              <span className="micro tabular">{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              {m.editedAt !== null && <span className="micro">edited</span>}
              {m.isMine && !m.pending && <span className="micro" style={{ marginLeft: "auto" }}>Sent</span>}
            </div>
            {m.replyTo !== null && (
              <div style={{ borderLeft: "2px solid var(--c-accent)", paddingLeft: 8, margin: "4px 0", font: "13px var(--font-ui)", color: "var(--c-neutral-500)" }}>
                {m.replyTo.author}: {m.replyTo.body}
              </div>
            )}
            <div style={{ font: "15px var(--font-ui)", color: "var(--c-base-contrast)" }}>{m.body}</div>
            <div style={{ display: "flex", gap: 12 }}>
              <button type="button" className="btn btn--underline-link press" style={{ minHeight: 28 }} onClick={() => setReplyTo(m)}>Reply</button>
              {m.isMine && (
                <>
                  <button type="button" className="btn btn--underline-link press" style={{ minHeight: 28 }} onClick={() => { setEditing(m.id); setDraft(m.body ?? ""); }}>Edit</button>
                  <button type="button" className="btn btn--underline-link press" style={{ minHeight: 28 }} onClick={() => void remove(m.id)}>Delete</button>
                </>
              )}
              {type === "group" && (
                <button type="button" className="btn btn--underline-link press" style={{ minHeight: 28 }} onClick={() => void pin(m.id)}>Pin to feed</button>
              )}
              <button type="button" className="btn btn--underline-link press" style={{ minHeight: 28 }} onClick={() => void Api.report({ messageId: m.id, reason: "Reported from chat" }).catch(() => undefined)}>Report</button>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {typing !== null && <div className="micro" style={{ padding: "4px 16px" }}>{typing} is typing</div>}

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, borderTop: "1px solid var(--c-hairline)", background: "var(--c-base)", display: "flex", gap: 8, padding: 8 }}>
        {replyTo !== null && (
          <span className="micro" style={{ alignSelf: "center" }}>Replying to {replyTo.author} · <button type="button" onClick={() => setReplyTo(null)}>cancel</button></span>
        )}
        <input
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void send(); }}
          placeholder={editing !== null ? "Edit your message…" : "Message"}
          aria-label="Message"
          style={{ flex: 1, minHeight: 44, border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "15px var(--font-ui)", color: "var(--c-base-contrast)" }}
        />
        <button type="button" className="btn btn--filled press" onClick={() => void send()}>{editing !== null ? "Save" : "Send"}</button>
      </div>
    </main>
  );
}

/** The chat thread embedded in the group space (desktop side-by-side, E3). */
export function ChatPane({ groupId, onNavigate }: { groupId: string; onNavigate: (to: string) => void }): React.ReactElement {
  return <ChatThreadScreen type="group" id={groupId} onNavigate={onNavigate} />;
}
