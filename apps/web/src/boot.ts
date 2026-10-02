/**
 * Session boot derivation (configuration.md §8): the shell renders entirely
 * from the boot payload. Derivation is pure so the Fastify server can run
 * it during server-side rendering with a device guess from the user agent.
 */
import type { SessionBoot } from "@fedites/config";
import { visibleItems, patternFor } from "@fedites/config";
import type { BootState } from "./page-types.js";

export type { BootState };

export function deriveBootState(session: SessionBoot, device: "mobile" | "desktop"): BootState {
  const member = session.member;
  const hasDutyRole = member !== null && member.roles.some((r) => r !== "member");
  return {
    session,
    navItems: visibleItems(session.config.nav, hasDutyRole),
    pattern: patternFor(
      {
        family: session.resolved.family,
        theme: session.resolved.theme as unknown as Parameters<typeof patternFor>[0]["theme"],
        themeDark: session.resolved.themeDark as unknown as Parameters<typeof patternFor>[0]["themeDark"],
        variants: session.resolved.variants,
        nav: session.config.nav,
      },
      device,
    ),
  };
}

export function deviceFromUserAgent(ua: string | undefined): "mobile" | "desktop" {
  return /Mobile|Android|iPhone/i.test(ua ?? "") ? "mobile" : "desktop";
}
