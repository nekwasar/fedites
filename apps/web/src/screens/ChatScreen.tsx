/**
 * Chat screen (MODULE 1): composes the registries + the shared hook. No
 * business logic, no styling constants — just factory wiring from config.
 */
import React from "react";
import { useChatPage } from "../hooks/useChatPage.js";
import { ChatHeaderRegistry, ChatItemRegistry, ChatFilterChips, ChatFab } from "../chat/ChatRegistries.js";
import { Row, Avatar, Skeleton, Empty as EmptyState } from "@fedites/ui";
import type { ChatThread } from "../phase2-types.js";

export function ChatListScreen({ config, onNavigate }: {
  config: import("@fedites/config").ChatPageConfig;
  onNavigate: (to: string) => void;
}): React.ReactElement {
  const state = useChatPage(config, (type, id) => onNavigate(`/chats/${type}/${id}`));

  return (
    <main className="screen-pad">
      <ChatHeaderRegistry variant={state.config.headerVariant} state={state} />
      <ChatFilterChips state={state} />

      {state.threads === null && <SkeletonList />}
      {state.threads !== null && state.threads.length === 0 && (
        <EmptyState
          title="No conversations yet"
          body="Group chats and private chats show up here."
        />
      )}
      {state.threads !== null && state.threads.map((t: ChatThread) => (
        <ChatItemRegistry key={`${t.type}:${t.id}`} variant={state.config.itemVariant} data={t} state={state} />
      ))}

      <ChatFab config={state.config.fab} onClick={() => state.setPickerOpen(true)} />

      {state.pickerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="New chat"
          onClick={() => state.setPickerOpen(false)}
          className="overlay"
          style={{ alignItems: "flex-end" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxHeight: "70%", overflowY: "auto", background: "var(--c-base)", borderTop: "2px solid var(--c-accent)", padding: "var(--space-4)" }}
          >
            <div className="micro" style={{ paddingBottom: "var(--space-2)" }}>New chat</div>
            <input
              value={state.query}
              onChange={(e) => state.searchMembers(e.target.value)}
              placeholder="Search members by name or city"
              aria-label="Search members"
              className="field__input"
            />
            {state.hits.map((m) => (
              <Row key={m.id} as="button" onClick={() => state.openThread("dm", m.id)}>
                <Avatar name={m.display_name} variant="circled" />
                <span className="row-main">
                  <span style={{ font: "var(--weight-medium) var(--type-body) var(--font-ui)" }}>{m.display_name}</span>
                  <span className="micro tabular">{m.set_year !== null ? `Set '${String(m.set_year).slice(-2)}` : ""} · {m.verification}</span>
                </span>
              </Row>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

function SkeletonList(): React.ReactElement {
  return (
    <div style={{ padding: "var(--density-pad-x)", display: "grid", gap: "var(--space-2)" }}>
      <Skeleton />
      <Skeleton />
      <Skeleton />
      <Skeleton />
    </div>
  );
}
