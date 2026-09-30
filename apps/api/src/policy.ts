/**
 * Policy engine (configuration.md §8): reads behavior config server-side.
 * Permissions stay enforced at the API (M5) — config changes what the policy
 * IS, never where it's enforced.
 */
import type { BehaviorPolicy, InstanceConfig, FeatureFlag } from "@fedites/config";

export type Action =
  | "dm.send"
  | "money.pay"
  | "event.rsvp"
  | "event.create"
  | "group.post"
  | "news.comment"
  | "vote.cast"
  | "face.search";

export interface PolicySubject {
  verified: boolean;
  honorary: boolean;
  roles: readonly string[];
  groupAdminOf?: readonly string[];
  vouchCount: number;
}

const DUTY_ROLES = new Set(["president", "treasurer", "secretary", "moderator", "editor"]);

export function hasDutyRole(roles: readonly string[]): boolean {
  return roles.some((r) => DUTY_ROLES.has(r));
}

/** True when the account is past the limited/probation stage (§P). */
export function isFullMember(policy: BehaviorPolicy, subject: PolicySubject): boolean {
  if (subject.honorary) return true;
  if (subject.verified) return true;
  if (policy.vouching.enabled && policy.vouching.adminOverride) {
    // Admin override can verify; limited members need setmates count or admin.
    return subject.vouchCount >= policy.vouching.setmatesRequired;
  }
  return subject.vouchCount >= policy.vouching.setmatesRequired;
}

export function evaluate(
  config: InstanceConfig,
  action: Action,
  subject: PolicySubject,
): { allowed: boolean; reason: string } {
  const policy = config.instance.behavior;

  switch (action) {
    case "group.post": {
      // Limited accounts may read everything and post in groups (§P).
      return { allowed: true, reason: "group posting open to all members" };
    }
    case "dm.send": {
      if (!policy.probationCapabilities.dms && !isFullMember(policy, subject)) {
        return { allowed: false, reason: "DMs unlock after verification (vouching or admin override)" };
      }
      return { allowed: true, reason: "member verified" };
    }
    case "money.pay": {
      if (!policy.probationCapabilities.money && !isFullMember(policy, subject)) {
        return { allowed: false, reason: "money features unlock after verification" };
      }
      return { allowed: true, reason: "member verified" };
    }
    case "event.rsvp": {
      if (!policy.probationCapabilities.eventRsvp && !isFullMember(policy, subject)) {
        return { allowed: false, reason: "event RSVP unlocks after verification" };
      }
      return { allowed: true, reason: "member verified" };
    }
    case "event.create": {
      const admins = subject.roles.some((r) => DUTY_ROLES.has(r) && r !== "editor") || hasDutyRole(subject.roles);
      const groupAdmin = (subject.groupAdminOf?.length ?? 0) > 0;
      if (policy.eventCreation === "admins-and-group-admins") {
        return admins || groupAdmin
          ? { allowed: true, reason: "admin or group admin" }
          : { allowed: false, reason: "events are created by admins and group admins only" };
      }
      return admins
        ? { allowed: true, reason: "admin" }
        : { allowed: false, reason: "events are created by admins only" };
    }
    case "news.comment": {
      return { allowed: true, reason: "comments admin-toggled per post; default handled per post" };
    }
    case "vote.cast": {
      // All verified members vote, regardless of dues status (§P).
      return subject.verified || subject.honorary
        ? { allowed: true, reason: "all verified members vote" }
        : { allowed: false, reason: "voting requires verification" };
    }
    case "face.search": {
      if (policy.faceSearch === "off") return { allowed: false, reason: "face search disabled" };
      return { allowed: true, reason: "self-only face search" };
    }
  }
}

export function flagEnabled(flags: readonly FeatureFlag[], key: string): boolean {
  return flags.some((f) => f.key === key && f.enabled);
}
