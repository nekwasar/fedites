/**
 * Per-route data assembly for server-side rendering. Each page lists the
 * GET endpoints its screen needs with explicit payload names; the SSR layer
 * resolves them IN-PROCESS through the real Fastify routes (app.inject)
 * with the member's session cookie — M5 permission enforcement and §P
 * privacy are exactly what a signed-in browser would get. Nothing
 * page-level is ever fetched by the client; screens hydrate with this
 * data as props.
 *
 * The matcher mirrors apps/web/src/router.ts parseRoute (kept in sync).
 */
import type { FastifyInstance } from "fastify";

export type RouteData = Record<string, unknown>;

async function pick(app: FastifyInstance, url: string, cookie: string): Promise<unknown> {
  const res = await app.inject({ method: "GET", url, headers: cookie !== "" ? { cookie } : {} });
  if (res.statusCode !== 200) return undefined;
  return res.json();
}

/** Resolve every payload a screen needs for the given pathname (fail-soft:
 *  a failing endpoint is omitted and the screen renders its empty state). */
export async function assembleRouteData(
  app: FastifyInstance,
  pathname: string,
  cookie: string,
): Promise<RouteData> {
  const parts = pathname.split("/").filter(Boolean);
  const data: RouteData = {};
  const head = parts[0] ?? "";
  const param = parts[1];

  const load = async (key: string, entries: Array<[name: string, url: string]>): Promise<void> => {
    const results = await Promise.all(entries.map(([, u]) => pick(app, u, cookie)));
    const bundle: Record<string, unknown> = {};
    let any = false;
    entries.forEach(([name], i) => {
      if (results[i] !== undefined) { bundle[name] = results[i]; any = true; }
    });
    if (any) data[key] = bundle;
  };

  switch (true) {
    case parts.length === 0:
      await load("home", [["home", "/v1/groups/home"], ["browse", "/v1/groups"]]);
      break;
    case head === "feed":
      await load("feed", [["feed", "/v1/feed"]]);
      break;
    case head === "news":
      await load("news", [["news", "/v1/news"]]);
      break;
    case head === "chat" && parts.length === 1:
      await load("chat.list", [["threads", "/v1/chat/threads"], ["presence", "/v1/chat/presence"]]);
      break;
    case head === "chats" && parts.length === 3:
      await load("chat.thread", [["messages", `/v1/chat/${param === "dm" ? "dm" : "group"}/${parts[2]}/messages`]]);
      break;
    case head === "groups" && param !== undefined && param !== "new":
      await load("group", [["profile", `/v1/groups/${param}`], ["activity", `/v1/groups/${param}/activity`], ["requests", `/v1/groups/${param}/requests`]]);
      break;
    case head === "events" && parts.length === 1:
      await load("events", [["events", "/v1/events"]]);
      break;
    case head === "events" && parts.length === 2:
      await load("event", [["event", `/v1/events/${param}`], ["ticket", `/v1/events/${param}/my-ticket`], ["tasks", `/v1/events/${param}/tasks`], ["attendees", `/v1/events/${param}/attendees`], ["live", `/v1/events/${param}/live-counts`]]);
      break;
    case head === "money" && param === "campaigns" && parts.length === 3:
      await load("campaign", [["campaigns", "/v1/money/campaigns"], ["wall", `/v1/money/campaigns/${parts[2]}/donors`]]);
      break;
    case head === "money" && param === "campaigns":
      await load("giving", [["campaigns", "/v1/money/campaigns"], ["schedules", "/v1/money/schedules"], ["overview", "/v1/money/overview"]]);
      break;
    case head === "money" && param === "ledger":
      await load("ledger", [["ledger", "/v1/money/transparent-ledger"]]);
      break;
    case head === "memory":
      await load("memory", [["throwbacks", "/v1/memory/throwbacks"], ["eras", "/v1/memory/eras"], ["yearbooks", "/v1/memory/yearbooks"], ["onThisDay", "/v1/memory/on-this-day"], ["honourees", "/v1/memory/hall-of-fame"], ["memorials", "/v1/memory/memorials"]]);
      break;
    case head === "knowledge":
      await load("knowledge", [["timeline", "/v1/timeline"], ["spotlights", "/v1/spotlights"], ["articles", "/v1/articles"]]);
      break;
    case head === "nostalgia":
      await load("nostalgia", [["threads", "/v1/nostalgia/remember-when"], ["recipes", "/v1/nostalgia/recipes"], ["tracks", "/v1/nostalgia/radio"], ["anthem", "/v1/nostalgia/anthem"]]);
      break;
    case head === "bridge":
      await load("bridge", [["wishlist", "/v1/bridge/wishlist"], ["projects", "/v1/bridge/projects"], ["questions", "/v1/bridge/past-questions"], ["tributes", "/v1/bridge/teacher-tributes"], ["bookings", "/v1/bridge/bookings"]]);
      break;
    case head === "careers":
      await load("career", [["jobs", "/v1/career/jobs"], ["saved", "/v1/career/saved"], ["applications", "/v1/career/my-applications"]]);
      break;
    case head === "notifications":
      await load("inbox", [["inbox", "/v1/notifications"]]);
      break;
    case head === "me" || head === "menu":
      await load("profile", [["status", "/v1/verification/status"], ["invites", "/v1/invites"], ["recognition", "/v1/recognition/me"], ["intents", "/v1/me/intents"], ["prefs", "/v1/me/notification-prefs"]]);
      break;
    case head === "id":
      await load("id", [["card", "/v1/me/id"]]);
      break;
    case head === "members" && param !== undefined:
      await load("member", [["member", `/v1/members/${param}`], ["badges", `/v1/members/${param}/recognition`]]);
      break;
    case head === "manage":
      await load("manage", [["overview", "/v1/manage/overview"], ["queue", "/v1/manage/queue"]]);
      break;
    default:
      break;
  }
  return data;
}
