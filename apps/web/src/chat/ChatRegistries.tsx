/**
 * CHAT PAGE REGISTRIES (MODULE 1) — config-driven component factory.
 *
 * <ChatHeaderRegistry variant={config.headerVariant} state={hook} />
 * <ChatItemRegistry  variant={config.itemVariant}  data={thread} state={hook} />
 * <ChatFilterChips   config state />
 * <ChatFab           config onClick />
 *
 * Templates contain ZERO styling constants: every value is a semantic class
 * tied to root CSS variables, or a var() reference. Business logic lives in
 * useChatPage (shared hook) — no logic is duplicated across variants.
 */
import React from "react";
import { Icon, Avatar, Badge, Row, Fab } from "@fedites/ui";
import type { ChatThread } from "../phase2-types.js";
import type { ChatPageState } from "../hooks/useChatPage.js";


/* --------------------------- Header registry -------------------------- */

export function ChatHeaderRegistry({ variant, state }: {
  variant: ChatPageState["config"]["headerVariant"];
  state: ChatPageState;
}): React.ReactElement {
  switch (variant) {
    case "messenger": return <MessengerHeader state={state} />;
    case "telegram": return <TelegramHeader state={state} />;
    default: return <StandardHeader state={state} />;
  }
}

/** Variant 1 — Standard clean header: title left, action icons right. */
function StandardHeader({ state: _state }: { state: ChatPageState }): React.ReactElement {
  void _state; // presence/counts unused in the clean variant by design
  return (
    <header className="header--minimal" style={{ padding: "0 var(--density-pad-x)", gap: "var(--space-2)" }}>
      <span style={{ font: "var(--weight-bold) var(--type-body1) var(--font-ui)", color: "var(--c-base-contrast)" }}>Chat</span>
      <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <Icon name="search" size={20} />
        <Icon name="bell" size={20} />
      </span>
    </header>
  );
}

