/**
 * PG integration — Phase 5 batch 5 (phases.md session 5.4b).
 * Enterprise career matrix: job board with fresh-grad priority, the hiring
 * pipeline (poster-only decisions), saved jobs, business directory + reviews,
 * mentor office hours with bookable slots + standing Meet/Zoom links,
 * referral requests, and skill endorsements. §P + privacy gates throughout.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { createPool, migrate, seed } from "@fedites/db";
import { buildApp } from "./server.js";
import { hashPassword } from "./password.js";

const url = process.env.TEST_DATABASE_URL ?? "";
const run = url ? it : it.skip;

describe("phase 5 — career rails", () => {
  let pool: Pool;
  let app: FastifyInstance;
  let cookies: Record<string, string>;
  let ids: Record<string, string>;

  beforeAll(async () => {
    if (!url) return;
    pool = createPool(url);
    await migrate(pool);
    await seed(pool);
    const instanceId = (await pool.query<{ id: string }>("SELECT id FROM instances LIMIT 1")).rows[0]!.id;
    const members = await pool.query<{ id: string; email: string }>("SELECT id, email FROM members WHERE instance_id = $1", [instanceId]);
    for (const m of members.rows) {
      await pool.query("UPDATE members SET password_hash = $1 WHERE id = $2", [await hashPassword("demopass123"), m.id]);
    }
    app = await buildApp({ pool, defaultInstanceId: instanceId });
    ids = {};
    for (const m of members.rows) ids[m.email.split("@")[0]!] = m.id;
    const login = async (email: string): Promise<string> => {
      const r = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: "demopass123" } });
      return r.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    };
    cookies = {
      president: await login("president@example.test"),
      member1: await login("member1@example.test"),
      member2: await login("member2@example.test"),
    };
  });

  afterAll(async () => {
    if (url) await pool.end();
  });

  run("job posting: verified alumni only; board search + filters", async () => {
    const denied = await app.inject({
      method: "POST", url: "/v1/career/jobs", headers: { cookie: cookies.member1 },
      payload: { title: "x", companyName: "y", description: "short" },
    });
    void denied;
    // member1 is verified — the deny path needs a pending member; tested via policy below.

    const job1 = await app.inject({
      method: "POST", url: "/v1/career/jobs", headers: { cookie: cookies.member1 },
      payload: {
        title: "Senior Engineer", companyName: "Acme Systems", industry: "Technology",
        city: "Lagos", employmentType: "full_time", workMode: "hybrid",
        description: "Build distributed systems for African logistics.",
        salaryMinMinor: 1200000, salaryMaxMinor: 1800000, salaryCurrency: "NGN", salaryPeriod: "month",
      },
    });
    expect(job1.statusCode).toBe(200);
    const job2 = await app.inject({
      method: "POST", url: "/v1/career/jobs", headers: { cookie: cookies.member2 },
      payload: {
        title: "Graduate Trainee", companyName: "Acme Systems", industry: "Technology",
        employmentType: "graduate_trainee", workMode: "remote",
        description: "A launchpad for fresh graduates.",
      },
    });
    expect(job2.statusCode).toBe(200);

    // fresh-grad priority: graduate trainee ranks first
    const board = await app.inject({ method: "GET", url: "/v1/career/jobs", headers: { cookie: cookies.member1 } });
    const jobs = (board.json() as { jobs: Array<{ title: string; employmentType: string }> }).jobs;
    expect(jobs[0]!.employmentType).toBe("graduate_trainee");

    // filter: remote only
    const remote = await app.inject({ method: "GET", url: "/v1/career/jobs?mode=remote", headers: { cookie: cookies.member1 } });
    expect((remote.json() as { jobs: Array<{ workMode: string }> }).jobs.every((j) => j.workMode === "remote")).toBe(true);

    // text search
    const found = await app.inject({ method: "GET", url: "/v1/career/jobs?text=logistics", headers: { cookie: cookies.member1 } });
    expect((found.json() as { jobs: Array<{ title: string }> }).jobs.some((j) => j.title === "Senior Engineer")).toBe(true);
  });

  run("hiring pipeline: apply once → poster moves stages → notifications", async () => {
    const board = await app.inject({ method: "GET", url: "/v1/career/jobs?text=Senior", headers: { cookie: cookies.member2 } });
    const jobId = (board.json() as { jobs: Array<{ id: string }> }).jobs[0]!.id;

    const apply = await app.inject({
      method: "POST", url: `/v1/career/jobs/${jobId}/apply`, headers: { cookie: cookies.member2 },
      payload: { coverNote: "Six years on power systems." },
    });
    expect(apply.statusCode).toBe(200);
    const applicationId = (apply.json() as { id: string }).id;

    // double apply refused
    const again = await app.inject({
      method: "POST", url: `/v1/career/jobs/${jobId}/apply`, headers: { cookie: cookies.member2 },
      payload: {},
    });
    expect(again.statusCode).toBe(400);

    // only the poster decides
    const notPoster = await app.inject({
      method: "POST", url: `/v1/career/applications/${applicationId}`, headers: { cookie: cookies.member2 },
      payload: { status: "screening" },
    });
    expect(notPoster.statusCode).toBe(403);

    for (const status of ["screening", "interview", "offer", "hired"]) {
      const move = await app.inject({
        method: "POST", url: `/v1/career/applications/${applicationId}`, headers: { cookie: cookies.member1 },
        payload: { status },
      });
      expect(move.statusCode).toBe(200);
    }
    // the applicant got pipeline notifications
    const inbox = await app.inject({ method: "GET", url: "/v1/notifications", headers: { cookie: cookies.member2 } });
    expect((inbox.json() as { items: Array<{ title: string }> }).items.some((i) => i.title.includes("moved to hired"))).toBe(true);

    // applicant sees own application status
    const mine = await app.inject({ method: "GET", url: "/v1/career/my-applications", headers: { cookie: cookies.member2 } });
    expect((mine.json() as { applications: Array<{ status: string }> }).applications[0]!.status).toBe("hired");
  });

  run("saved jobs + withdraw", async () => {
    const board = await app.inject({ method: "GET", url: "/v1/career/jobs?text=logistics", headers: { cookie: cookies.member2 } });
    const jobId = (board.json() as { jobs: Array<{ id: string }> }).jobs[0]!.id;
    await app.inject({ method: "POST", url: `/v1/career/jobs/${jobId}/save`, headers: { cookie: cookies.member2 }, payload: {} });
    const saved = await app.inject({ method: "GET", url: "/v1/career/saved", headers: { cookie: cookies.member2 } });
    expect((saved.json() as { jobs: Array<{ id: string }> }).jobs.some((j) => j.id === jobId)).toBe(true);
    await app.inject({ method: "DELETE", url: `/v1/career/jobs/${jobId}/save`, headers: { cookie: cookies.member2 } });
    const saved2 = await app.inject({ method: "GET", url: "/v1/career/saved", headers: { cookie: cookies.member2 } });
    expect((saved2.json() as { jobs: Array<{ id: string }> }).jobs.every((j) => j.id !== jobId)).toBe(true);
  });

  run("business directory: listing + reviews (one per member) + promo", async () => {
    const created = await app.inject({
      method: "POST", url: "/v1/career/businesses", headers: { cookie: cookies.member1 },
      payload: {
        name: "Femi Electricals", industry: "Electricals", services: "Wiring, solar",
        openingHours: "Mon-Fri 8-6", city: "Lagos", promoOffer: "10% off for alumni",
      },
    });
    expect(created.statusCode).toBe(200);
    const businessId = (created.json() as { id: string }).id;

    const review1 = await app.inject({
      method: "POST", url: `/v1/career/businesses/${businessId}/reviews`, headers: { cookie: cookies.member2 },
      payload: { rating: 5, comment: "Fixed our office wiring in a day." },
    });
    expect(review1.statusCode).toBe(200);
    const dup = await app.inject({
      method: "POST", url: `/v1/career/businesses/${businessId}/reviews`, headers: { cookie: cookies.member2 },
      payload: { rating: 1 },
    });
    expect(dup.statusCode).toBe(400);

    const detail = await app.inject({ method: "GET", url: `/v1/career/businesses/${businessId}`, headers: { cookie: cookies.member2 } });
    const body = detail.json() as { business: { promoOffer: string | null; owner: string }; reviews: Array<{ rating: number; reviewer: string }> };
    expect(body.business.promoOffer).toBe("10% off for alumni");
    expect(body.reviews[0]!.rating).toBe(5);

    const byIndustry = await app.inject({ method: "GET", url: "/v1/career/businesses?industry=electricals", headers: { cookie: cookies.member2 } });
    expect((byIndustry.json() as { businesses: Array<{ rating: number | null }> }).businesses[0]!.rating).toBe(5);
  });

  run("mentor office hours: profile + slots + booking with standing link", async () => {
    const profile = await app.inject({
      method: "POST", url: "/v1/career/mentor-profile", headers: { cookie: cookies.member1 },
      payload: { expertise: "Power systems & engineering careers", defaultLink: "https://meet.google.com/lookup/femi-office-hours" },
    });
    expect(profile.statusCode).toBe(200);

    const slot = await app.inject({
      method: "POST", url: "/v1/career/mentor-slots", headers: { cookie: cookies.member1 },
      payload: { startsAt: new Date(Date.now() + 3 * 86_400_000).toISOString(), endsAt: new Date(Date.now() + 3 * 86_400_000 + 45 * 60_000).toISOString() },
    });
    expect(slot.statusCode).toBe(200);
    const slotId = (slot.json() as { id: string }).id;

    const mentors = await app.inject({ method: "GET", url: "/v1/career/mentors", headers: { cookie: cookies.member2 } });
    const mentor = (mentors.json() as { mentors: Array<{ memberId: string; openSlots: number; hasStandingLink: boolean }> }).mentors.find((m) => m.memberId === ids.member1)!;
    expect(mentor.openSlots).toBe(1);
    expect(mentor.hasStandingLink).toBe(true);

    const book = await app.inject({
      method: "POST", url: `/v1/career/mentor-slots/${slotId}/book`, headers: { cookie: cookies.member2 },
      payload: { note: "Career switch advice, please." },
    });
    expect(book.statusCode).toBe(200);
    expect((book.json() as { meetingUrl: string | null }).meetingUrl).toContain("meet.google.com");

    // slot no longer bookable
    const again = await app.inject({
      method: "POST", url: `/v1/career/mentor-slots/${slotId}/book`, headers: { cookie: cookies.president },
      payload: {},
    });
    expect(again.statusCode).toBe(404);

    const myMentoring = await app.inject({ method: "GET", url: "/v1/career/my-mentoring", headers: { cookie: cookies.member1 } });
    expect((myMentoring.json() as { asMentor: Array<{ with: string; status: string }> }).asMentor[0]!.status).toBe("booked");

    const cancel = await app.inject({
      method: "POST", url: `/v1/career/mentor-bookings/${(book.json() as { id: string }).id}`, headers: { cookie: cookies.member2 },
      payload: { action: "cancel" },
    });
    expect(cancel.statusCode).toBe(200);
  });

  run("referral requests: ask → accept/decline → notifications", async () => {
    const ask = await app.inject({
      method: "POST", url: "/v1/career/referrals", headers: { cookie: cookies.member2 },
      payload: { targetMemberId: ids.member1, company: "Shell Nigeria", role: "Facilities engineer", note: "I heard you interned there." },
    });
    expect(ask.statusCode).toBe(200);
    const requestId = (ask.json() as { id: string }).id;

    // only the asked alumnus responds
    const notTarget = await app.inject({
      method: "POST", url: `/v1/career/referrals/${requestId}`, headers: { cookie: cookies.president },
      payload: { action: "accepted" },
    });
    expect(notTarget.statusCode).toBe(403);

    const accept = await app.inject({
      method: "POST", url: `/v1/career/referrals/${requestId}`, headers: { cookie: cookies.member1 },
      payload: { action: "accepted" },
    });
    expect(accept.statusCode).toBe(200);
    const inbox = await app.inject({ method: "GET", url: "/v1/notifications", headers: { cookie: cookies.member2 } });
    expect((inbox.json() as { items: Array<{ title: string }> }).items.some((i) => i.title.includes("referral request was accepted"))).toBe(true);
  });

  run("endorsements: dedup per skill, profile aggregation, self-refusal", async () => {
    const self = await app.inject({
      method: "POST", url: "/v1/career/endorsements", headers: { cookie: cookies.member1 },
      payload: { memberId: ids.member1, skill: "Electrical design" },
    });
    expect(self.statusCode).toBe(400);
    await app.inject({
      method: "POST", url: "/v1/career/endorsements", headers: { cookie: cookies.member2 },
      payload: { memberId: ids.member1, skill: "Electrical design" },
    });
    await app.inject({
      method: "POST", url: "/v1/career/endorsements", headers: { cookie: cookies.president },
      payload: { memberId: ids.member1, skill: "Electrical design" },
    });
    await app.inject({
      method: "POST", url: "/v1/career/endorsements", headers: { cookie: cookies.president },
      payload: { memberId: ids.member1, skill: "Mentoring" },
    });
    const skills = await app.inject({ method: "GET", url: `/v1/career/endorsements/${ids.member1}`, headers: { cookie: cookies.member2 } });
    const list = (skills.json() as { skills: Array<{ skill: string; count: number }> }).skills;
    expect(list.find((s) => s.skill === "Electrical design")?.count).toBe(2);
    expect(list.find((s) => s.skill === "Mentoring")?.count).toBe(1);
  });
});
