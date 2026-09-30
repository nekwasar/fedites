/**
 * Profile routes (1.3): profile builder, privacy controls v1, logged contact
 * reveal, private legacy family linking, digital alumni ID v1 (QR card).
 * K1: private by default — contact details and birthday never leave the API
 * without an explicit, audit-logged reveal.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Pool } from "pg";
import QRCode from "qrcode";
import { profileBodySchema } from "@fedites/config";
import { requireMember, type SessionMember } from "./sessions.js";
import { evaluate } from "./policy.js";
import type { InstanceConfig } from "@fedites/config";

const familyLinkBody = z.object({
  relatedEmail: z.string().email(),
  relation: z.string().min(2).max(60),
});

export async function profileRoutes(
  app: FastifyInstance,
  opts: { pool: Pool; loadConfigByInstance: (instanceId: string) => Promise<InstanceConfig>; publicAppUrl: string },
): Promise<void> {
  const { pool } = opts;

  /* --------------------------- profile builder --------------------------- */

  app.patch("/v1/me", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const body = profileBodySchema.parse(request.body);

    const sets: string[] = [];
    const values: unknown[] = [];
    const setField = (col: string, value: unknown): void => {
      values.push(value);
      sets.push(`${col} = $${values.length}`);
    };
    if (body.displayName !== undefined) setField("display_name", body.displayName);
    if (body.bio !== undefined) setField("bio", body.bio);
    if (body.city !== undefined) setField("city", body.city);
    if (body.country !== undefined) setField("country", body.country);
    if (body.profession !== undefined) setField("profession", body.profession);
    if (body.favoriteMemory !== undefined) setField("favorite_memory", body.favoriteMemory);
    if (body.photoUrl !== undefined) setField("photo_url", body.photoUrl === "" ? null : body.photoUrl);
    if (body.birthday !== undefined) setField("birthday", body.birthday);
    if (body.visibility !== undefined) setField("visibility", JSON.stringify(body.visibility));
    if (sets.length === 0) return { ok: true };
    values.push(member.id);
    await pool.query(`UPDATE members SET ${sets.join(", ")} WHERE id = $${values.length}`, values);
    return { ok: true };
  });

  /* ------------------------- public-safe profile ------------------------- */

  app.get("/v1/members/:id", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const res = await pool.query<{
      id: string; display_name: string; verification: string; bio: string | null; city: string | null;
      country: string | null; profession: string | null; photo_url: string | null; favorite_memory: string | null;
      set_year: number | null; house: string | null; visibility: Record<string, string>; email: string; phone: string | null;
    }>(
      `SELECT m.id, m.display_name, m.verification, m.bio, m.city, m.country, m.profession,
              m.photo_url, m.favorite_memory, s.year AS set_year, h.name AS house, m.visibility, m.email, m.phone
       FROM members m
       LEFT JOIN sets s ON s.id = m.set_id
       LEFT JOIN sports_houses h ON h.id = m.house_id
       WHERE m.id = $1 AND m.instance_id = $2 AND m.verification <> 'rejected' AND m.deleted_at IS NULL`,
      [id, member.instanceId],
    );
    const m = res.rows[0];
    if (!m) return reply.status(404).send({ error: "Member not found." });
    const contactVisible = member.id === m.id || m.visibility?.contact === "members";
    return {
      id: m.id,
      displayName: m.display_name,
      verification: m.verification,
      bio: m.bio,
      city: m.city,
      country: m.country,
      profession: m.profession,
      photoUrl: m.photo_url,
      favoriteMemory: m.favorite_memory,
      setYear: m.set_year,
      house: m.house,
      contactVisible,
      email: contactVisible ? m.email : null,
      phone: contactVisible ? m.phone : null,
    };
  });

  /**
   * Logged contact reveal (§P): revealing another member's contacts is a
   * per-person, audit-logged action. Verified members only.
   */
  app.post("/v1/members/:id/reveal-contact", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { id } = request.params as { id: string };
    const config = await opts.loadConfigByInstance(member.instanceId);
    // Verified members only (§P: reveals are a logged, per-person action).
    const gate = evaluate(config, "dm.send", {
      status: member.verification === "rejected" ? "limited" : member.verification,
      verified: member.verification === "verified",
      honorary: member.verification === "honorary",
      roles: member.roles,
      vouchCount: 0,
    });
    if (!gate.allowed) return reply.status(403).send({ error: gate.reason });

    const res = await pool.query<{ email: string; phone: string | null }>(
      "SELECT email, phone FROM members WHERE id = $1 AND instance_id = $2",
      [id, member.instanceId],
    );
    const target = res.rows[0];
    if (!target) return reply.status(404).send({ error: "Member not found." });

    await pool.query(
      `INSERT INTO audit_log (instance_id, actor_id, action, target, reversible_until, details)
       VALUES ($1,$2,'contact.reveal',$3, now() + interval '30 days', $4)`,
      [member.instanceId, member.id, id, JSON.stringify({ via: "reveal-contact" })],
    );
    await pool.query(
      `INSERT INTO notifications (instance_id, member_id, kind, payload)
       VALUES ($1,$2,'contact.revealed',$3)`,
      [member.instanceId, id, JSON.stringify({ by: member.displayName })],
    );
    return { email: target.email, phone: target.phone };
  });

  /* ------------------- private legacy family linking --------------------- */

  app.get("/v1/me/family-links", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ id: string; related_id: string; relation: string; name: string }>(
      `SELECT f.id, f.related_id, f.relation, m.display_name AS name
       FROM family_links f JOIN members m ON m.id = f.related_id
       WHERE f.instance_id = $1 AND f.member_id = $2`,
      [member.instanceId, member.id],
    );
    return { links: res.rows };
  });

  app.post("/v1/me/family-links", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const body = familyLinkBody.parse(request.body);
    const rel = await pool.query<{ id: string }>(
      "SELECT id FROM members WHERE instance_id = $1 AND email = $2 AND id <> $3",
      [member.instanceId, body.relatedEmail.toLowerCase(), member.id],
    );
    const related = rel.rows[0];
    if (!related) return reply.status(404).send({ error: "No member found with that email." });
    await pool.query(
      `INSERT INTO family_links (instance_id, member_id, related_id, relation) VALUES ($1,$2,$3,$4)
       ON CONFLICT (instance_id, member_id, related_id) DO UPDATE SET relation = $4`,
      [member.instanceId, member.id, related.id, body.relation],
    );
    return { ok: true };
  });

  app.delete("/v1/me/family-links/:linkId", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const { linkId } = request.params as { linkId: string };
    await pool.query("DELETE FROM family_links WHERE id = $1 AND member_id = $2 AND instance_id = $3", [linkId, member.id, member.instanceId]);
    return { ok: true };
  });

  /* ------------------- digital alumni ID v1 (mvp §1) --------------------- */

  app.get("/v1/me/id", async (request, reply) => {
    const member = await requireMember(request, reply);
    if (member === null) return reply;
    const res = await pool.query<{ display_name: string; verification: string; set_year: number | null; house: string | null; created_at: Date; tier_name: string | null }>(
      `SELECT m.display_name, m.verification, s.year AS set_year, h.name AS house, m.created_at, t.name AS tier_name
       FROM members m
       LEFT JOIN sets s ON s.id = m.set_id
       LEFT JOIN sports_houses h ON h.id = m.house_id
       LEFT JOIN membership_tiers t ON t.id = m.tier_id
       WHERE m.id = $1`,
      [member.id],
    );
    const m = res.rows[0];
    if (!m) return reply.status(404).send({ error: "Member not found." });
    const config = await opts.loadConfigByInstance(member.instanceId);
    const target = `${opts.publicAppUrl}/members/${member.id}`;
    // The QR encoder needs literal paint values; the modules are painted
    // currentColor so the surrounding card (family-skinned via tokens) sets
    // the actual color from the Color Theme layer. Integration-boundary
    // exception to M1 — no instance colors appear here.
    const raw = await QRCode.toString(target, { type: "svg", margin: 0 });
    const qrSvg = raw
      .replace(/fill="#fff[^"]*"/g, 'fill="var(--c-base)"')
      .replace(/stroke="#[0-9a-f]+"/g, 'stroke="currentColor"');
    return {
      card: {
        holder: m.display_name,
        setYear: m.set_year,
        house: m.house,
        verification: m.verification,
        tier: m.tier_name,
        memberSince: m.created_at,
        school: config.instance.displayName,
        profileUrl: target,
      },
      qrSvg,
    };
  });
}

export type { SessionMember };