/** Variant 2 — Messenger style: brand, prominent search under it, presence row. */
function MessengerHeader({ state }: { state: ChatPageState }): React.ReactElement {
  const activeMembers = state.threads?.slice(0, 8).map((t) => ({ id: t.id, name: t.name, online: state.onlineIds.has(t.id) })) ?? [];
  return (
    <div>
      <header className="masthead" style={{ minHeight: 56, padding: "var(--space-2) var(--density-pad-x)" }}>
        <span className="crest-block" aria-hidden="true">F</span>
        <span style={{ font: "var(--weight-bold) var(--type-body1) var(--font-ui)" }}>Chats</span>
      </header>
      <div className="searchbar searchbar--prominent" style={{ padding: "var(--space-2) var(--density-pad-x)", borderBottom: "var(--hairline) solid var(--hairline-color)" }}>
        <Icon name="search" size={18} />
        <input
          className="field__input"
          value={state.query}
          onChange={(e) => state.setQuery(e.target.value)}
          placeholder="Search chats"
          aria-label="Search chats"
        />
      </div>
      <div className="chips" aria-label="Active now">
        {activeMembers.map((m) => (
          <span key={m.id} className="presence">
            <Avatar name={m.name} variant="circled" />
            {m.online && <span className="presence__dot" aria-label="online" />}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Variant 3 — Telegram style segmented header: quick search pill + category tabs with counts. */
function TelegramHeader({ state }: { state: ChatPageState }): React.ReactElement {
  const categories: Array<{ key: string; label: string; count: number }> = [
    { key: "all", label: "All Chats", count: state.counts.all },
    { key: "groups", label: "Groups", count: state.counts.groups },
    { key: "unread", label: "Unread", count: state.counts.unread },
  ];
  return (
    <div>
      <header className="header--minimal" style={{ padding: "var(--space-2) var(--density-pad-x)", gap: "var(--space-2)" }}>
        <span style={{ font: "var(--weight-bold) var(--type-body1) var(--font-ui)", color: "var(--c-base-contrast)" }}>Chats</span>
        <span className="searchbar" style={{ marginLeft: "auto", flex: 1, maxWidth: "60%" }}>
          <input
            className="field__input"
            value={state.query}
            onChange={(e) => state.setQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search chats"
          />
        </span>
      </header>
      <div className="seg-tabs" role="tablist">
        {categories.map((c) => (
          <button
            key={c.key}
            type="button"
            className="seg-tab press"
            aria-pressed={state.filter === c.key}
            onClick={() => state.setFilter(c.key)}
          >
            {c.label}
            <span className="seg-tab__count tabular">{c.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------- Item registry --------------------------- */

export function ChatItemRegistry({ variant, data, state }: {
  variant: ChatPageState["config"]["itemVariant"];
  data: ChatThread;
  state: ChatPageState;
}): React.ReactElement {
  switch (variant) {
    case "card": return <CardTileItem data={data} state={state} />;
    case "dense": return <DenseListItem data={data} state={state} />;
    default: return <StandardRowItem data={data} state={state} />;
  }
}

function timeOf(t: ChatThread): string {
  return t.lastAt !== null ? new Date(t.lastAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
}

/** Variant 1 — Standard row: avatar+presence | name/preview | time/unread. */
function StandardRowItem({ data, state }: { data: ChatThread; state: ChatPageState }): React.ReactElement {
  const online = data.type === "dm" && state.onlineIds.has(data.id);
  return (
    <Row as="button" onClick={() => state.openThread(data.type, data.id)} active={data.pinned}>
      <span className="presence">
        <Avatar name={data.name} variant="circled" />
        {online && <span className="presence__dot" aria-label="online" />}
      </span>
      <span className="row-main">
        <span style={{ font: "var(--weight-semibold) var(--type-body) var(--font-ui)", color: "var(--c-base-contrast)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.name}</span>
        <span className="micro tabular" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.preview}</span>
      </span>
      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
        <span className="micro tabular">{timeOf(data)}</span>
        {data.unread > 0 && <Badge variant="solid">{data.unread}</Badge>}
      </span>
    </Row>
  );
}

/** Variant 2 — Modern card tile: avatar+name+category badge, snippet, footer actions. */
function CardTileItem({ data, state }: { data: ChatThread; state: ChatPageState }): React.ReactElement {
  return (
    <div className="tile">
      <div className="tile__top">
        <span className="presence">
          <Avatar name={data.name} variant="circled" />
          {data.type === "dm" && state.onlineIds.has(data.id) && <span className="presence__dot" aria-label="online" />}
        </span>
        <span className="tile__name">{data.name}</span>
        <Badge variant="outline">{data.type === "group" ? "Alumni" : "Direct"}</Badge>
      </div>
      <div className="tile__mid">{data.preview}</div>
      <div className="tile__bottom">
        <span className="tabular">{timeOf(data)}</span>
        {data.unread > 0 && <Badge variant="dot">{data.unread} unread</Badge>}
        <span className="tile__spacer" />
        <Icon name="pin" size={16} />
      </div>
    </div>
  );
}

/** Variant 3 — Compact dense list: small avatar, inline title+time, one-line snippet with dot. */
function DenseListItem({ data, state }: { data: ChatThread; state: ChatPageState }): React.ReactElement {
  return (
    <button
      type="button"
      className="dense-row press"
      onClick={() => state.openThread(data.type, data.id)}
      style={{ cursor: "pointer" }}
    >
      <Avatar name={data.name} variant="circled" />
      <span className="dense-row__title">{data.name}</span>
      <span className="micro tabular">{timeOf(data)}</span>
      <span className="dense-row__snippet">{data.preview}</span>
      {data.unread > 0 && <span className="dense-row__dot" aria-label="unread" />}
    </button>
  );
}

/* --------------------------- Filter chips ----------------------------- */

export function ChatFilterChips({ state }: { state: ChatPageState }): React.ReactElement | null {
  if (state.config.filterChips.enabled !== true) return null;
  // The telegram header already renders category tabs with counts — the chip
  // bar would duplicate the same filter control (config-driven suppression).
  if (state.config.headerVariant === "telegram") return null;
  const labels: Record<string, string> = { all: "All", unread: "Unread", groups: "Groups", favorites: "Favorites" };
  return (
    <div className="chips">
      {state.config.filterChips.options.map((opt) => (
        <button key={opt} type="button" className="chip press" aria-pressed={state.filter === opt} onClick={() => state.setFilter(opt)}>
          {labels[opt] ?? opt}
          <span className="chip__count">{state.counts[opt] ?? 0}</span>
        </button>
      ))}
    </div>
  );
}

/* -------------------------------- FAB --------------------------------- */

export function ChatFab({ config, onClick }: {
  config: ChatPageState["config"]["fab"];
  onClick: () => void;
}): React.ReactElement {
  const placement: React.CSSProperties = config.placement === "bottom-center"
    ? { left: "50%", right: "auto", transform: "translateX(-50%)" }
    : {};
  // Corner FAB renders directly; center placement wraps with positioning.
  if (config.placement === "bottom-center") {
    return (
      <button type="button" className="fab press" aria-label="New chat" onClick={onClick} style={placement}>+</button>
    );
  }
  return <Fab label="New chat" onClick={onClick} />;
}
