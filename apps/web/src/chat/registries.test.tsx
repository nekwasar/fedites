/**
 * MODULE 1/2 registry tests — variants render structurally different
 * templates from the SAME shared hook state, driven purely by config.
 * No logic duplication: every variant consumes one ChatPageState /
 * CareersPageState.
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatHeaderRegistry, ChatItemRegistry, ChatFilterChips, ChatFab } from "./ChatRegistries.js";
import { CareersHeaderRegistry, JobCardRegistry, CareerFilterChips } from "../careers/CareerRegistries.js";
import { defaultConfig } from "@fedites/config";
import type { ChatPageState } from "../hooks/useChatPage.js";
import type { CareersPageState } from "../hooks/useCareersPage.js";
import type { ChatThread } from "../phase2-types.js";
import type { JobRow } from "../events-types.js";

const thread: ChatThread = {
  type: "group", id: "g1", name: "Set 1998", groupType: "set",
  lastAt: new Date(0).toISOString(), preview: "Reunion plan is live", unread: 3, pinned: true,
};

const job: JobRow = {
  id: "j1", title: "Graduate Trainee", companyName: "Acme", industry: "Energy",
  city: "Lagos", country: "Nigeria", employmentType: "graduate_trainee", workMode: "hybrid",
  salary: { minMinor: 50000000, maxMinor: 70000000, currency: "NGN" },
  applyBy: new Date(0).toISOString(), createdAt: new Date(0).toISOString(), poster: "Alum A", mine: false,
};

const chatState = {
  config: defaultConfig.chatPage,
  threads: [thread],
  counts: { all: 1, unread: 1, groups: 1, favorites: 1 },
  filter: "all",
  setFilter: () => undefined,
  query: "",
  setQuery: () => undefined,
  onlineIds: new Set<string>(["g1"]),
  pickerOpen: false,
  setPickerOpen: () => undefined,
  hits: [],
  searchMembers: () => undefined,
  openThread: () => undefined,
  reload: () => undefined,
} as unknown as ChatPageState;

const careersState = {
  config: defaultConfig.careersPage,
  jobs: [job],
  saved: [], savedIds: new Set<string>(),
  apps: [], appliedIds: new Set<string>(),
  activeChips: [], toggleChip: () => undefined,
  keywords: "", setKeywords: () => undefined, location: "", setLocation: () => undefined,
  note: null, setNote: () => undefined,
  posting: false, setPosting: () => undefined,
  pendingApply: null, setPendingApply: () => undefined,
  coverNote: "", setCoverNote: () => undefined,
  requestApply: () => undefined,
  confirmApply: async () => undefined,
  toggleSave: async () => undefined,
  reload: () => undefined,
} as unknown as CareersPageState;

const h = (el: React.ReactElement): string => renderToStaticMarkup(el);

describe("chat page registries (MODULE 1)", () => {
  it("standard header renders the clean title variant", () => {
    const html = h(React.createElement(ChatHeaderRegistry, { variant: "standard", state: chatState }));
    expect(html).toContain(">Chat</span>");
    expect(html).not.toContain("seg-tab");
  });

  it("messenger header renders the prominent search + presence row", () => {
    const html = h(React.createElement(ChatHeaderRegistry, { variant: "messenger", state: chatState }));
    expect(html).toContain("searchbar--prominent");
    expect(html).toContain("presence__dot");
  });

  it("telegram header renders segmented tabs with unread counts", () => {
    const html = h(React.createElement(ChatHeaderRegistry, { variant: "telegram", state: chatState }));
    expect(html).toContain("seg-tabs");
    expect(html).toContain("seg-tab__count");
  });

  it("same thread renders three distinct item templates from one state", () => {
    const standard = h(React.createElement(ChatItemRegistry, { variant: "standard", data: thread, state: chatState }));
    const card = h(React.createElement(ChatItemRegistry, { variant: "card", data: thread, state: chatState }));
    const dense = h(React.createElement(ChatItemRegistry, { variant: "dense", data: thread, state: chatState }));
    expect(standard).toContain("row-main");
    expect(card).toContain("tile__top");
    expect(dense).toContain("dense-row");
    // category badge derives from the API groupType, not a template constant
    expect(card).toContain("Set");
    // unread badge shown in all three from the same shared field
    expect(standard).toContain("3");
    expect(dense).toContain("dense-row__dot");
  });

  it("filter chips render from config with counts, honouring enabled=false", () => {
    const on = h(React.createElement(ChatFilterChips, { state: chatState }));
    expect(on).toContain("chip__count");
    const off = h(React.createElement(ChatFilterChips, {
      state: { ...chatState, config: { ...defaultConfig.chatPage, filterChips: { enabled: false, options: ["all"] } } } as unknown as ChatPageState,
    }));
    expect(off).toBe("");
  });

  it("telegram header suppresses the chip bar (tabs already filter)", () => {
    const suppressed = h(React.createElement(ChatFilterChips, {
      state: { ...chatState, config: { ...defaultConfig.chatPage, headerVariant: "telegram" } } as unknown as ChatPageState,
    }));
    expect(suppressed).toBe("");
  });

  it("fab placement is config-driven", () => {
    const center = h(React.createElement(ChatFab, { config: { placement: "bottom-center" }, onClick: () => undefined }));
    expect(center).toContain("fab");
  });
});

describe("careers page registries (MODULE 2)", () => {
  it("standard header renders title + sub-nav tabs", () => {
    const html = h(React.createElement(CareersHeaderRegistry, { variant: "standard", state: careersState, tab: "jobs", onTab: () => undefined }));
    expect(html).toContain("screen-title");
    expect(html).toContain("tabs__tab");
  });

  it("indeed header renders the stacked double search", () => {
    const html = h(React.createElement(CareersHeaderRegistry, { variant: "indeed", state: careersState, tab: "jobs", onTab: () => undefined }));
    expect(html).toContain("double-search");
  });

  it("linkedin header renders command head with filter pill", () => {
    const html = h(React.createElement(CareersHeaderRegistry, { variant: "linkedin", state: careersState, tab: "jobs", onTab: () => undefined }));
    expect(html).toContain("command-head");
  });

  it("same job renders three distinct card templates from one state", () => {
    const standard = h(React.createElement(JobCardRegistry, { variant: "standard", data: job, state: careersState }));
    const card = h(React.createElement(JobCardRegistry, { variant: "card", data: job, state: careersState }));
    const compact = h(React.createElement(JobCardRegistry, { variant: "compact", data: job, state: careersState }));
    // fresh-grad priority derived from employmentType in every variant
    expect(standard).toContain("500,000");
    expect(card).toContain("Fresh-Grad Priority");
    expect(compact).toContain("compact-job__salary");
    expect(card).toContain("500,000");
  });

  it("career filter chips map to hook filter state", () => {
    const html = h(React.createElement(CareerFilterChips, { state: careersState }));
    expect(html).toContain("Full-time");
    expect(html).toContain("Internship");
  });
});
