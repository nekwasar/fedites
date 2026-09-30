import { describe, it, expect } from "vitest";
import { defaultConfig } from "@fedites/config";
import { evaluate, isFullMember, hasDutyRole, type PolicySubject } from "./policy.js";

const config = defaultConfig;

const verified: PolicySubject = {
  verified: true, honorary: false, roles: ["member"], vouchCount: 0,
};
const limited: PolicySubject = {
  verified: false, honorary: false, roles: ["member"], vouchCount: 0,
};
const vouched: PolicySubject = {
  verified: false, honorary: false, roles: ["member"], vouchCount: 3,
};
const president: PolicySubject = {
  verified: true, honorary: false, roles: ["president"], vouchCount: 0,
};
const groupAdmin: PolicySubject = {
  verified: true, honorary: false, roles: ["member"], groupAdminOf: ["g1"], vouchCount: 0,
};

describe("policy engine (M5 — enforced at the API, config-driven)", () => {
  it("limited accounts can read and post in groups (rules §P)", () => {
    expect(evaluate(config, "group.post", limited).allowed).toBe(true);
  });

  it("limited accounts cannot DM, pay, or RSVP until vouched by 3 setmates", () => {
    expect(evaluate(config, "dm.send", limited).allowed).toBe(false);
    expect(evaluate(config, "money.pay", limited).allowed).toBe(false);
    expect(evaluate(config, "event.rsvp", limited).allowed).toBe(false);
    expect(isFullMember(config.instance.behavior, limited)).toBe(false);

    expect(evaluate(config, "dm.send", vouched).allowed).toBe(true);
    expect(evaluate(config, "money.pay", vouched).allowed).toBe(true);
  });

  it("verified members unlock everything", () => {
    expect(evaluate(config, "dm.send", verified).allowed).toBe(true);
    expect(evaluate(config, "money.pay", verified).allowed).toBe(true);
    expect(evaluate(config, "event.rsvp", verified).allowed).toBe(true);
  });

  it("events are created by admins and group admins only (§P)", () => {
    expect(evaluate(config, "event.create", verified).allowed).toBe(false);
    expect(evaluate(config, "event.create", president).allowed).toBe(true);
    expect(evaluate(config, "event.create", groupAdmin).allowed).toBe(true);
  });

  it("all verified members vote regardless of dues (§P)", () => {
    expect(evaluate(config, "vote.cast", verified).allowed).toBe(true);
    expect(evaluate(config, "vote.cast", limited).allowed).toBe(false);
  });

  it("face search is self-only by config", () => {
    expect(evaluate(config, "face.search", verified).allowed).toBe(true);
    const off = structuredClone(config);
    off.instance.behavior.faceSearch = "off";
    expect(evaluate(off, "face.search", verified).allowed).toBe(false);
  });

  it("config changes what the policy is (admin-settable)", () => {
    const openDms = structuredClone(config);
    openDms.instance.behavior.probationCapabilities.dms = true;
    expect(evaluate(openDms, "dm.send", limited).allowed).toBe(true);
  });

  it("duty roles drive the Manage tab visibility", () => {
    expect(hasDutyRole(president.roles)).toBe(true);
    expect(hasDutyRole(verified.roles)).toBe(false);
  });
});
