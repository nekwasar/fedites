/**
 * SSR shell payload contract. The Fastify server renders every page with
 * boot + route data fetched BEFORE render and inlines this payload into
 * the HTML. The client hydrates from it; page content is never loaded
 * client-side (no loaders, no fetch-on-mount). Interactivity only: WS
 * chat, forms, mutations whose responses update local state.
 */
import type { SessionBoot, SessionMember, NavItemView } from "@fedites/config";

export interface BootState {
  session: SessionBoot;
  navItems: NavItemView[];
  pattern: string;
}

export interface PageProps {
  boot: BootState;
  member: SessionMember | null;
  unread: number;
}

export interface AppProps extends PageProps {
  routeData: Record<string, unknown>;
  ssrPath?: string;
  ssrDevice?: "mobile" | "desktop";
}

declare global {
  interface Window { __PAGE__?: { boot: unknown; member: unknown; unread: number; data?: Record<string, unknown> } }
}
