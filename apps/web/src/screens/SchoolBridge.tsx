/**
 * School Bridge screens (Phase 5 batch 4, session 5.4a): wishlist
 * (fund/fulfil), adopt-a-project (ledger-backed progress), past questions
 * bank, teacher tributes, facility booking, records verification.
 * Flat rows, hairlines, no emojis (A1/D1/G1); archived not deleted (N1).
 */
import React, { useEffect, useRef, useState } from "react";
import { Api } from "../api.js";
import { Empty } from "./InboxScreen.js";
import { money } from "./Money.js";

const inputStyle: React.CSSProperties = {
  width: "100%", minHeight: 44, border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "15px var(--font-ui)", color: "var(--c-base-contrast)",
};

export interface BridgeSsrData {
  wishlist?: { items: Array<{ id: string; title: string; details: string | null; estCostMinor: number | null; currency: string | null; status: string; fulfilNote: string | null }> };
  projects?: { projects: Array<{ id: string; title: string; story: string | null; goalMinor: number; currency: string; sponsoredBy: string | null; status: string; progressNotes: string | null; raisedMinor: number }> };
  questions?: { questions: Array<{ id: string; subject: string; year: number | null; title: string | null; media_id: string }> };
  tributes?: { tributes: Array<{ teacher_name: string; story: string; submitted_by_name: string }> };
  bookings?: { bookings: Array<{ id: string; memberName: string; facility: string; startsAt: string; status: string }> };
}

