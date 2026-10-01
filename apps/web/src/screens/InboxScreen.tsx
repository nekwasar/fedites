/**
 * Notification inbox (1.4): one notification center (rail 2). Vouch-request
 * items carry the identify action for setmates. Library components only (M2).
 */
import React, { useEffect, useState } from "react";
import { Api } from "../api.js";
import { Row, Button, Empty as EmptyState, Skeleton, Badge, useVariant } from "@fedites/ui";
import type { Inbox, NotificationItem } from "@fedites/config";

export function InboxScreen({ onNavigate }: { onNavigate: (to: string) => void }): React.ReactElement {
  const variant = useVariant("row", "hairline");
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = (): void => {
    Api.inbox().then((v) => setInbox(v)).catch((e: Error) => setError(e.message));
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
    <main className="screen-pad">
      <h1 className="screen-title">Notifications</h1>
      <div style={{ padding: "0 var(--density-pad-x) var(--space-2)" }}>
        <Button kind="underline-link" small onClick={() => void Api.markAllRead().then(load)}>
          Mark all as read
        </Button>
      </div>
      <div>
        {inbox.items.map((item) => (
          <Row
            key={item.id}
            variant={variant as "hairline" | "zebra" | "stacked-meta"}
            as="button"
            onClick={() => void open(item)}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", font: (item.read ? "var(--weight-regular)" : "var(--weight-semibold)") + " var(--type-body) var(--font-ui)", color: "var(--c-base-contrast)" }}>
                {item.title}
              </span>
              <span className="micro tabular">{new Date(item.createdAt).toLocaleString()}</span>
            </span>
            {item.kind === "verification.vouch-request" && <Badge variant="outline">Identify</Badge>}
            {item.read !== true && <span aria-label="unread" style={{ width: 8, height: 8, background: "var(--c-accent)", display: "inline-block", flexShrink: 0 }} />}
          </Row>
        ))}
      </div>
    </main>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: React.ReactElement }): React.ReactElement {
  return <EmptyState title={title} body={body} action={action} />;
}

export function SkeletonList(): React.ReactElement {
  return (
    <div style={{ padding: "var(--density-pad-x)", display: "grid", gap: "var(--space-2)" }}>
      <Skeleton height="var(--type-headline)" />
      <Skeleton />
      <Skeleton />
      <Skeleton />
    </div>
  );
}
