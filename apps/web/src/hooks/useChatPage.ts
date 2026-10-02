/**
 * Chat page hooks — business logic fully decoupled from variant templates.
 * The registries (MODULE 1 spec) render any of the three header/item
 * variants from the admin config object; the hook owns data, filters,
 * handlers. Nothing duplicated across variants.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Api } from "../api.js";
import type { ChatThread, MemberHit } from "../phase2-types.js";
import type { ChatPageConfig } from "@fedites/config";

export interface ChatFilters {
  all: (t: ChatThread) => boolean;
  unread: (t: ChatThread) => boolean;
  groups: (t: ChatThread) => boolean;
  favorites: (t: ChatThread) => boolean;
}

const FILTERS: ChatFilters = {
  all: () => true,
  unread: (t) => t.unread > 0,
  groups: (t) => t.type === "group",
  favorites: (t) => t.pinned,
};

export function useChatPage(config: ChatPageConfig, onOpenThread: (type: "group" | "dm", id: string) => void) {
  const [threads, setThreads] = useState<ChatThread[] | null>(null);
  const [filter, setFilter] = useState<string>(config.filterChips.options[0] ?? "all");
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  const load = useCallback((): void => {
    Api.chatThreads().then((r) => setThreads(r.threads)).catch(() => setThreads([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Presence: who is connected right now (WS hub, server-side truth).
  useEffect(() => {
    let alive = true;
    const tick = (): void => {
      Api.chatPresence().then((r) => { if (alive) setOnlineIds(new Set(r.online)); }).catch(() => undefined);
    };
    tick();
    const interval = setInterval(tick, 30_000);
    return () => { alive = false; clearInterval(interval); };
  }, []);

  const visible = useMemo(() => {
    if (threads === null) return null;
    const activeFilter = FILTERS[filter as keyof ChatFilters] ?? FILTERS.all;
    const term = query.trim().toLowerCase();
    return threads
      .filter(activeFilter)
      .filter((t) => term === "" || t.name.toLowerCase().includes(term) || t.preview.toLowerCase().includes(term));
  }, [threads, filter, query]);

  const counts = useMemo(() => {
    const base = { all: threads?.length ?? 0, unread: 0, groups: 0, favorites: 0 };
    for (const t of threads ?? []) {
      if (t.unread > 0) base.unread += 1;
      if (t.type === "group") base.groups += 1;
      if (t.pinned) base.favorites += 1;
    }
    return base;
  }, [threads]);

  // New-chat picker state (decoupled from variants).
  const [hits, setHits] = useState<MemberHit[]>([]);
  const searchMembers = useCallback((q: string): void => {
    Api.searchMembers(q).then((r) => setHits(r.members)).catch(() => undefined);
  }, []);
  const openThread = useCallback((type: "group" | "dm", id: string): void => {
    setPickerOpen(false);
    onOpenThread(type, id);
  }, [onOpenThread]);

  return {
    config,
    threads: visible,
    counts,
    filter, setFilter,
    query, setQuery,
    onlineIds,
    pickerOpen, setPickerOpen, hits, searchMembers, openThread,
    reload: load,
  };
}

export type ChatPageState = ReturnType<typeof useChatPage>;
