/**
 * Route parsing — pure and SSR-safe. With full-page server rendering,
 * navigation is real document navigation (plain anchors assign location);
 * the route object is derived from the pathname per request.
 */
export interface Route {
  path: string;
  param?: string;
  seg?: string;
}

export function parseRoute(pathname: string): Route {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return { path: "/" };
  if (parts[0] === "members" && parts[1]) return { path: "/members", param: parts[1] };
  if (parts[0] === "chats") return { path: "/chats", param: parts[2], seg: parts[1] };
  if (parts[0] === "money") {
    if (parts[1] === "campaigns" && parts[2]) return { path: "/money/campaigns", param: parts[2] };
    if (parts[1] === "campaigns") return { path: "/money/campaigns" };
    if (parts[1] === "ledger") return { path: "/money/ledger" };
  }
  return { path: `/${parts[0]}` };
}
