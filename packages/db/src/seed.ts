/**
 * Seed script (phases.md 0.2 demo gate): populates a FAKE school.
 * Principle 4 from phases.md: "Seed data from day one — a fake school, 3 sets,
 * all 6 group types, test members per role — every session demos like real life."
 *
 * The school lives entirely in the DB (zero school constants in code): its name,
 * terminology, theme, and behavior are one instance config document
 * (configuration.md §8).
 */
import type { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { defaultConfig } from "@fedites/config";
import { withTx, type Tx } from "./client.js";
import { hashPassword } from "./password.js";

export interface SeedResult {
  instanceId: string;
  memberIds: Record<string, string>;
  groupIds: Record<string, string>;
}

/** Demo password for every seeded member (UAT per session discipline). */
export const DEMO_PASSWORD = "demopass123";
/** Demo invite code for walking the signup flow by hand. */
export const DEMO_INVITE_CODE = "WELCOME-98";

export async function seed(pool: Pool): Promise<SeedResult> {
  return withTx(pool, async (tx) => seedTx(tx));
}

async function seedTx(tx: Tx): Promise<SeedResult> {
  // Idempotency: if the demo instance exists, return it.
  const existing = await tx.query<{ id: string }>(
    "SELECT id FROM instances WHERE short_name = $1",
    [defaultConfig.instance.shortName],
  );
  if (existing.rows[0]) {
    const instanceId = existing.rows[0].id;
    return { instanceId, memberIds: {}, groupIds: {} };
  }

  const demoHash = await hashPassword(DEMO_PASSWORD);

  const instanceId = randomUUID();
  await tx.query(
    "INSERT INTO instances (id, display_name, short_name) VALUES ($1,$2,$3)",
    [instanceId, defaultConfig.instance.displayName, defaultConfig.instance.shortName],
  );

  // Config document v1, published (configuration.md §8).
  await tx.query(
    `INSERT INTO config_documents (instance_id, version, status, document, published_at)
     VALUES ($1, 1, 'published', $2, now())`,
    [instanceId, JSON.stringify({ ...defaultConfig, publishedAt: new Date().toISOString() })],
  );

  // 3 sets: '96, '97, '98
  const setIds: Record<number, string> = {};
  for (const year of [1996, 1997, 1998]) {
    const id = randomUUID();
    setIds[year] = id;
    await tx.query("INSERT INTO sets (id, instance_id, year, label) VALUES ($1,$2,$3,$4)", [
      id, instanceId, year, `Set '${String(year % 100).padStart(2, "0")}`,
    ]);
  }

  // Sports houses (legacy houses seeded — spec §6)
  const houseIds: Record<string, string> = {};
  for (const name of ["Mercury", "Vulcan", "Apollo"]) {
    const id = randomUUID();
    houseIds[name] = id;
    await tx.query("INSERT INTO sports_houses (id, instance_id, name) VALUES ($1,$2,$3)", [
      id, instanceId, name,
    ]);
  }

  // Roles
  const roleIds: Record<string, string> = {};
  for (const key of ["president", "treasurer", "secretary", "moderator", "editor", "member"]) {
    const id = randomUUID();
    roleIds[key] = id;
    await tx.query("INSERT INTO roles (id, instance_id, key) VALUES ($1,$2,$3)", [id, instanceId, key]);
  }

  // Test members per role (phases.md principle 4)
  const memberIds: Record<string, string> = {};
  const people: Array<{ key: string; name: string; year: number; house: string; role?: string; honorary?: boolean }> = [
    { key: "president", name: "Ada President", year: 1996, house: "Mercury", role: "president" },
    { key: "treasurer", name: "Bayo Treasurer", year: 1996, house: "Vulcan", role: "treasurer" },
    { key: "secretary", name: "Chidi Secretary", year: 1997, house: "Apollo", role: "secretary" },
    { key: "moderator", name: "Dede Moderator", year: 1997, house: "Mercury", role: "moderator" },
    { key: "editor", name: "Efe Editor", year: 1998, house: "Vulcan", role: "editor" },
    { key: "member1", name: "Femi Member", year: 1998, house: "Apollo" },
    { key: "member2", name: "Gozie Member", year: 1998, house: "Mercury" },
    { key: "member3", name: "Halima Member", year: 1996, house: "Vulcan" },
    { key: "member4", name: "Ifeanyi Member", year: 1997, house: "Apollo" },
    { key: "member5", name: "Jide Member", year: 1997, house: "Mercury" },
    { key: "teacher1", name: "Mr. K Teacher", year: 1996, house: "Mercury", honorary: true },
  ];
  for (const p of people) {
    const id = randomUUID();
    memberIds[p.key] = id;
    await tx.query(
      `INSERT INTO members (id, instance_id, set_id, house_id, display_name, email, verification, password_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        id, instanceId, setIds[p.year] ?? null, houseIds[p.house] ?? null, p.name,
        `${p.key}@example.test`, p.honorary ? "honorary" : "verified", demoHash,
      ],
    );
    if (p.role) {
      await tx.query(
        "INSERT INTO member_roles (instance_id, member_id, role_id) VALUES ($1,$2,$3)",
        [instanceId, id, roleIds[p.role]!],
      );
    }
  }

  // All 6 group types (phases.md 0.2 demo gate)
  const groupIds: Record<string, string> = {};
  const groups: Array<{ key: string; type: string; name: string; setId?: number }> = [
    { key: "set98", type: "set", name: "Set '98", setId: 1998 },
    { key: "set97", type: "set", name: "Set '97", setId: 1997 },
    { key: "set96", type: "set", name: "Set '96", setId: 1996 },
    { key: "chapterLagos", type: "chapter", name: "Lagos Chapter" },
    { key: "chapterLondon", type: "chapter", name: "London Chapter" },
    { key: "football", type: "interest", name: "Old Boys Football" },
    { key: "photography", type: "interest", name: "Photography Circle" },
    { key: "medics", type: "guild", name: "Medics Guild" },
    { key: "tech", type: "guild", name: "Tech Guild" },
    { key: "houseMercury", type: "house", name: "Mercury House" },
    { key: "houseVulcan", type: "house", name: "Vulcan House" },
    { key: "houseApollo", type: "house", name: "Apollo House" },
    { key: "committeeExec", type: "committee", name: "Executive Committee" },
  ];
  for (const g of groups) {
    const id = randomUUID();
    groupIds[g.key] = id;
    await tx.query("INSERT INTO groups (id, instance_id, type, name) VALUES ($1,$2,$3,$4)", [
      id, instanceId, g.type, g.name,
    ]);
  }
  // Auto-join set groups per spec §6 (verified members join their set group + house)
  for (const p of people) {
    if (p.honorary) continue;
    const setKey = p.year === 1996 ? "set96" : p.year === 1997 ? "set97" : "set98";
    await tx.query(
      "INSERT INTO group_members (instance_id, group_id, member_id) VALUES ($1,$2,$3)",
      [instanceId, groupIds[setKey]!, memberIds[p.key]!],
    );
    await tx.query(
      "INSERT INTO group_members (instance_id, group_id, member_id) VALUES ($1,$2,$3)",
      [instanceId, groupIds[`house${p.house}`]!, memberIds[p.key]!],
    );
  }
  // Committee members
  for (const key of ["president", "treasurer", "secretary", "moderator", "editor"]) {
    await tx.query(
      "INSERT INTO group_members (instance_id, group_id, member_id, is_admin) VALUES ($1,$2,$3,true)",
      [instanceId, groupIds.committeeExec!, memberIds[key]!],
    );
  }

  // Phase 3 demo events: a Set '98 mini-reunion (group-owned) + school AGM.
  await tx.query(
    `INSERT INTO events (id, instance_id, group_id, created_by, title, description, starts_at, venue, city)
     VALUES ($1,$2,$3,$4,'Set ''98 Mini Reunion','Games, old photos, and the anthem. Bring your tie.',
             now() + interval '60 days','School Main Hall','Lagos')`,
    [randomUUID(), instanceId, groupIds.set98!, memberIds.president!],
  );
  await tx.query(
    `INSERT INTO events (id, instance_id, created_by, title, description, starts_at, venue, city, virtual_link)
     VALUES ($1,$2,$3,'Annual General Meeting','Quorum at 40%. Proxy forms in the constitution library.',
             now() + interval '30 days','School Assembly Grounds','Lagos','https://meet.google.com/lookup/fedites-agm')`,
    [randomUUID(), instanceId, memberIds.president!],
  );

  // Demo invite code for walking the signup flow by hand (UAT).
  await tx.query(
    `INSERT INTO invite_codes (instance_id, code, created_by) VALUES ($1,$2,$3)`,
    [instanceId, DEMO_INVITE_CODE, memberIds.president!],
  );

  // "Start here" posts (group lifecycle, spec §6)
  for (const g of groups) {
    await tx.query(
      `INSERT INTO activity_posts (instance_id, group_id, author_id, kind, body)
       VALUES ($1,$2,$3,'post',$4)`,
      [instanceId, groupIds[g.key]!, memberIds.secretary!, "Start here: introduce yourself below."],
    );
  }

  // Demo chat + event + ledger rows so no view is empty
  await tx.query(
    `INSERT INTO messages (instance_id, group_id, author_id, body)
     VALUES ($1,$2,$3,$4)`,
    [instanceId, groupIds.set98!, memberIds.member1!, "Hello set mates, meeting on Saturday."],
  );
  await tx.query(
    `INSERT INTO messages (instance_id, group_id, author_id, body)
     VALUES ($1,$2,$3,$4)`,
    [instanceId, groupIds.set98!, memberIds.member2!, "Confirmed."],
  );
  await tx.query(
    `INSERT INTO ledger_entries (instance_id, member_id, kind, amount_minor, currency, memo, private_ledger)
     VALUES ($1,$2,'dues', 20000, 'NGN', 'Annual dues 2026', true),
            ($1,$3,'donation', 150000, 'NGN', 'Library fund', false)`,
    [instanceId, memberIds.member1!, memberIds.member3!],
  );

  return { instanceId, memberIds, groupIds };
}
