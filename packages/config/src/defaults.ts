/**
 * Default instance config — the Fedites template preset (configuration.md §7:
 * "Fedites wine-red/white is itself the default preset").
 * This is a TEMPLATE, not an instance: real schools get their own config
 * document in the DB (configuration.md §8). Zero instance constants in code.
 */
import type { InstanceConfig } from "./schema.js";
import { defaultThemeId } from "./themes.js";

/**
 * Feature flags — all 112 MVP features flag-gated (configuration.md §6).
 * Phase 0 ships the rails; every incomplete feature is off by default (M3).
 */
export const defaultFlags: ReadonlyArray<{ key: string; enabled: boolean }> = [
  { key: "nav.groups", enabled: true },
  { key: "nav.feed", enabled: true },
  { key: "nav.chat", enabled: true },
  { key: "nav.events", enabled: true },
  { key: "nav.menu", enabled: true },
  { key: "nav.manage", enabled: false }, // appears for role-holders (Phase 1)
  { key: "rails.identity", enabled: true }, // Phase 1
  { key: "rails.verification", enabled: true },
  { key: "groups.engine", enabled: true }, // Phase 2
  { key: "groups.activity", enabled: true },
  { key: "groups.chat", enabled: true },
  { key: "news.bulletin", enabled: true },
  { key: "feed.personalized", enabled: true },
  { key: "events.core", enabled: true }, // Phase 3
  { key: "recognition.badges", enabled: false },
  { key: "money.dues", enabled: false }, // Phase 4
  { key: "money.donations", enabled: false },
  { key: "memory.lane", enabled: false }, // Phase 5
  { key: "govern.elections", enabled: false }, // Phase 6
  { key: "studio.editor", enabled: false }, // Phase 6
  // Phase 0 demo capability — never enabled in production (M3).
  { key: "demo.previewSession", enabled: true },
];

export const defaultConfig: InstanceConfig = {
  schemaVersion: 1,
  publishedAt: null,
  familyId: "fedites-classic",
  colorThemeId: defaultThemeId,
  nav: {
    mobile: "tab-bar",
    desktop: "side-rail",
    labels: {
      groups: "Groups",
      feed: "Feed",
      chat: "Chat",
      events: "Events",
      menu: "Menu",
      manage: "Manage",
    },
  },
  elementOverrides: {},
  instance: {
    displayName: "Fedites",
    shortName: "Fedites",
    terminology: {
      set: "Set",
      house: "House",
      group: "Group",
      dues: "Dues",
      agm: "AGM",
      chapter: "Chapter",
    },
    copy: {
      "tab.groups.job": "All your spaces and discovery",
      "tab.feed.job": "Personalized latest activity",
      "tab.chat.job": "Group chats and private chats",
      "tab.events.job": "Calendar, countdowns, your ticket",
      "tab.menu.job": "Profile, settings, directory",
      "empty.groups.title": "No groups yet",
      "empty.groups.body": "Your set group and house appear here once you are verified.",
      "empty.feed.title": "Nothing here yet",
      "empty.feed.body": "Activity from your groups will land in this feed.",
      "empty.chat.title": "No conversations yet",
      "empty.chat.body": "Group chats and private chats show up here.",
      "empty.events.title": "No events scheduled",
      "empty.events.body": "Reunions and meetups will appear with their countdowns.",
      "empty.menu.title": "Menu",
      "empty.menu.body": "Profile, settings, and the full feature catalog live here.",
      "preview.banner": "You are viewing the Studio preview. This is not a live school.",
    },
    flags: [...defaultFlags],
    groupTypes: [
      { type: "set", enabled: true, label: "Set group", joining: "auto-join" },
      { type: "chapter", enabled: true, label: "City chapter", joining: "one-tap" },
      { type: "interest", enabled: true, label: "Interest group", joining: "proposal" },
      { type: "guild", enabled: true, label: "Professional guild", joining: "request" },
      { type: "house", enabled: true, label: "Sports house", joining: "auto-assign" },
      { type: "committee", enabled: true, label: "Committee workspace", joining: "invite-only" },
    ],
    behavior: {
      vouching: { enabled: true, setmatesRequired: 3, adminOverride: true },
      probationCapabilities: {
        readEverything: true,
        groupPosts: true,
        dms: false,
        money: false,
        eventRsvp: false,
      },
      votingEligibility: "all-verified",
      eventCreation: "admins-and-group-admins",
      dues: { cycle: "annual", reminders: ["push", "whatsapp", "sms"] },
      emergencyBroadcast: "any-admin-plus-second-approval",
      chatEditWindowMinutes: 15,
      chatDeleteOwnAnytime: true,
      newsCommentsDefault: false,
      donorWallDefaultNamed: true,
      faceSearch: "self-only",
      locationPrecision: "city",
      quietHoursDefault: { enabled: true, start: "22:00", end: "07:00" },
    },
  },
};
