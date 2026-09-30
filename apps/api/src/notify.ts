/**
 * Notification dispatcher v1 (1.4, rail 2): one notification center.
 * Phase 1 delivers the in-app inbox; push / email digest / WhatsApp bridge /
 * SMS fallback are channels the same message routes through in later phases
 * (J5). Quiet hours (J4) already gate the future push path via the instance
 * behavior config; in-app inbox rows are always written.
 */
import type { Pool } from "pg";
import type { InstanceConfig } from "@fedites/config";

export type NotificationKind =
  | "verification.vouch-request"
  | "verification.verified"
  | "verification.activated"
  | "verification.rejected"
  | "roles.changed"
  | "contact.revealed"
  | "system.notice";

export async function notify(
  pool: Pool,
  config: InstanceConfig,
  memberId: string,
  kind: NotificationKind,
  payload: Record<string, unknown>,
): Promise<void> {
  await pool.query(
    `INSERT INTO notifications (instance_id, member_id, kind, payload)
     VALUES ($1,$2,$3,$4)`,
    [config.instance.shortName === "" ? null : (await currentInstanceId(pool, config)), memberId, kind, JSON.stringify({ ...payload, title: titleFor(kind, payload) })],
  );
}

async function currentInstanceId(pool: Pool, config: InstanceConfig): Promise<string> {
  // Config documents are per instance; resolve the instance id from the DB.
  const res = await pool.query<{ id: string }>(
    "SELECT id FROM instances WHERE short_name = $1 LIMIT 1",
    [config.instance.shortName],
  );
  const row = res.rows[0];
  if (!row) throw new Error(`instance not found for short_name ${config.instance.shortName}`);
  return row.id;
}

function titleFor(kind: NotificationKind, payload: Record<string, unknown>): string {
  switch (kind) {
    case "verification.vouch-request":
      return `Identify your setmate: ${String(payload.memberName ?? "new member")}`;
    case "verification.verified":
      return "You are verified";
    case "verification.activated":
      return "Your account is active";
    case "verification.rejected":
      return "Your signup was not approved";
    case "roles.changed":
      return `Your roles changed: ${String(payload.roles ?? "")}`;
    case "contact.revealed":
      return "Someone viewed your contact details";
    case "system.notice":
      return String(payload.title ?? "Notice");
  }
}

/**
 * Quiet hours (J4): future push channels consult this; the admin emergency
 * broadcast override is honored per the instance policy (§P).
 */
export function pushAllowedNow(config: InstanceConfig, at = new Date()): boolean {
  const q = config.instance.behavior.quietHoursDefault;
  if (!q.enabled) return true;
  const [sh, sm] = q.start.split(":").map(Number) as [number, number];
  const [eh, em] = q.end.split(":").map(Number) as [number, number];
  const minutes = at.getHours() * 60 + at.getMinutes();
  const start = sh * 60 + (sm ?? 0);
  const end = eh * 60 + (em ?? 0);
  if (start <= end) return !(minutes >= start && minutes < end);
  return !(minutes >= start || minutes < end);
}