export function SchoolBridgeScreen({ isAdmin, ssrData }: { isAdmin: boolean; ssrData?: BridgeSsrData }): React.ReactElement {
  const [tab, setTab] = useState<"wishlist" | "projects" | "pastquestions" | "tributes" | "bookings" | "records">("wishlist");
  return (
    <main style={{ paddingBottom: 96 }}>
      <h1 className="screen-title">School Bridge</h1>
      <div style={{ display: "flex", borderBottom: "1px solid var(--c-hairline)", overflowX: "auto" }}>
        {([["wishlist", "Wishlist"], ["projects", "Adopt-a-project"], ["pastquestions", "Past questions"], ["tributes", "Teacher tributes"], ["bookings", "Facility booking"], ["records", "Records verification"]] as const).map(([k, label]) => (
          <button key={k} type="button" className="press" onClick={() => setTab(k)} aria-current={tab === k}
            style={{ minHeight: 44, flex: 1, background: "transparent", border: "none", borderBottom: tab === k ? "2px solid var(--c-accent)" : "2px solid transparent", color: tab === k ? "var(--c-accent)" : "var(--c-neutral-600)", font: "600 12px var(--font-ui)", cursor: "pointer", whiteSpace: "nowrap", padding: "0 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {label}
          </button>
        ))}
      </div>
      {tab === "wishlist" && <Wishlist isAdmin={isAdmin} ssrData={ssrData} />}
      {tab === "projects" && <Projects isAdmin={isAdmin} ssrData={ssrData} />}
      {tab === "pastquestions" && <PastQuestions isAdmin={isAdmin} ssrData={ssrData} />}
      {tab === "tributes" && <Tributes ssrData={ssrData} />}
      {tab === "bookings" && <Bookings isAdmin={isAdmin} ssrData={ssrData} />}
      {tab === "records" && <Records isAdmin={isAdmin} />}
    </main>
  );
}

function Wishlist({ isAdmin, ssrData }: { isAdmin: boolean; ssrData?: BridgeSsrData }): React.ReactElement {
  const [items, setItems] = useState<BridgeSsrData["wishlist"] extends undefined ? never : NonNullable<BridgeSsrData["wishlist"]>["items"] | null>(ssrData?.wishlist?.items ?? null);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const load = (): void => { Api.wishlist().then((r) => setItems(r.items)).catch(() => undefined); };
  useEffect(() => { load(); });

  const post = async (): Promise<void> => {
    await Api.postWishlistItem({ title, details: details || undefined }).catch((e: Error) => setNote(e.message));
    setTitle(""); setDetails("");
    load();
  };

  const fulfil = async (id: string, physical: boolean): Promise<void> => {
    await Api.fulfilWishlistItem(id, physical).catch((e: Error) => setNote(e.message));
    load();
  };

  return (
    <div>
      {isAdmin && (
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--c-hairline)" }}>
          <p className="micro" style={{ margin: "0 0 8px" }}>Post the school's needs (mvp §9)</p>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Item, e.g. 20 lab stools" aria-label="Wishlist title" style={inputStyle} />
          <input value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Details (optional)" aria-label="Wishlist details" style={inputStyle} />
          <button type="button" className="btn btn--outlined press" style={{ margin: "8px 0" }} onClick={() => void post()} disabled={title.trim().length < 2}>Post need</button>
        </div>
      )}
      {note !== null && <p className="micro" style={{ padding: "8px 16px 0" }}>{note}</p>}
      {items === null ? null : items.length === 0 ? (
        <Empty title="The wishlist is empty" body="Needs posted by the school appear here for funding or fulfilment." />
      ) : items.map((i) => (
        <div key={i.id} className="row" style={{ padding: "8px 16px", flexWrap: "wrap" }}>
          <span style={{ flex: 1, minWidth: 200 }}>
            <span style={{ display: "block", font: "600 14px var(--font-ui)" }}>{i.title}</span>
            {i.details !== null && <span className="micro">{i.details}</span>}
            {i.estCostMinor !== null && <span className="micro tabular"> · est. {money(i.estCostMinor, i.currency ?? "NGN")}</span>}
            {i.fulfilNote !== null && <span className="micro"> — {i.fulfilNote}</span>}
          </span>
          {i.status === "open" ? (
            <span style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn--filled press" style={{ minHeight: 36 }} onClick={() => void fulfil(i.id, false)}>Fund this</button>
              <button type="button" className="btn btn--outlined press" style={{ minHeight: 36 }} onClick={() => void fulfil(i.id, true)}>Fulfil physically</button>
            </span>
          ) : (
            <span className="micro">{i.status}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function Projects({ isAdmin, ssrData }: { isAdmin: boolean; ssrData?: BridgeSsrData }): React.ReactElement {
  const [projects, setProjects] = useState<NonNullable<BridgeSsrData["projects"]>["projects"] | null>(ssrData?.projects?.projects ?? null);
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [sponsor, setSponsor] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const load = (): void => { Api.projects().then((r) => setProjects(r.projects)).catch(() => undefined); };
  useEffect(() => { load(); });

  const create = async (): Promise<void> => {
    const g = Number(goal);
    if (Number.isNaN(g)) return;
    await Api.postProject({ title, goalMinor: Math.round(g * 100), currency: "NGN", sponsoredBy: sponsor || undefined }).catch((e: Error) => setNote(e.message));
    setTitle(""); setGoal(""); setSponsor("");
    load();
  };

  return (
    <div>
      {isAdmin && (
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--c-hairline)" }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Project, e.g. Chemistry lab block" aria-label="Project title" style={inputStyle} />
          <input value={goal} onChange={(e) => setGoal(e.target.value)} inputMode="decimal" placeholder="Goal (naira)" aria-label="Project goal" style={inputStyle} />
          <input value={sponsor} onChange={(e) => setSponsor(e.target.value)} placeholder="Sponsoring set (optional)" aria-label="Sponsor" style={inputStyle} />
          <button type="button" className="btn btn--outlined press" style={{ margin: "8px 0" }} onClick={() => void create()} disabled={title.trim().length < 2}>Post project</button>
        </div>
      )}
      {note !== null && <p className="micro" style={{ padding: "8px 16px 0" }}>{note}</p>}
      {projects === null ? null : projects.length === 0 ? (
        <Empty title="No projects to adopt" body="Sets and classes sponsor specific renovations, labs or libraries." />
      ) : projects.map((p) => {
        const progress = Math.min(100, Math.round((p.raisedMinor / Math.max(p.goalMinor, 1)) * 100));
        return (
          <div key={p.id} style={{ borderBottom: "1px solid var(--c-hairline)", padding: "12px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ font: "600 15px var(--font-ui)" }}>{p.title}{p.sponsoredBy !== null ? ` · ${p.sponsoredBy}` : ""}</span>
              <span className="micro">{p.status}</span>
            </div>
            {p.story !== null && <p className="micro" style={{ margin: "2px 0" }}>{p.story}</p>}
            <div style={{ height: 6, background: "var(--c-neutral-100)", marginTop: 6 }}>
              <div style={{ width: `${progress}%`, height: "100%", background: "var(--c-accent)", transition: "width var(--motion-base, 200ms) ease-out" }} />
            </div>
            <div className="micro tabular" style={{ marginTop: 4 }}>
              {money(p.raisedMinor, p.currency)} of {money(p.goalMinor, p.currency)}
              {p.progressNotes !== null ? ` · ${p.progressNotes}` : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PastQuestions({ isAdmin, ssrData }: { isAdmin: boolean; ssrData?: BridgeSsrData }): React.ReactElement {
  const [questions, setQuestions] = useState<NonNullable<BridgeSsrData["questions"]>["questions"] | null>(ssrData?.questions?.questions ?? null);
  const [subject, setSubject] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [upload, setUpload] = useState<{ mediaId: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = (): void => { Api.pastQuestions().then((r) => setQuestions(r.questions)).catch(() => undefined); };
  useEffect(() => { load(); });

  const attach = async (file: File): Promise<void> => {
    try {
      const media = await Api.uploadMedia(file);
      setUpload({ mediaId: media.id });
    } catch (e) { setNote((e as Error).message); }
  };

  const post = async (): Promise<void> => {
    if (upload === null || subject.trim() === "") return;
    await Api.postPastQuestion({ subject, mediaId: upload.mediaId }).catch((e: Error) => setNote(e.message));
    setSubject(""); setUpload(null);
    load();
  };

  return (
    <div>
      {isAdmin && (
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--c-hairline)" }}>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject, e.g. Physics" aria-label="Subject" style={inputStyle} />
          <input ref={fileRef} type="file" accept="application/pdf,image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f !== undefined) void attach(f); }} />
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn--underline-link press" onClick={() => fileRef.current?.click()}>
              {upload !== null ? "File attached" : "Attach exam file"}
            </button>
            <button type="button" className="btn btn--filled press" onClick={() => void post()} disabled={upload === null || subject.trim() === ""}>Upload to the bank</button>
          </div>
        </div>
      )}
      {note !== null && <p className="micro" style={{ padding: "8px 16px 0" }}>{note}</p>}
      {questions === null ? null : questions.length === 0 ? (
        <Empty title="The bank is empty" body="Past exams, notes and study materials for current students." />
      ) : questions.map((q) => (
        <div key={q.id} className="row" style={{ padding: "8px 16px" }}>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", font: "600 14px var(--font-ui)" }}>
              {q.subject}{q.year !== null ? ` · ${String(q.year)}` : ""}{q.title !== null ? ` — ${q.title}` : ""}
            </span>
          </span>
          <a href={`/v1/media/${q.media_id}`} download style={{ font: "13px var(--font-ui)", color: "var(--c-accent)" }}>Open</a>
        </div>
      ))}
    </div>
  );
}

function Tributes({ ssrData }: { ssrData?: BridgeSsrData }): React.ReactElement {
  const [tributes, setTributes] = useState<NonNullable<BridgeSsrData["tributes"]>["tributes"] | null>(ssrData?.tributes?.tributes ?? null);
  const [name, setName] = useState("");
  const [story, setStory] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const load = (): void => { Api.teacherTributes().then((r) => setTributes(r.tributes)).catch(() => undefined); };
  useEffect(() => { load(); });

  const submit = async (): Promise<void> => {
    try {
      await Api.postTeacherTribute({ teacherName: name, story });
      setName(""); setStory("");
      load();
    } catch (e) { setNote((e as Error).message); }
  };

  return (
    <div>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--c-hairline)" }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Teacher's name" aria-label="Teacher name" style={inputStyle} />
        <textarea value={story} onChange={(e) => setStory(e.target.value)} placeholder="A heartfelt story…" aria-label="Tribute story"
          style={{ ...inputStyle, minHeight: 72, resize: "vertical", margin: "8px 0" }} />
        <button type="button" className="btn btn--filled press" onClick={() => void submit()} disabled={name.trim() === "" || story.trim().length < 10}>Post tribute</button>
      </div>
      {note !== null && <p className="micro" style={{ padding: "8px 16px 0" }}>{note}</p>}
      {tributes === null ? null : tributes.length === 0 ? (
        <Empty title="No tributes yet" body="Honor beloved retired and deceased teachers with stories and old photos." />
      ) : tributes.map((t, i) => (
        <div key={i} style={{ borderBottom: "1px solid var(--c-hairline)", padding: "12px 16px" }}>
          <div style={{ font: "700 15px var(--font-ui)", color: "var(--c-accent)" }}>{t.teacher_name}</div>
          <p style={{ font: "14px var(--font-ui)", margin: "4px 0 0" }}>{t.story}</p>
          <div className="micro">— {t.submitted_by_name}</div>
        </div>
      ))}
    </div>
  );
}

function Bookings({ isAdmin, ssrData }: { isAdmin: boolean; ssrData?: BridgeSsrData }): React.ReactElement {
  const [bookings, setBookings] = useState<NonNullable<BridgeSsrData["bookings"]>["bookings"] | null>(ssrData?.bookings?.bookings ?? null);
  const [facility, setFacility] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const load = (): void => { Api.bookings().then((r) => setBookings(r.bookings)).catch(() => undefined); };
  useEffect(() => { load(); });

  const request = async (): Promise<void> => {
    if (facility.trim() === "" || start === "" || end === "") return;
    await Api.requestBooking({ facility, startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString() }).catch((e: Error) => setNote(e.message));
    setFacility(""); setStart(""); setEnd("");
    load();
  };

  const decide = async (id: string, decision: "approve" | "decline"): Promise<void> => {
    await Api.decideBooking(id, decision).catch((e: Error) => setNote(e.message));
    load();
  };

  return (
    <div>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--c-hairline)" }}>
        <p className="micro" style={{ margin: "0 0 8px" }}>Rent school halls and fields (verified alumni; admins approve)</p>
        <input value={facility} onChange={(e) => setFacility(e.target.value)} placeholder="Facility, e.g. Main Hall" aria-label="Facility" style={inputStyle} />
        <input value={start} onChange={(e) => setStart(e.target.value)} type="datetime-local" aria-label="Booking start" style={inputStyle} />
        <input value={end} onChange={(e) => setEnd(e.target.value)} type="datetime-local" aria-label="Booking end" style={inputStyle} />
        <button type="button" className="btn btn--filled press" style={{ margin: "8px 0" }} onClick={() => void request()} disabled={facility.trim() === "" || start === "" || end === ""}>Request booking</button>
      </div>
      {note !== null && <p className="micro" style={{ padding: "8px 16px 0" }}>{note}</p>}
      {bookings === null ? null : bookings.length === 0 ? (
        <Empty title="No bookings" body="Your requests and approvals show here." />
      ) : bookings.map((b) => (
        <div key={b.id} className="row" style={{ padding: "8px 16px", flexWrap: "wrap" }}>
          <span style={{ flex: 1, minWidth: 200 }}>
            <span style={{ display: "block", font: "500 14px var(--font-ui)" }}>
              {b.facility} — {new Date(b.startsAt).toLocaleString()}
            </span>
            <span className="micro">by {b.memberName} · {b.status}</span>
          </span>
          {isAdmin && b.status === "requested" && (
            <span style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn--filled press" style={{ minHeight: 36 }} onClick={() => void decide(b.id, "approve")}>Approve</button>
              <button type="button" className="btn btn--underline-link press" style={{ minHeight: 36 }} onClick={() => void decide(b.id, "decline")}>Decline</button>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function Records({ isAdmin }: { isAdmin: boolean }): React.ReactElement {
  const [requests, setRequests] = useState<Array<{ id: string; employerName: string; employerEmail: string; status: string }> | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const load = (): void => { Api.recordsRequests().then((r) => setRequests(r.requests)).catch(() => undefined); };
  useEffect(() => { load(); });

  const request = async (): Promise<void> => {
    try {
      await Api.requestRecordsVerification({ employerName: name, employerEmail: email });
      setName(""); setEmail("");
      load();
    } catch (e) { setNote((e as Error).message); }
  };

  const decide = async (id: string, decision: "verify" | "decline"): Promise<void> => {
    await Api.decideRecordsRequest(id, decision).catch((e: Error) => setNote(e.message));
    load();
  };

  return (
    <div>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--c-hairline)" }}>
        <p className="micro" style={{ margin: "0 0 8px" }}>Employers request officially verified enrollment and graduation records</p>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Employer name" aria-label="Employer name" style={inputStyle} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Employer email" aria-label="Employer email" style={inputStyle} />
        <button type="button" className="btn btn--filled press" style={{ margin: "8px 0" }} onClick={() => void request()} disabled={name.trim() === "" || email === ""}>Request verification</button>
      </div>
      {note !== null && <p className="micro" style={{ padding: "8px 16px 0" }}>{note}</p>}
      {requests === null ? null : requests.length === 0 ? (
        <Empty title="No verification requests" body="Your requests and their status show here." />
      ) : requests.map((r) => (
        <div key={r.id} className="row" style={{ padding: "8px 16px", flexWrap: "wrap" }}>
          <span style={{ flex: 1, minWidth: 200 }}>
            <span style={{ display: "block", font: "500 14px var(--font-ui)" }}>
              {r.employerName} — {r.employerEmail}
            </span>
            <span className="micro">{r.status}</span>
          </span>
          {isAdmin && r.status === "requested" && (
            <span style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn--filled press" style={{ minHeight: 36 }} onClick={() => void decide(r.id, "verify")}>Verify</button>
              <button type="button" className="btn btn--underline-link press" style={{ minHeight: 36 }} onClick={() => void decide(r.id, "decline")}>Decline</button>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
