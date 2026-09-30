/**
 * I5 — badges never lie. THE one implementation of unread/unseen counts,
 * used by Chat threads, Groups home rows, and the top bar. Chat unread and
 * Groups-home unread come from the same query shape, so they can never
 * disagree (same thread, two doors, one shared unread count).
 */
import type { Pool } from "pg";

export interface ThreadUnread {
  chatUnread: number;
  newPosts: number;
  newPhotos: number;
}

/** Unread chat messages + unseen activity for one member in one group thread. */
export async function groupThreadUnread(
  pool: Pool,
  memberId: string,
  groupId: string,
): Promise<ThreadUnread> {
  const res = await pool.query<{ chat_unread: string; new_posts: string; new_photos: string }>(
    `SELECT
       (SELECT count(*) FROM messages m
         WHERE m.instance_id = (SELECT instance_id FROM groups WHERE id = $2)
           AND m.group_id = $2 AND m.author_id <> $1 AND m.deleted_at IS NULL
           AND m.created_at > COALESCE((SELECT last_read_at FROM thread_reads
              WHERE member_id = $1 AND thread_type = 'group' AND thread_id = $2), to_timestamp(0)))::text AS chat_unread,
       (SELECT count(*) FROM activity_posts p
         WHERE p.group_id = $2 AND p.archived_at IS NULL AND p.kind IN ('post','poll','event','file')
           AND p.created_at > COALESCE((SELECT activity_seen_at FROM thread_reads
              WHERE member_id = $1 AND thread_type = 'group' AND thread_id = $2), to_timestamp(0)))::text AS new_posts,
       (SELECT count(*) FROM activity_posts p
         WHERE p.group_id = $2 AND p.archived_at IS NULL AND p.kind = 'photo'
           AND p.created_at > COALESCE((SELECT activity_seen_at FROM thread_reads
              WHERE member_id = $1 AND thread_type = 'group' AND thread_id = $2), to_timestamp(0)))::text AS new_photos`,
    [memberId, groupId],
  );
  const r = res.rows[0];
  return {
    chatUnread: Number(r?.chat_unread ?? 0),
    newPosts: Number(r?.new_posts ?? 0),
    newPhotos: Number(r?.new_photos ?? 0),
  };
}

/** DM unread for one member against one other member. */
export async function dmUnread(pool: Pool, memberId: string, otherId: string): Promise<number> {
  const res = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM messages m
     WHERE m.instance_id = (SELECT instance_id FROM members WHERE id = $2)
       AND m.dm_a = LEAST($1,$2)::uuid AND m.dm_b = GREATEST($1,$2)::uuid
       AND m.author_id <> $1 AND m.deleted_at IS NULL
       AND m.created_at > COALESCE((SELECT last_read_at FROM thread_reads
          WHERE member_id = $1 AND thread_type = 'dm' AND thread_id = $2), to_timestamp(0))`,
    [memberId, otherId],
  );
  return Number(res.rows[0]?.n ?? 0);
}

/** Update the chat watermark (read receipts) for a thread. */
export async function markChatRead(
  pool: Pool,
  instanceId: string,
  memberId: string,
  threadType: "group" | "dm",
  threadId: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO thread_reads (instance_id, member_id, thread_type, thread_id, last_read_at)
     VALUES ($1,$2,$3,$4, now())
     ON CONFLICT (member_id, thread_type, thread_id)
     DO UPDATE SET last_read_at = now()`,
    [instanceId, memberId, threadType, threadId],
  );
}

/** Update the activity watermark for a group (drives unseen-activity tags). */
export async function markActivitySeen(
  pool: Pool,
  instanceId: string,
  memberId: string,
  groupId: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO thread_reads (instance_id, member_id, thread_type, thread_id, activity_seen_at)
     VALUES ($1,$2,'group',$3, now())
     ON CONFLICT (member_id, thread_type, thread_id)
     DO UPDATE SET activity_seen_at = now()`,
    [instanceId, memberId, groupId],
  );
}
