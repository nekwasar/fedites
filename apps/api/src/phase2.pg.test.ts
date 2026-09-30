/**
 * PG integration — Phase 2 (phases.md 2.1–2.6).
 * All 6 group types joinable per rules; a Facebook-groups-style day in
 * Set '98; WhatsApp chat behavior with badges that agree (I5); news gates;
 * feed guards; moderation with audit trail. Runs when TEST_DATABASE_URL set.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { createPool, migrate, seed } from "@fedites/db";
import { buildApp } from "./server.js";
import { hashPassword } from "./password.js";

const url = process.env.TEST_DATABASE_URL ?? "";
const run = url ? it : it.skip;

interface Ctx {
  pool: Pool; app: FastifyInstance; instanceId: string;
  cookies: Record<string, string>; ids: Record<string, string>;
}
let ctx: Ctx | undefined;

interface PollOption { id: string; label: string; votes: number }
interface Poll { options: PollOption[] | null; myVote: string | null }
interface ActivityItem { id: string; body: string | null; poll: Poll | null; reactions: Record<string, number> }
interface ActivityResponse { items: ActivityItem[] }

async function loginAs(app: FastifyInstance, email: string): Promise<string> {
  const res = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: "demopass123" } });
  if (res.statusCode !== 200) throw new Error(`login failed for ${email}: ${res.body}`);
  return res.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

describe("phase 2 — daily loop", () => {
  beforeAll(async () => {
    if (!url) return;
    const pool = createPool(url);
    await migrate(pool);
    await seed(pool);
    const instanceId = (await pool.query<{ id: string }>("SELECT id FROM instances LIMIT 1")).rows[0]!.id;
    const members = await pool.query<{ id: string; email: string }>("SELECT id, email FROM members WHERE instance_id = $1", [instanceId]);
    for (const m of members.rows) {
      await pool.query("UPDATE members SET password_hash = $1 WHERE id = $2", [await hashPassword("demopass123"), m.id]);
    }
    const app = await buildApp({ pool, defaultInstanceId: instanceId });
    const ids: Record<string, string> = {};
    for (const m of members.rows) ids[m.email.split("@")[0]!] = m.id;
    const groups = await pool.query<{ id: string; name: string }>("SELECT id, name FROM groups WHERE instance_id = $1", [instanceId]);
    for (const g of groups.rows) ids[g.name] = g.id;
    ctx = {
      pool, app, instanceId, ids,
      cookies: {
        president: await loginAs(app, "president@example.test"),
        member1: await loginAs(app, "member1@example.test"),
        member2: await loginAs(app, "member2@example.test"),
        member3: await loginAs(app, "member3@example.test"),
        member4: await loginAs(app, "member4@example.test"),
        moderator: await loginAs(app, "moderator@example.test"),
      },
    };
  });

  afterAll(async () => {
    if (ctx) await ctx.pool.end();
  });

  run("2.1 — all 6 group types exist and join per rules", async () => {
    const { app, cookies } = ctx!;
    const browse = await app.inject({ method: "GET", url: "/v1/groups", headers: { cookie: cookies.member1 } });
    const groups = (browse.json() as { groups: Array<{ id: string; type: string; joined: boolean }> }).groups;
    for (const t of ["set", "chapter", "interest", "guild", "house", "committee"]) {
      expect(groups.some((g) => g.type === t), t).toBe(true);
    }

    // member3 (Set '96) not in the Lagos chapter → one-tap join
    const chapter = groups.find((g) => g.type === "chapter" && !g.joined);
    expect(chapter).toBeTruthy();
    const join = await app.inject({ method: "POST", url: `/v1/groups/${chapter!.id}/join`, headers: { cookie: cookies.member3 } });
    expect((join.json() as { joined: boolean }).joined).toBe(true);

    // guild → request to join, then admin approves
    // president proposes + immediately cannot self-approve as member; guild
    // creation by a member starts as a proposal → duty admin approves it
    const create = await app.inject({ method: "POST", url: "/v1/groups", headers: { cookie: cookies.member3 }, payload: { type: "guild", name: "Founders Guild" } });
    expect(create.statusCode).toBe(200);
    expect((create.json() as { status: string }).status).toBe("proposed");
    const guildId = (create.json() as { id: string }).id;
    const approveProposal = await app.inject({ method: "POST", url: `/v1/groups/${guildId}/approve`, headers: { cookie: cookies.president } });
    expect(approveProposal.statusCode).toBe(200);
    // request to join → group admin (creator) approves
    const requestJoin = await app.inject({ method: "POST", url: `/v1/groups/${guildId}/join`, headers: { cookie: cookies.member1 } });
    expect((requestJoin.json() as { requested: boolean }).requested).toBe(true);
    const queue = await app.inject({ method: "GET", url: `/v1/groups/${guildId}/requests`, headers: { cookie: cookies.member3 } });
    const reqId = (queue.json() as { requests: Array<{ id: string }> }).requests[0]!.id;
    const approveJoin = await app.inject({ method: "POST", url: `/v1/groups/${guildId}/requests/${reqId}`, headers: { cookie: cookies.member3 }, payload: { decision: "approve" } });
    expect(approveJoin.statusCode).toBe(200);
    const profile = await app.inject({ method: "GET", url: `/v1/groups/${guildId}`, headers: { cookie: cookies.member1 } });
    expect((profile.json() as { my: { joined: boolean } }).my.joined).toBe(true);

    // committee is invite-only; houses auto-assigned
    const committee = groups.find((g) => g.type === "committee" && !g.joined);
    if (committee !== undefined) {
      const denied = await app.inject({ method: "POST", url: `/v1/groups/${committee.id}/join`, headers: { cookie: cookies.member3 } });
      expect(denied.statusCode).toBe(403);
    }
    const house = groups.find((g) => g.type === "house")!;
    const houseDenied = await app.inject({ method: "POST", url: `/v1/groups/${house.id}/join`, headers: { cookie: cookies.member3 } });
    expect(houseDenied.statusCode).toBe(403);

    // interest creation is a proposal → admin approval (lifecycle §6)
    const proposal = await app.inject({ method: "POST", url: "/v1/groups", headers: { cookie: cookies.member3 }, payload: { type: "interest", name: "Chess Circle" } });
    expect((proposal.json() as { status: string }).status).toBe("proposed");
    const proposalId = (proposal.json() as { id: string }).id;
    const approveChess = await app.inject({ method: "POST", url: `/v1/groups/${proposalId}/approve`, headers: { cookie: cookies.president } });
    expect(approveChess.statusCode).toBe(200);
  });

  run("2.2 — a Facebook-groups-style day in Set '98", async () => {
    const { app, cookies, ids } = ctx!;
    const set98 = ids["Set '98"];

    // posts + photos
    const post = await app.inject({ method: "POST", url: `/v1/groups/${set98}/activity`, headers: { cookie: cookies.member1 }, payload: { kind: "post", body: "Remember the tuck shop prices? N5 for meat pie." } });
    expect(post.statusCode).toBe(200);
    const postId = (post.json() as { id: string }).id;

    // threaded comments
    const c1 = await app.inject({ method: "POST", url: `/v1/activity/${postId}/comments`, headers: { cookie: cookies.member3 }, payload: { body: "Five naira! Those were the days." } });
    const c2 = await app.inject({ method: "POST", url: `/v1/activity/${postId}/comments`, headers: { cookie: cookies.president }, payload: { body: "I still owe someone N10.", parentId: (c1.json() as { id: string }).id } });
    expect(c1.statusCode).toBe(200);
    const comments = await app.inject({ method: "GET", url: `/v1/activity/${postId}/comments`, headers: { cookie: cookies.member1 } });
    const list = (comments.json() as { comments: Array<{ id: string; parentId: string | null }> }).comments;
    expect(list.find((c) => c.id === (c2.json() as { id: string }).id)?.parentId).toBe((c1.json() as { id: string }).id);

    // reactions: emoji-counts within the group (K2 — no user tables)
    const react = await app.inject({ method: "POST", url: `/v1/activity/${postId}/reactions`, headers: { cookie: cookies.president }, payload: { emoji: "laugh" } });
    expect((react.json() as { reactions: Record<string, number> }).reactions["laugh"]).toBe(1);

    // poll with vote + counts
    const poll = await app.inject({ method: "POST", url: `/v1/groups/${set98}/poll`, headers: { cookie: cookies.member1 }, payload: { body: "Reunion city?", options: ["Lagos", "London"] } });
    const pollId = (poll.json() as { id: string }).id;
    const detail = await app.inject({ method: "GET", url: `/v1/groups/${set98}/activity`, headers: { cookie: cookies.member1 } });
    const detailBody = detail.json() as ActivityResponse;
    const pollPost = detailBody.items.find((i) => i.id === pollId);
    const optionId = pollPost!.poll!.options![0]!.id;
    const vote = await app.inject({ method: "POST", url: `/v1/activity/${pollId}/vote`, headers: { cookie: cookies.member3 }, payload: { optionId } });
    expect(vote.statusCode).toBe(200);

    // admin pins the post (announcements land on top)
    const pin = await app.inject({ method: "POST", url: `/v1/activity/${postId}/pin`, headers: { cookie: cookies.president }, payload: {} });
    void pin;
    // member cannot pin
    const pinDenied = await app.inject({ method: "POST", url: `/v1/activity/${pollId}/pin`, headers: { cookie: cookies.member3 }, payload: {} });
    expect(pinDenied.statusCode).toBe(403);

    // activity unseen marks drive the home tags (member2 is Set '98)
    const seen = await app.inject({ method: "POST", url: `/v1/groups/${set98}/activity/seen`, headers: { cookie: cookies.member2 ?? cookies.member1 }, payload: {} });
    expect(seen.statusCode).toBe(200);
  });

  run("2.3 — chat: WhatsApp behavior, I5 badges agree, pin-to-feed", async () => {
    const { app, cookies, ids, pool } = ctx!;
    const set98 = ids["Set '98"];

    // member2 (Set '98) sends; member1 unread in Chat threads == Groups home row (I5)
    const send = await app.inject({ method: "POST", url: `/v1/chat/group/${set98}/messages`, headers: { cookie: cookies.member2 }, payload: { body: "Meeting moved to Saturday." } });
    expect(send.statusCode).toBe(200);
    const messageId = (send.json() as { id: string }).id;

    const threads = await app.inject({ method: "GET", url: "/v1/chat/threads", headers: { cookie: cookies.member1 } });
    const chatUnread = (threads.json() as { threads: Array<{ type: string; id: string; unread: number }> }).threads.find((t) => t.type === "group" && t.id === set98)!.unread;
    expect(chatUnread).toBeGreaterThanOrEqual(1);

    const home = await app.inject({ method: "GET", url: "/v1/groups/home", headers: { cookie: cookies.member1 } });
    const homeUnread = (home.json() as { myGroups: Array<{ id: string; unseen: { chatUnread: number } }> }).myGroups.find((g) => g.id === set98)!.unseen.chatUnread;
    expect(homeUnread).toBe(chatUnread);

    // read receipts: member1 reads → watermark moves → unread zero, receipt broadcast
    await app.inject({ method: "POST", url: `/v1/chat/group/${set98}/read`, headers: { cookie: cookies.member1 }, payload: {} });
    const after = await app.inject({ method: "GET", url: "/v1/chat/threads", headers: { cookie: cookies.member1 } });
    expect((after.json() as { threads: Array<{ id: string; unread: number }> }).threads.find((t) => t.id === set98)!.unread).toBe(0);

    // edit within window; "edited" shown
    const edit = await app.inject({ method: "PATCH", url: `/v1/chat/messages/${messageId}`, headers: { cookie: cookies.member2 }, payload: { body: "Meeting moved to Saturday, 4pm." } });
    expect(edit.statusCode).toBe(200);
    expect((edit.json() as { editedAt: string | null }).editedAt).toBeTruthy();

    // reply/quote
    const reply = await app.inject({ method: "POST", url: `/v1/chat/group/${set98}/messages`, headers: { cookie: cookies.member1 }, payload: { body: "Noted.", replyToId: messageId } });
    expect(reply.statusCode).toBe(200);

    // delete own anytime → tombstone
    const del = await app.inject({ method: "DELETE", url: `/v1/chat/messages/${messageId}`, headers: { cookie: cookies.member2 }, payload: {} });
    expect(del.statusCode).toBe(200);
    const gone = await pool.query("SELECT deleted_at IS NOT NULL AND body IS NULL AS gone FROM messages WHERE id = $1", [messageId]);
    expect(gone.rows[0]?.gone).toBe(true);

    // pin-to-feed bridge: a chat message becomes an Activity post
    const chatMsg = await app.inject({ method: "POST", url: `/v1/chat/group/${set98}/messages`, headers: { cookie: cookies.member1 }, payload: { body: "Dues link: pay before Friday." } });
    const chatMsgId = (chatMsg.json() as { id: string }).id;
    const pinned = await app.inject({ method: "POST", url: `/v1/chat/messages/${chatMsgId}/pin`, headers: { cookie: cookies.member2 }, payload: {} });
    expect(pinned.statusCode).toBe(200);
    const activity = await app.inject({ method: "GET", url: `/v1/groups/${set98}/activity`, headers: { cookie: cookies.member1 } });
    expect((activity.json() as { items: Array<{ body: string | null }> }).items.some((i) => i.body === "Dues link: pay before Friday.")).toBe(true);

    // DMs: verified member1 ↔ member3
    const dm = await app.inject({ method: "POST", url: `/v1/chat/dm/${ctx!.ids.member3}/messages`, headers: { cookie: cookies.member1 }, payload: { body: "Long time!" } });
    expect(dm.statusCode).toBe(200);
  });

  run("2.4 — news: admin composer, comments off by default, discuss-in-set-group, promote", async () => {
    const { app, cookies } = ctx!;

    // member cannot post news
    const denied = await app.inject({ method: "POST", url: "/v1/news", headers: { cookie: cookies.member1 }, payload: { body: "fake news" } });
    expect(denied.statusCode).toBe(403);

    // admin posts news; comments default off (config newsCommentsDefault)
    const news = await app.inject({ method: "POST", url: "/v1/news", headers: { cookie: cookies.president }, payload: { body: "AGM holds next month. Details in the constitution library." } });
    expect(news.statusCode).toBe(200);
    const newsId = (news.json() as { id: string }).id;

    const feed = await app.inject({ method: "GET", url: "/v1/news", headers: { cookie: cookies.member1 } });
    const newsRes = feed.json() as { items: Array<{ id: string; commentsEnabled: boolean }>; mySetGroup: { id: string } | null };
    const item = newsRes.items.find((i) => i.id === newsId)!;
    expect(item.commentsEnabled).toBe(false);
    expect(newsRes.mySetGroup).toBeTruthy(); // "discuss this in your set group"

    // comments off → server refuses (M5)
    const comment = await app.inject({ method: "POST", url: `/v1/activity/${newsId}/comments`, headers: { cookie: cookies.member1 }, payload: { body: "First!" } });
    expect(comment.statusCode).toBe(403);

    // reactions always on
    const react = await app.inject({ method: "POST", url: `/v1/activity/${newsId}/reactions`, headers: { cookie: cookies.member1 }, payload: { emoji: "thumb" } });
    expect(react.statusCode).toBe(200);

    // promote a group post into News with source attribution
    const set98 = ctx!.ids["Set '98"];
    const post = await app.inject({ method: "POST", url: `/v1/groups/${set98}/activity`, headers: { cookie: cookies.member1 }, payload: { kind: "post", body: "We renovated the chemistry lab block." } });
    const promote = await app.inject({ method: "POST", url: `/v1/activity/${(post.json() as { id: string }).id}/promote`, headers: { cookie: cookies.president }, payload: {} });
    expect(promote.statusCode).toBe(200);
    const newsFeed = await app.inject({ method: "GET", url: "/v1/news", headers: { cookie: cookies.member1 } });
    const promoted = (newsFeed.json() as { items: Array<{ id: string; promotedFrom: { name: string } | null }> }).items.find((i) => i.id === (promote.json() as { id: string }).id)!;
    expect(promoted.promotedFrom?.name).toBe("Set '98");
  });

  run("2.5 — feed: sources, guards, rails, less-from-this-group", async () => {
    const { app, cookies, ids, pool } = ctx!;

    const feed = await app.inject({ method: "GET", url: "/v1/feed", headers: { cookie: cookies.member1 } });
    const body = feed.json() as {
      items: Array<{ kind: string; groupId: string | null; groupName: string | null }>;
      rails: Array<{ key: string }>;
    };
    // every group item carries its source group (melt + crest per card)
    expect(body.items.every((i) => i.kind !== "news" || i.groupId === null)).toBe(true);
    expect(body.items.filter((i) => i.groupId !== null).every((i) => i.groupName !== null)).toBe(true);
    // rails exist (countdowns or suggested)
    expect(body.rails.length).toBeGreaterThanOrEqual(1);

    // committee content never leaks to non-members: post in exec committee as president
    const exec = ids["Executive Committee"];
    await app.inject({ method: "POST", url: `/v1/groups/${exec}/activity`, headers: { cookie: cookies.president }, payload: { kind: "post", body: "Confidential: budget review." } });
    const member1Feed = await app.inject({ method: "GET", url: "/v1/feed", headers: { cookie: cookies.member3 } });
    // member3 not in committee — but member3 is not a member, so not in group join → excluded by construction
    expect((member1Feed.json() as { items: Array<{ body: string | null }> }).items.every((i) => i.body !== "Confidential: budget review.")).toBe(true);

    // "less from this group": muted group's items drop out of member3's feed
    const lagos = ids["Lagos Chapter"];
    await app.inject({ method: "POST", url: `/v1/groups/${lagos}/join`, headers: { cookie: cookies.member4 } }).catch(() => undefined);
    await app.inject({ method: "POST", url: `/v1/groups/${lagos}/activity`, headers: { cookie: cookies.member4 }, payload: { kind: "post", body: "Lagos meetup photos soon." } });
    const mute = await app.inject({ method: "POST", url: `/v1/groups/${lagos}/feed-mute`, headers: { cookie: cookies.member4 }, payload: { muted: true } });
    expect(mute.statusCode).toBe(200);
    const muted = await app.inject({ method: "GET", url: "/v1/feed", headers: { cookie: cookies.member4 } });
    expect((muted.json() as { items: Array<{ groupId: string | null }> }).items.every((i) => i.groupId !== lagos)).toBe(true);

    // rail dismissal retires the rail
    await app.inject({ method: "POST", url: "/v1/feed/rails/suggested/dismiss", headers: { cookie: cookies.member1 }, payload: {} });
    const after = await app.inject({ method: "GET", url: "/v1/feed", headers: { cookie: cookies.member1 } });
    expect((after.json() as { rails: Array<{ key: string }> }).rails.every((r) => r.key !== "suggested")).toBe(true);
    void pool;
  });

  run("2.6 — moderation: report → remove with audit; escalation to moderators", async () => {
    const { app, cookies, ids, pool } = ctx!;
    const set98 = ids["Set '98"];

    // bad post → member reports it
    const bad = await app.inject({ method: "POST", url: `/v1/groups/${set98}/activity`, headers: { cookie: cookies.member2 }, payload: { kind: "post", body: "Buy cheap watches, DM me." } });
    const badId = (bad.json() as { id: string }).id;
    const report = await app.inject({ method: "POST", url: "/v1/reports", headers: { cookie: cookies.member1 }, payload: { postId: badId, reason: "Spam selling in the set group." } });
    expect(report.statusCode).toBe(200);

    // group admin (president is admin of set? president is Set '96 — use moderator who is admin?) —
    // member1 cannot decide (not group admin)
    const denied = await app.inject({ method: "POST", url: `/v1/reports/${(report.json() as { id: string }).id}`, headers: { cookie: cookies.member1 }, payload: { decision: "remove-content" } });
    expect(denied.statusCode).toBe(403);

    // school moderator decides → content archived, report resolved, audit written
    const decide = await app.inject({ method: "POST", url: `/v1/reports/${(report.json() as { id: string }).id}`, headers: { cookie: cookies.moderator }, payload: { decision: "remove-content", resolution: "Spam removed." } });
    expect(decide.statusCode).toBe(200);
    const activity = await app.inject({ method: "GET", url: `/v1/groups/${set98}/activity`, headers: { cookie: cookies.member1 } });
    expect((activity.json() as { items: Array<{ id: string }> }).items.every((i) => i.id !== badId)).toBe(true);
    const audit = await pool.query("SELECT 1 FROM audit_log WHERE action = 'moderation.decision' AND target = $1", [(report.json() as { id: string }).id]);
    expect(audit.rows.length).toBeGreaterThan(0);

    // escalation path: group admin escalates, school moderators see it
    const bad2 = await app.inject({ method: "POST", url: `/v1/groups/${set98}/activity`, headers: { cookie: cookies.member2 }, payload: { kind: "post", body: "Another suspicious link." } });
    const report2 = await app.inject({ method: "POST", url: "/v1/reports", headers: { cookie: cookies.member1 }, payload: { postId: (bad2.json() as { id: string }).id, reason: "Suspicious link, needs review." } });
    const esc = await app.inject({ method: "POST", url: `/v1/reports/${(report2.json() as { id: string }).id}`, headers: { cookie: cookies.president }, payload: { decision: "escalate" } });
    void esc;
    const queue = await app.inject({ method: "GET", url: "/v1/reports", headers: { cookie: cookies.moderator } });
    expect((queue.json() as { reports: Array<{ id: string; status: string }> }).reports.some((r) => r.id === (report2.json() as { id: string }).id && r.status === "escalated")).toBe(true);
  });
});
