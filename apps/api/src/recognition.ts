/**
 * Recognition engine (rail 6, session 3.4): one activity-points ledger that
 * badges, streaks, and founding status all read from.
 *
 * Rules honored:
 *  - K2: points/badges are member attributes — no public league tables, no
 *    follower counts. Reactions within groups stay emoji-counts.
 *  - K5: streaks are private to the member; no shaming copy, no nagging.
 *  - D1: badge names/descriptions carry no emojis.
 *  - M3: the engine is flag-gated (recognition.badges).
 */
import type { Pool } from "pg";

export const POINTS = {
  "activity.post": 5,
  "activity.comment": 2,
  "photo.upload": 5,
  "event.checkin": 10,
  "event.rsvp": 1,
  "verified": 20,
} as const;

export type PointKind = keyof typeof POINTS;

export const BADGES = {
  verified: { title: "Verified", description: "Confirmed by setmates or an admin." },
  founding: { title: "Founding member", description: "Joined in the first days of this community." },
  "first-post": { title: "First words", description: "Posted in a group for the first time." },
  conversationalist: { title: "Conversationalist", description: "Ten comments across the community." },
  shutterbug: { title: "Shutterbug", description: "Ten photos on event walls and groups." },
  "event-goer": { title: "Event-goer", description: "Checked in at three events." },
} as const;

export type BadgeKey = keyof typeof BADGES;

/** Badge thresholds evaluated against recognition_events. */
const BADGE_RULES: Array<{ badge: BadgeKey; kind: PointKind; count: number }> = [
  { badge: "first-post", kind: "activity.post", count: 1 },
  { badge: "conversationalist", kind: "activity.comment", count: 10 },
  { badge: "shutterbug", kind: "photo.upload", count: 10 },
  { badge: "event-goer", kind: "event.checkin", count: 3 },
];

function isoWeek(at: Date): number {
  const d = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return d.getUTCFullYear() * 100 + week;
}

export interface RecordResult {
  points: number;
  newBadges: BadgeKey[];
  streak: { current: number; longest: number };
}

/**
 * Record one activity, update the weekly streak, and evaluate badges.
 * Founding status is evaluated on verification by the caller.
 */
export async function record(
  pool: Pool,
  instanceId: string,
  memberId: string,
  kind: PointKind,
  ref?: { type: string; id: string },
): Promise<RecordResult> {
  const points = POINTS[kind];
  await pool.query(
    `INSERT INTO recognition_events (instance_id, member_id, kind, points, ref_type, ref_id)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [instanceId, memberId, kind, points, ref?.type ?? null, ref?.id ?? null],
  );
  if (kind === "verified") {
    await pool.query(
      `INSERT INTO member_badges (instance_id, member_id, badge) VALUES ($1,$2,'verified')
       ON CONFLICT (member_id, badge) DO NOTHING`,
      [instanceId, memberId],
    );
  }

  // Weekly streak (K5: private, no push reminders).
  const now = new Date();
  const thisWeek = isoWeek(now);
  const streakRes = await pool.query<{ current_weeks: number; longest_weeks: number; last_week: number | null }>(
    "SELECT current_weeks, longest_weeks, last_week FROM member_streaks WHERE member_id = $1",
    [memberId],
  );
  let current = 1;
  let longest = 1;
  const prev = streakRes.rows[0];
  if (prev !== undefined && prev.last_week !== null) {
    if (prev.last_week === thisWeek) {
      current = Math.max(prev.current_weeks, 1);
      longest = prev.longest_weeks;
    } else if (prev.last_week === thisWeek - 1) {
      current = prev.current_weeks + 1;
      longest = Math.max(prev.longest_weeks, current);
    } else {
      current = 1;
      longest = prev.longest_weeks;
    }
  }
  await pool.query(
    `INSERT INTO member_streaks (instance_id, member_id, current_weeks, longest_weeks, last_week, updated_at)
     VALUES ($1,$2,$3,$4,$5, now())
     ON CONFLICT (member_id) DO UPDATE SET
       current_weeks = $3, longest_weeks = $4, last_week = $5, updated_at = now()`,
    [instanceId, memberId, current, longest, thisWeek],
  );

  // Badge evaluation: thresholds over the one ledger.
  const newBadges: BadgeKey[] = [];
  for (const rule of BADGE_RULES) {
    if (rule.kind !== kind) continue;
    const has = await pool.query("SELECT 1 FROM member_badges WHERE member_id = $1 AND badge = $2", [memberId, rule.badge]);
    if (has.rows.length > 0) continue;
    const total = await pool.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM recognition_events WHERE member_id = $1 AND kind = $2",
      [memberId, rule.kind],
    );
    if (Number(total.rows[0]?.n ?? 0) >= rule.count) {
      await pool.query(
        `INSERT INTO member_badges (instance_id, member_id, badge) VALUES ($1,$2,$3)
         ON CONFLICT (member_id, badge) DO NOTHING`,
        [instanceId, memberId, rule.badge],
      );
      newBadges.push(rule.badge);
    }
  }

  return { points, newBadges, streak: { current, longest } };
}

/** Founding member status: verified within 30 days of instance creation (§P),
 *  or awarded manually by an admin. */
export async function evaluateFounding(
  pool: Pool,
  instanceId: string,
  memberId: string,
): Promise<boolean> {
  const has = await pool.query("SELECT 1 FROM member_badges WHERE member_id = $1 AND badge = 'founding'", [memberId]);
  if (has.rows.length > 0) return false;
  const res = await pool.query<{ days: string }>(
    `SELECT EXTRACT(day FROM now() - i.created_at)::text AS days
     FROM members m JOIN instances i ON i.id = m.instance_id WHERE m.id = $1`,
    [memberId],
  );
  const days = Number(res.rows[0]?.days ?? 9999);
  if (days > 30) return false;
  await pool.query(
    `INSERT INTO member_badges (instance_id, member_id, badge) VALUES ($1,$2,'founding')
     ON CONFLICT (member_id, badge) DO NOTHING`,
    [instanceId, memberId],
  );
  return true;
}
