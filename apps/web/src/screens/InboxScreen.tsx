/**
 * Notification inbox (1.4): one notification center (rail 2). Vouch-request
 * items carry the identify action for setmates.
 */
import React, { useEffect, useState } from "react";
import { Api } from "../api.js";
import type { Inbox, NotificationItem } from "@fedites/config";

export function InboxScreen({ onNavigate }: { onNavigate: (to: string) => void }): React.ReactElement {
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = (): void => {
    Api.inbox().then(setInbox).catch((e: Error) => setError(e.message));
  };
  useEffect(load, []);

  const open = async (item: NotificationItem): Promise<void> => {
    await Api.markRead(item.id).catch(() => undefined);
    if (item.kind === "verification.vouch-request" && typeof item.payload.memberId === "string") {
      onNavigate(`/members/${item.payload.memberId}`);
      return;
    }
    load();
  };

  if (error !== null) return <Empty title="Could not load notifications" body="Check your connection, then try again." />;
  if (inbox === null) return <SkeletonList />;
  if (inbox.items.length === 0) return <Empty title="You are all caught up" body="Mentions, verification requests, and receipts land here." />;

  return (
    <main style={{ paddingBottom: 96 }}>
      <h1 className="screen-title">Notifications</h1>
      <div style={{ padding: "0 16px 8px" }}>
        <button type="button" className="btn btn--underline-link press" onClick={() => void Api.markAllRead().then(load)}>
          Mark all as read
        </button>
      </div>
      <div>
        {inbox.items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="row press"
            style={{ border: "none", borderBottom: "1px solid var(--c-hairline)", cursor: "pointer", textAlign: "left" }}
            onClick={() => void open(item)}
          >
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", font: item.read ? "400 15px var(--font-ui)" : "600 15px var(--font-ui)", color: "var(--c-base-contrast)" }}>
                {item.title}
              </span>
              <span className="micro tabular">{new Date(item.createdAt).toLocaleString()}</span>
            </span>
            {item.kind === "verification.vouch-request" && <span className="micro" style={{ color: "var(--c-accent)" }}>Identify</span>}
            {!item.read && <span aria-label="unread" style={{ width: 8, height: 8, background: "var(--c-accent)", display: "inline-block" }} />}
          </button>
        ))}
      </div>
    </main>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: React.ReactElement }): React.ReactElement {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function SkeletonList(): React.ReactElement {
  return (
    <div style={{ padding: 16, display: "grid", gap: 8 }}>
      <div className="skeleton" style={{ height: 32, maxWidth: 240 }} />
      <div className="skeleton" style={{ height: 16 }} />
      <div className="skeleton" style={{ height: 16 }} />
      <div className="skeleton" style={{ height: 16, maxWidth: 320 }} />
    </div>
  );
}
