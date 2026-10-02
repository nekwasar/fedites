/**
 * Career screens (Phase 5 batch 5, session 5.4b) — enterprise job system:
 * Job board (fresh-grad priority, filters, saved jobs, hiring pipeline
 * visible to the applicant), alumni business directory with reviews, mentor
 * office hours with bookable slots + external meeting links, referral
 * requests, and skill endorsements. Flat rows/hairlines, no emojis.
 */
import React, { useEffect, useState } from "react";
import { Api } from "../api.js";
import { Empty, SkeletonList } from "./InboxScreen.js";
import type { BizRow, MentorRow, ReferralRow } from "../events-types.js";
import { Button } from "@fedites/ui";
import { defaultConfig, type CareersPageConfig } from "@fedites/config";
import { useCareersPage, type CareersPageState } from "../hooks/useCareersPage.js";
import { CareersHeaderRegistry, CareerFilterChips, JobCardRegistry } from "../careers/CareerRegistries.js";

const inputStyle: React.CSSProperties = {
  width: "100%", minHeight: 44, border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "15px var(--font-ui)", color: "var(--c-base-contrast)",
};
const fieldStyle: React.CSSProperties = {
  flex: 1, minWidth: 140, minHeight: 44, padding: "0 12px", border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "14px var(--font-ui)", color: "var(--c-base-contrast)",
};

export function CareerScreen({ careersConfig }: { careersConfig?: CareersPageConfig }): React.ReactElement {
  const state = useCareersPage(careersConfig ?? defaultConfig.careersPage);
  const [tab, setTab] = useState<"jobs" | "business" | "mentors" | "referrals">("jobs");
  return (
    <main className="screen-pad">
      <CareersHeaderRegistry
        variant={state.config.headerVariant}
        state={state}
        tab={tab}
        onTab={(k) => setTab(k as "jobs" | "business" | "mentors" | "referrals")}
      />
      {tab === "jobs" && <JobsView state={state} />}
      {tab === "business" && <Business />}
      {tab === "mentors" && <Mentors />}
      {tab === "referrals" && <Referrals />}
    </main>
  );
}

/* --------------------------------- jobs -------------------------------- */

