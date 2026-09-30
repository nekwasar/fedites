/**
 * Session boot client (configuration.md §8): the API returns config at
 * session boot; the shell renders entirely from it — schema-driven shell.
 */
import type { SessionBoot, NavItemView } from "@fedites/config";
import { visibleItems, patternFor } from "@fedites/config";

export interface BootState {
  session: SessionBoot;
  navItems: NavItemView[];
  pattern: string;
}

export async function fetchSessionBoot(apiUrl: string, params: URLSearchParams): Promise<BootState> {
  const query = params.toString();
  const res = await fetch(`${apiUrl}/v1/config${query ? `?${query}` : ""}`);
  if (!res.ok) throw new Error(`session boot failed: ${res.status}`);
  const session = (await res.json()) as SessionBoot;

  const member = session.member;
  const hasDutyRole = member !== null && member.roles.some((r) => r !== "member");
  const navItems = visibleItems(session.config.nav, hasDutyRole);
  const device =
    params.get("device") === "mobile" || params.get("device") === "desktop"
      ? (params.get("device") as "mobile" | "desktop")
      : window.innerWidth < 1024
        ? "mobile"
        : "desktop";
  return {
    session,
    navItems,
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
