/**
 * Structured giving screens (Phase 4 batch 3, session 4.4):
 * P2P fundraisers, pledges, reimbursements, sponsorships, scholarships,
 * ledger publications — member-facing sections plus Manage queues.
 * K5: pledges and their nudges are private and polite. K2: recognition
 * without league tables.
 */
import React, { useEffect, useRef, useState } from "react";
import { Api } from "../api.js";
import { Section } from "./ProfileScreen.js";
import type { P2pView, PledgeView, ReimbView, SponsorView, ScholarshipView, Publication } from "../events-types.js";

const money = (minor: number, currency: string): string =>
  `${(minor / 100).toLocaleString()} ${currency}`;

/** Menu → Giving: P2P, pledges, reimbursements, sponsors, scholarships. */
export function StructuredGiving(): React.ReactElement {
  const [p2ps, setP2ps] = useState<P2pView[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [p2pTitle, setP2pTitle] = useState("");
  const [p2pGoal, setP2pGoal] = useState("");

  const load = (): void => {
    Api.listP2p().then((r) => setP2ps(r.fundraisers)).catch(() => undefined);
  };
  useEffect(load, []);

  const createP2p = async (): Promise<void> => {
    const goal = Number(p2pGoal);
    if (p2pTitle.trim().length < 2 || Number.isNaN(goal)) return;
    try {
      await Api.createP2p({ title: p2pTitle, goalMinor: Math.round(goal * 100), currency: "NGN" });
      setNote("Fundraiser sent for admin approval.");
      setP2pTitle(""); setP2pGoal("");
      load();
    } catch (e) { setNote((e as Error).message); }
  };

  const giveP2p = async (id: string): Promise<void> => {
    try {
      await Api.giveP2p(id, { amountMinor: 50000, currency: "NGN" });
      setNote("Thank you — your gift awaits treasurer confirmation.");
      load();
    } catch (e) { setNote((e as Error).message); }
  };

  return (
    <Section label="Fundraisers (P2P)">
      {note !== null && <p style={{ font: "13px var(--font-ui)", color: "var(--c-accent)", margin: "0 0 8px" }}>{note}</p>}
      {p2ps === null ? <div className="skeleton" style={{ height: 32 }} /> : p2ps.length === 0 ? (
        <p style={{ font: "14px var(--font-ui)", color: "var(--c-neutral-500)" }}>No fundraisers yet. Start one — admins review it first.</p>
      ) : p2ps.map((f) => (
        <div key={f.id} style={{ borderBottom: "1px solid var(--c-hairline)", padding: "8px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span style={{ font: "600 14px var(--font-ui)" }}>{f.title}</span>
            <span className="micro">{f.status}{f.mine ? " · yours" : ` · by ${f.creator}`}</span>
          </div>
          {f.story !== null && <p className="micro" style={{ margin: "2px 0" }}>{f.story}</p>}
          <div className="micro tabular">{money(f.raisedMinor, f.currency)} of {money(f.goalMinor, f.currency)}</div>
          {f.status === "approved" && !f.mine && (
            <button type="button" className="btn btn--underline-link press" style={{ minHeight: 28 }} onClick={() => void giveP2p(f.id)}>Give 500</button>
          )}
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <input value={p2pTitle} onChange={(e) => setP2pTitle(e.target.value)} placeholder="Fundraiser title" aria-label="Fundraiser title"
          style={{ flex: 1, minWidth: 160, minHeight: 44, padding: "0 12px", border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "14px var(--font-ui)", color: "var(--c-base-contrast)" }} />
        <input value={p2pGoal} onChange={(e) => setP2pGoal(e.target.value)} inputMode="decimal" placeholder="Goal (naira)" aria-label="Fundraiser goal"
          style={{ minHeight: 44, padding: "0 12px", border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "14px var(--font-ui)", color: "var(--c-base-contrast)" }} />
        <button type="button" className="btn btn--outlined press" onClick={() => void createP2p()} disabled={p2pTitle.trim().length < 2}>Propose</button>
      </div>
    </Section>
  );
}

export function PledgesSection(): React.ReactElement {
  const [pledges, setPledges] = useState<PledgeView[] | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const load = (): void => { Api.myPledges().then((r) => setPledges(r.pledges)).catch(() => undefined); };
  useEffect(load, []);

  const promise = async (): Promise<void> => {
    const amt = Number(amount);
    if (Number.isNaN(amt)) return;
    await Api.createPledge({ amountMinor: Math.round(amt * 100), currency: "NGN" }).catch((e: Error) => setNote(e.message));
    setAmount(""); load();
  };
  const fulfil = async (id: string): Promise<void> => {
    await Api.fulfilPledge(id).catch((e: Error) => setNote(e.message));
    setNote("Fulfilment awaits treasurer confirmation.");
    load();
  };

  return (
    <Section label="My pledges (private)">
      <p className="micro" style={{ paddingBottom: 8 }}>Only you see these. Nudges are gentle and rare.</p>
      {pledges === null ? <div className="skeleton" style={{ height: 32 }} /> : pledges.length === 0 ? (
        <p style={{ font: "14px var(--font-ui)", color: "var(--c-neutral-500)" }}>No open pledges.</p>
      ) : pledges.map((p) => (
        <div key={p.id} className="row" style={{ padding: "8px 0" }}>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", font: "500 14px var(--font-ui)" }}>
              <span className="tabular">{money(p.amountMinor, p.currency)}</span> {p.status}
              {p.campaign !== null ? ` · ${p.campaign}` : ""}
            </span>
            <span className="micro tabular">promised {new Date(p.promisedAt).toLocaleDateString()}{p.dueDate !== null ? ` · by ${new Date(p.dueDate).toLocaleDateString()}` : ""}</span>
          </span>
          {p.status === "promised" && (
            <button type="button" className="btn btn--filled press" style={{ minHeight: 36 }} onClick={() => void fulfil(p.id)}>Fulfil</button>
          )}
        </div>
      ))}
      <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="Promise an amount (naira)" aria-label="Pledge amount"
        style={{ width: "100%", minHeight: 44, border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "14px var(--font-ui)", color: "var(--c-base-contrast)" }} />
      <button type="button" className="btn btn--outlined press" style={{ marginTop: 8 }} onClick={() => void promise()} disabled={amount === ""}>Record pledge</button>
      {note !== null && <p style={{ font: "13px var(--font-ui)", color: "var(--c-accent)", marginTop: 8 }}>{note}</p>}
    </Section>
  );
}

export function ReimbursementsSection(): React.ReactElement {
  const [claims, setClaims] = useState<ReimbView[] | null>(null);
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const receiptRef = useRef<HTMLInputElement | null>(null);
  const [receiptMediaId, setReceiptMediaId] = useState<string | undefined>(undefined);
  const [note, setNote] = useState<string | null>(null);

  const load = (): void => { Api.myReimbursements().then((r) => setClaims(r.claims)).catch(() => undefined); };
  useEffect(load, []);

  const attach = async (file: File): Promise<void> => {
    try {
      const media = await Api.uploadMedia(file);
      setReceiptMediaId(media.id);
      setNote("Receipt attached.");
    } catch (e) { setNote((e as Error).message); }
  };

  const submit = async (): Promise<void> => {
    const amt = Number(amount);
    if (memo.trim().length < 4 || Number.isNaN(amt)) return;
    try {
      await Api.submitReimbursement({ amountMinor: Math.round(amt * 100), currency: "NGN", memo, receiptMediaId });
      setAmount(""); setMemo(""); setReceiptMediaId(undefined);
      load();
    } catch (e) { setNote((e as Error).message); }
  };

  return (
    <Section label="Expense reimbursements">
      {claims === null ? <div className="skeleton" style={{ height: 32 }} /> : claims.length > 0 && claims.map((c) => (
        <div key={c.id} className="row" style={{ padding: "8px 0" }}>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", font: "500 14px var(--font-ui)" }}>
              <span className="tabular">{money(c.amountMinor, c.currency)}</span> — {c.memo}
            </span>
            <span className="micro tabular">{new Date(c.createdAt).toLocaleDateString()} · {c.status}</span>
          </span>
        </div>
      ))}
      <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="Amount spent (naira)" aria-label="Reimbursement amount"
        style={{ width: "100%", minHeight: 44, border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "14px var(--font-ui)", color: "var(--c-base-contrast)" }} />
      <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="What was it for?" aria-label="Reimbursement memo"
        style={{ width: "100%", minHeight: 44, border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "14px var(--font-ui)", color: "var(--c-base-contrast)" }} />
      <input ref={receiptRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f !== undefined) void attach(f); }} />
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn btn--underline-link press" onClick={() => receiptRef.current?.click()}>
          {receiptMediaId !== undefined ? "Receipt attached" : "Attach receipt"}
        </button>
        <button type="button" className="btn btn--filled press" onClick={() => void submit()} disabled={memo.trim().length < 4 || amount === ""}>Submit claim</button>
      </div>
      {note !== null && <p style={{ font: "13px var(--font-ui)", color: "var(--c-accent)", marginTop: 8 }}>{note}</p>}
    </Section>
  );
}

export function SponsorsSection(): React.ReactElement {
  const [sponsors, setSponsors] = useState<SponsorView[] | null>(null);
  useEffect(() => { Api.sponsors().then((r) => setSponsors(r.sponsors)).catch(() => undefined); }, []);
  return (
    <Section label="Our sponsors">
      {sponsors === null ? <div className="skeleton" style={{ height: 32 }} /> : sponsors.length === 0 ? (
        <p style={{ font: "14px var(--font-ui)", color: "var(--c-neutral-500)" }}>Sponsor recognitions appear here.</p>
      ) : sponsors.map((s, i) => (
        <div key={i} className="row" style={{ padding: "8px 0" }}>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", font: "600 14px var(--font-ui)" }}>{s.sponsor_name} <span className="micro">{s.tier}</span></span>
            {s.recognition !== null && <span className="micro">{s.recognition}</span>}
          </span>
        </div>
      ))}
    </Section>
  );
}

export function ScholarshipsSection(): React.ReactElement {
  const [scholarships, setScholarships] = useState<ScholarshipView[] | null>(null);
  const [applyFor, setApplyFor] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("");
  const [statement, setStatement] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const load = (): void => { Api.listScholarships().then((r) => setScholarships(r.scholarships)).catch(() => undefined); };
  useEffect(load, []);

  const apply = async (id: string): Promise<void> => {
    if (studentName.trim().length < 2 || statement.trim().length < 10) return;
    try {
      await Api.applyScholarship(id, { studentName, statement });
      setNote("Application submitted for screening.");
      setApplyFor(null); setStudentName(""); setStatement("");
    } catch (e) { setNote((e as Error).message); }
  };

  return (
    <Section label="Scholarships">
      {note !== null && <p style={{ font: "13px var(--font-ui)", color: "var(--c-accent)", margin: "0 0 8px" }}>{note}</p>}
      {scholarships === null ? <div className="skeleton" style={{ height: 32 }} /> : scholarships.length === 0 ? (
        <p style={{ font: "14px var(--font-ui)", color: "var(--c-neutral-500)" }}>No endowed scholarships yet.</p>
      ) : scholarships.map((s) => (
        <div key={s.id} style={{ borderBottom: "1px solid var(--c-hairline)", padding: "8px 0" }}>
          <div style={{ font: "600 14px var(--font-ui)" }}>{s.name}</div>
          {s.description !== null && <p className="micro" style={{ margin: "2px 0" }}>{s.description}</p>}
          <div className="micro tabular">Endowed: {money(s.endowedMinor, s.currency)}</div>
          {s.status === "open" && (
            <button type="button" className="btn btn--underline-link press" style={{ minHeight: 28 }} onClick={() => setApplyFor(s.id)}>Apply for a student</button>
          )}
          {applyFor === s.id && (
            <div style={{ marginTop: 8 }}>
              <input value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Student name" aria-label="Student name"
                style={{ width: "100%", minHeight: 44, border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "14px var(--font-ui)", color: "var(--c-base-contrast)" }} />
              <textarea value={statement} onChange={(e) => setStatement(e.target.value)} placeholder="Why this student needs support…" aria-label="Statement"
                style={{ width: "100%", minHeight: 56, border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "14px var(--font-ui)", color: "var(--c-base-contrast)", resize: "vertical" }} />
              <button type="button" className="btn btn--filled press" style={{ minHeight: 36 }} onClick={() => void apply(s.id)} disabled={studentName.trim().length < 2 || statement.trim().length < 10}>Submit</button>
            </div>
          )}
        </div>
      ))}
    </Section>
  );
}

/** Manage: publish a period snapshot of the transparent ledger. */
export function PublicationsSection(): React.ReactElement {
  const [publications, setPublications] = useState<Publication[] | null>(null);
  const [period, setPeriod] = useState(new Date().getFullYear().toString());
  const [note, setNote] = useState<string | null>(null);

  const load = (): void => { Api.publications().then((r) => setPublications(r.publications)).catch(() => undefined); };
  useEffect(load, []);

  const publish = async (): Promise<void> => {
    if (!/^\d{4}$/.test(period)) return;
    const r = await Api.publishLedger(period).catch((e: Error) => { setNote(e.message); return null; });
    if (r !== null) { setNote("Published."); load(); }
  };

  return (
    <Section label="Ledger publishing">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Publish period"
          style={{ minHeight: 44, padding: "0 12px", border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "14px var(--font-ui)", color: "var(--c-base-contrast)" }} />
        <button type="button" className="btn btn--filled press" onClick={() => void publish()}>Publish snapshot</button>
      </div>
      {note !== null && <p style={{ font: "13px var(--font-ui)", color: "var(--c-accent)", marginTop: 8 }}>{note}</p>}
      {publications !== null && publications.map((p) => (
        <div key={p.id} className="row" style={{ padding: "8px 0" }}>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", font: "600 14px var(--font-ui)" }}>{p.period}</span>
            <span className="micro tabular">{p.row_count} entries · {new Date(p.published_at).toLocaleDateString()} · {p.published_by_name}</span>
          </span>
          {Object.entries(p.totals).map(([cur, v]) => (
            <span key={cur} className="tabular" style={{ font: "600 14px var(--font-ui)" }}>{money(v.minor, cur)}</span>
          ))}
        </div>
      ))}
    </Section>
  );
}