function JobsView({ state }: { state: CareersPageState }): React.ReactElement {
  return (
    <div>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--c-hairline)", display: "flex", gap: 8, alignItems: "center" }}>
        <span className="micro" style={{ flex: 1 }}>
          Fresh-graduate roles always surface first on this board.
        </span>
        {!state.posting && (
          <button type="button" className="btn btn--filled press" style={{ minHeight: 44 }} onClick={() => state.setPosting(true)}>Post a job</button>
        )}
      </div>
      <CareerFilterChips state={state} />
      {state.posting && <PostJob onDone={() => { state.setPosting(false); state.reload(); }} />}
      {state.note !== null && <p className="micro" style={{ padding: "8px 16px 0" }}>{state.note}</p>}
      {state.apps.length > 0 && (
        <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--c-hairline)" }}>
          <div className="micro" style={{ paddingBottom: 4 }}>My applications</div>
          {state.apps.map((a) => (
            <div key={a.id} style={{ font: "13px var(--font-ui)" }}>
              {a.title} at {a.companyName} — <b>{a.status.replace("_", " ")}</b>
            </div>
          ))}
        </div>
      )}
      {state.jobs === null ? <SkeletonList /> : state.jobs.length === 0 ? (
        <Empty title="No open roles" body="Alumni post openings and internships here — fresh graduates always prioritized." />
      ) : state.jobs.map((j) => (
        <JobCardRegistry key={j.id} variant={state.config.jobCardVariant} data={j} state={state} />
      ))}
      {state.saved.length > 0 && (
        <div style={{ padding: 16 }}>
          <div className="micro" style={{ paddingBottom: 4 }}>Saved jobs</div>
          {state.saved.map((s) => (
            <div key={s.id} style={{ font: "13px var(--font-ui)", padding: "4px 0" }}>
              {s.title} at {s.company_name}
              <button type="button" className="btn btn--underline-link press" style={{ minHeight: 24 }} onClick={() => void state.toggleSave(s.id, true)}>Remove</button>
            </div>
          ))}
        </div>
      )}
      {state.pendingApply !== null && (
        <div className="overlay" onClick={() => state.setPendingApply(null)} style={{ alignItems: "flex-end" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", background: "var(--c-base)", borderTop: "2px solid var(--c-accent)", padding: "var(--space-4)" }}>
            <div className="micro" style={{ paddingBottom: 8 }}>Cover note (optional)</div>
            <textarea value={state.coverNote} onChange={(e) => state.setCoverNote(e.target.value)} placeholder="Short note to the posting alumnus" aria-label="Cover note"
              style={{ width: "100%", minHeight: 64, border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "15px var(--font-ui)", color: "var(--c-base-contrast)", resize: "vertical" }} />
            <div style={{ marginTop: 8 }}>
              <Button kind="filled" onClick={() => void state.confirmApply()}>Send application</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PostJob({ onDone }: { onDone: () => void }): React.ReactElement {
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [description, setDescription] = useState("");
  const [industry, setIndustry] = useState("");
  const [city, setCity] = useState("");
  const [type, setType] = useState("full_time");
  const [mode, setMode] = useState("onsite");
  const [error, setError] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    try {
      await Api.postJob({
        title, companyName: company, description,
        industry: industry || undefined, city: city || undefined,
        employmentType: type as "full_time", workMode: mode as "onsite",
      });
      onDone();
    } catch (e) { setError((e as Error).message); }
  };

  return (
    <div style={{ marginTop: 8 }}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Role title" aria-label="Job title" style={inputStyle} />
      <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" aria-label="Company" style={inputStyle} />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="The role and what success looks like…" aria-label="Job description"
        style={{ ...inputStyle, minHeight: 72, resize: "vertical", margin: "8px 0" }} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Industry" aria-label="Industry" style={fieldStyle} />
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" aria-label="City" style={fieldStyle} />
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type" style={{ ...fieldStyle, background: "var(--c-base)" }}>
          <option value="full_time">Full time</option>
          <option value="contract">Contract</option>
          <option value="internship">Internship</option>
          <option value="graduate_trainee">Graduate trainee</option>
        </select>
        <select value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Mode" style={{ ...fieldStyle, background: "var(--c-base)" }}>
          <option value="onsite">Onsite</option>
          <option value="hybrid">Hybrid</option>
          <option value="remote">Remote</option>
        </select>
      </div>
      {error !== null && <p className="micro" style={{ color: "var(--c-danger)" }}>{error}</p>}
      <button type="button" className="btn btn--filled press" style={{ margin: "8px 0" }} onClick={() => void submit()} disabled={title.trim().length < 2 || company.trim() === "" || description.trim().length < 10}>Post opening</button>
    </div>
  );
}

/* ---------------------------- business directory ---------------------- */

function Business(): React.ReactElement {
  const [list, setList] = useState<BizRow[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ business: { id: string; name: string; industry: string; description: string | null; services: string | null; contactPhone: string | null; contactEmail: string | null; openingHours: string | null; promoOffer: string | null; owner: string }; reviews: Array<{ rating: number; comment: string | null; reviewer: string }> } | null>(null);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [services, setServices] = useState("");
  const [promo, setPromo] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const load = (): void => { Api.businesses().then((r) => setList(r.businesses)).catch(() => undefined); };
  useEffect(load, []);

  const openBiz = (id: string): void => {
    Api.businessDetail(id).then((r) => { setDetail(r as never); setOpen(id); }).catch(() => undefined);
  };

  const create = async (): Promise<void> => {
    try {
      await Api.createBusiness({ name, industry, services: services || undefined, promoOffer: promo || undefined });
      setName(""); setIndustry(""); setServices(""); setPromo("");
      load();
    } catch (e) { setNote((e as Error).message); }
  };

  const review = async (businessId: string): Promise<void> => {
    try {
      await Api.reviewBusiness(businessId, { rating, comment: comment || undefined });
      setComment("");
      openBiz(businessId);
    } catch (e) { setNote((e as Error).message); }
  };

  if (open !== null && detail !== null) {
    return (
      <div style={{ padding: 16 }}>
        <button type="button" className="btn btn--underline-link press" onClick={() => setOpen(null)}>Directory</button>
        <h2 style={{ font: "700 22px var(--font-ui)" }}>{detail.business.name}</h2>
        <div className="micro">{detail.business.industry} · owner {detail.business.owner}</div>
        {detail.business.description !== null && <p style={{ font: "14px var(--font-ui)" }}>{detail.business.description}</p>}
        {detail.business.services !== null && <p className="micro">Services: {detail.business.services}</p>}
        {detail.business.openingHours !== null && <p className="micro">Hours: {detail.business.openingHours}</p>}
        {detail.business.promoOffer !== null && <p style={{ font: "600 14px var(--font-ui)", color: "var(--c-accent)" }}>{detail.business.promoOffer}</p>}
        {detail.business.contactPhone !== null && <p className="micro tabular">Phone: {detail.business.contactPhone}</p>}
        {detail.business.contactEmail !== null && <p className="micro">Email: {detail.business.contactEmail}</p>}

        <div className="micro" style={{ margin: "16px 0 8px" }}>Reviews</div>
        {detail.reviews.map((r, i) => (
          <div key={i} style={{ borderBottom: "1px solid var(--c-hairline)", padding: "8px 0" }}>
            <span className="micro tabular">{r.rating}/5 — {r.reviewer}</span>
            {r.comment !== null && <div style={{ font: "14px var(--font-ui)" }}>{r.comment}</div>}
          </div>
        ))}
        <div style={{ marginTop: 8 }}>
          <select value={rating} onChange={(e) => setRating(Number(e.target.value))} aria-label="Rating" style={{ ...fieldStyle, background: "var(--c-base)", maxWidth: 120 }}>
            {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r}/5</option>)}
          </select>
          <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Your review (optional)" aria-label="Review comment" style={{ ...inputStyle, marginTop: 8 }} />
          <button type="button" className="btn btn--outlined press" style={{ marginTop: 8 }} onClick={() => void review(detail.business.id)}>Post review</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--c-hairline)" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Business name" aria-label="Business name" style={fieldStyle} />
          <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Industry" aria-label="Industry" style={fieldStyle} />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <input value={services} onChange={(e) => setServices(e.target.value)} placeholder="Services" aria-label="Services" style={fieldStyle} />
          <input value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="Alumni promo offer (optional)" aria-label="Promo" style={fieldStyle} />
        </div>
        <button type="button" className="btn btn--filled press" style={{ margin: "8px 0" }} onClick={() => void create()} disabled={name.trim() === "" || industry.trim() === ""}>List business</button>
      </div>
      {note !== null && <p className="micro" style={{ padding: "8px 16px 0" }}>{note}</p>}
      {list === null ? <SkeletonList /> : list.length === 0 ? (
        <Empty title="The directory awaits" body="Showcase alumni-owned businesses — services, hours, offers, reviews." />
      ) : list.map((b) => (
        <button key={b.id} type="button" className="row press" style={{ cursor: "pointer", flexWrap: "wrap" }} onClick={() => openBiz(b.id)}>
          <span style={{ flex: 1, minWidth: 200, textAlign: "left" }}>
            <span style={{ display: "block", font: "600 15px var(--font-ui)" }}>{b.name}</span>
            <span className="micro">{b.industry}{b.city !== null ? ` · ${b.city}` : ""}</span>
          </span>
          {b.promoOffer !== null && <span className="micro" style={{ color: "var(--c-accent)" }}>{b.promoOffer}</span>}
          {b.rating !== null && <span className="micro tabular">{b.rating}/5 ({b.reviewCount})</span>}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------ mentors ------------------------------- */

function Mentors(): React.ReactElement {
  const [mentors, setMentors] = useState<MentorRow[] | null>(null);
  const [mine, setMine] = useState<{ asMentor: Array<{ id: string; with: string; at: string; meetingUrl: string | null; status: string }>; asMentee: Array<{ id: string; with: string; at: string; meetingUrl: string | null; status: string }> } | null>(null);
  const [expertise, setExpertise] = useState("");
  const [link, setLink] = useState("");
  const [slotStart, setSlotStart] = useState("");
  const [slotEnd, setSlotEnd] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const load = (): void => {
    Api.mentors().then((r) => setMentors(r.mentors)).catch(() => undefined);
    Api.myMentoring().then((r) => setMine(r)).catch(() => undefined);
  };
  useEffect(load, []);

  const become = async (): Promise<void> => {
    try {
      await Api.becomeMentor({ expertise, defaultLink: link || undefined });
      setNote("You are a mentor. Publish office-hour slots next.");
      setExpertise(""); setLink("");
      load();
    } catch (e) { setNote((e as Error).message); }
  };

  const addSlot = async (): Promise<void> => {
    if (slotStart === "" || slotEnd === "") return;
    try {
      await Api.addMentorSlot({ startsAt: new Date(slotStart).toISOString(), endsAt: new Date(slotEnd).toISOString() });
      setSlotStart(""); setSlotEnd("");
      load();
    } catch (e) { setNote((e as Error).message); }
  };

  const book = async (slotId: string): Promise<void> => {
    try {
      const r = await Api.bookMentorSlot(slotId, {});
      setNote(r.meetingUrl !== null ? `Booked — join via ${r.meetingUrl}` : "Booked — the mentor will share the meeting link.");
      load();
    } catch (e) { setNote((e as Error).message); }
  };


  return (
    <div>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--c-hairline)" }}>
        <p className="micro" style={{ margin: "0 0 8px" }}>Become a mentor — bookable office hours (external Meet/Zoom links)</p>
        <input value={expertise} onChange={(e) => setExpertise(e.target.value)} placeholder="Your expertise" aria-label="Expertise" style={inputStyle} />
        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Standing meeting link (optional)" aria-label="Standing link" style={inputStyle} />
        <button type="button" className="btn btn--filled press" style={{ margin: "8px 0" }} onClick={() => void become()} disabled={expertise.trim().length < 2}>Become a mentor</button>
        <input value={slotStart} onChange={(e) => setSlotStart(e.target.value)} type="datetime-local" aria-label="Slot start" style={inputStyle} />
        <input value={slotEnd} onChange={(e) => setSlotEnd(e.target.value)} type="datetime-local" aria-label="Slot end" style={inputStyle} />
        <button type="button" className="btn btn--outlined press" style={{ margin: "8px 0" }} onClick={() => void addSlot()} disabled={slotStart === "" || slotEnd === ""}>Publish slot</button>
      </div>
      {note !== null && <p className="micro" style={{ padding: "8px 16px 0" }}>{note}</p>}
      {mentors === null ? <SkeletonList /> : mentors.length === 0 ? (
        <Empty title="No mentors yet" body="Senior professionals offer one-on-one office hours right here." />
      ) : mentors.map((m) => (
        <div key={m.memberId} className="row" style={{ padding: "8px 16px", flexWrap: "wrap" }}>
          <span style={{ flex: 1, minWidth: 200 }}>
            <span style={{ display: "block", font: "600 15px var(--font-ui)" }}>{m.name}</span>
            <span className="micro">{m.expertise}{m.hasStandingLink ? " · has a standing room" : ""}</span>
          </span>
          <span className="micro tabular">{m.openSlots} open slots</span>
          {m.openSlots > 0 && (
            <button type="button" className="btn btn--filled press" style={{ minHeight: 36 }} onClick={() => void bookSlotFor(m)}>Book a slot</button>
          )}
        </div>
      ))}
      {mine !== null && (
        <>
          {mine.asMentee.length > 0 && (
            <div style={{ padding: 16 }}>
              <div className="micro" style={{ paddingBottom: 4 }}>My sessions</div>
              {mine.asMentee.map((b) => (
                <div key={b.id} style={{ font: "13px var(--font-ui)", padding: "4px 0" }}>
                  with {b.with} — {new Date(b.at).toLocaleString()} ({b.status})
                  {b.meetingUrl !== null && <a href={b.meetingUrl} target="_blank" rel="noreferrer" style={{ color: "var(--c-accent)", marginLeft: 8 }}>Join</a>}
                </div>
              ))}
            </div>
          )}
          {mine.asMentor.length > 0 && (
            <div style={{ padding: "0 16px 16px" }}>
              <div className="micro" style={{ paddingBottom: 4 }}>Booked with me</div>
              {mine.asMentor.map((b) => (
                <div key={b.id} style={{ font: "13px var(--font-ui)", padding: "4px 0" }}>
                  {b.with} — {new Date(b.at).toLocaleString()} ({b.status})
                  {b.meetingUrl !== null && <a href={b.meetingUrl} target="_blank" rel="noreferrer" style={{ color: "var(--c-accent)", marginLeft: 8 }}>Join</a>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  async function bookSlotFor(m: MentorRow): Promise<void> {
    const r = await Api.mentorSlots(m.memberId);
    if (r.slots.length > 0) await book(r.slots[0]!.id);
    else setNote("No open slots — check back soon.");
  }
}

/* ----------------------- referrals + endorsements --------------------- */

function Referrals(): React.ReactElement {
  const [data, setData] = useState<ReferralRow | null>(null);
  const [target, setTarget] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [skill, setSkill] = useState("");
  const [endorseTarget, setEndorseTarget] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const load = (): void => { Api.referrals().then((r) => setData(r)).catch(() => undefined); };
  useEffect(load, []);

  const ask = async (): Promise<void> => {
    try {
      await Api.askReferral({ targetMemberId: target, company, role });
      setNote("Request sent.");
      setTarget(""); setCompany(""); setRole("");
      load();
    } catch (e) { setNote((e as Error).message); }
  };

  const act = async (id: string, action: "accepted" | "declined" | "fulfilled"): Promise<void> => {
    await Api.respondReferral(id, action).catch((e: Error) => setNote(e.message));
    load();
  };

  const endorse = async (): Promise<void> => {
    try {
      await Api.endorseSkill({ memberId: endorseTarget, skill });
      setNote("Endorsement posted.");
      setEndorseTarget(""); setSkill("");
    } catch (e) { setNote((e as Error).message); }
  };

  return (
    <div>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--c-hairline)" }}>
        <p className="micro" style={{ margin: "0 0 8px" }}>Ask an alumnus at a target company for a referral</p>
        <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Target alumnus member id (from their profile URL)" aria-label="Target member id" style={inputStyle} />
        <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" aria-label="Company" style={inputStyle} />
        <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role" aria-label="Role" style={inputStyle} />
        <button type="button" className="btn btn--filled press" style={{ margin: "8px 0" }} onClick={() => void ask()} disabled={target.trim() === "" || company.trim() === "" || role.trim() === ""}>Ask for referral</button>
      </div>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--c-hairline)" }}>
        <p className="micro" style={{ margin: "0 0 8px" }}>Endorse a skill (dedup per skill)</p>
        <input value={endorseTarget} onChange={(e) => setEndorseTarget(e.target.value)} placeholder="Member id" aria-label="Endorse member id" style={inputStyle} />
        <input value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="Skill" aria-label="Skill" style={inputStyle} />
        <button type="button" className="btn btn--outlined press" style={{ margin: "8px 0" }} onClick={() => void endorse()} disabled={endorseTarget.trim() === "" || skill.trim() === ""}>Endorse</button>
      </div>
      {note !== null && <p className="micro" style={{ padding: "0 16px 8px" }}>{note}</p>}
      {data === null ? <SkeletonList /> : (
        <>
          {data.received.length > 0 && (
            <div style={{ padding: 16 }}>
              <div className="micro" style={{ paddingBottom: 4 }}>Requests to you</div>
              {data.received.map((r) => (
                <div key={r.id} className="row" style={{ padding: "8px 0", flexWrap: "wrap" }}>
                  <span style={{ flex: 1, minWidth: 180, font: "500 14px var(--font-ui)" }}>
                    {r.from} — {r.role} at {r.company} ({r.status})
                  </span>
                  {r.status === "requested" && (
                    <span style={{ display: "flex", gap: 8 }}>
                      <button type="button" className="btn btn--filled press" style={{ minHeight: 36 }} onClick={() => void act(r.id, "accepted")}>Accept</button>
                      <button type="button" className="btn btn--underline-link press" style={{ minHeight: 36 }} onClick={() => void act(r.id, "declined")}>Decline</button>
                    </span>
                  )}
                  {r.status === "accepted" && (
                    <button type="button" className="btn btn--filled press" style={{ minHeight: 36 }} onClick={() => void act(r.id, "fulfilled")}>Mark fulfilled</button>
                  )}
                </div>
              ))}
            </div>
          )}
          {data.sent.length > 0 && (
            <div style={{ padding: "0 16px 16px" }}>
              <div className="micro" style={{ paddingBottom: 4 }}>My requests</div>
              {data.sent.map((r) => (
                <div key={r.id} style={{ font: "13px var(--font-ui)", padding: "4px 0" }}>
                  {r.role} at {r.company} → {r.to}: <b>{r.status}</b>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
