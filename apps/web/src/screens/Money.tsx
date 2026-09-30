/**
 * Association (Phase 4 batch 1): my dues — PRIVATE (§P: member sees own
 * only, no public dues badge anywhere) — pay flow, receipts, tier, and my
 * payments & receipts history. Also the Manage→Money workbench for treasurers.
 */
import React, { useEffect, useRef, useState } from "react";
import { Api } from "../api.js";
import type { CampaignView } from "../events-types.js";
import { Section } from "./ProfileScreen.js";
import type { DuesAssessmentView, LedgerRow, TierView, AdminDuesRow, ReceiptView } from "../events-types.js";

export const money = (minor: number, currency: string): string =>
  `${(minor / 100).toLocaleString()} ${currency}`;

/** Menu → Association: the member's private money view. */
export function AssociationSection(): React.ReactElement {
  const [data, setData] = useState<{ dues: DuesAssessmentView[]; ledger: LedgerRow[]; myTier: TierView | null; owedMinor: number; currency: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptView | null>(null);
  const [tiers, setTiers] = useState<TierView[] | null>(null);
  const [joinTier, setJoinTier] = useState("");

  const load = (): void => { Api.moneyOverview().then((v) => setData(v)).catch(() => undefined); };
  useEffect(load, []);
  useEffect(() => { Api.moneyTiers().then((r) => setTiers(r.tiers)).catch(() => undefined); }, []);

  const pay = async (assessmentId: string): Promise<void> => {
    try {
      const r = await Api.payDues(assessmentId);
      setNote(r.provider === "manual"
        ? "Recorded. Hand the cash or transfer to the treasurer — they will confirm and your receipt appears here."
        : "Checkout opened in a new tab.");
      load();
    } catch (e) { setNote((e as Error).message); }
  };

  const openReceipt = async (ledgerId: string): Promise<void> => {
    try { setReceipt(await Api.receipt(ledgerId)); } catch (e) { setNote((e as Error).message); }
  };

  const takeTier = async (): Promise<void> => {
    if (joinTier === "") return;
    try {
      await Api.assignTier((data?.myTier === null ? "" : ""), joinTier);
      setNote("Tier request recorded.");
      load();
    } catch (e) { setNote((e as Error).message); }
  };

  if (data === null) return <div className="skeleton" style={{ height: 48 }} />;

  return (
    <Section label="Association — my dues (private)">
      <p className="micro" style={{ paddingBottom: 8 }}>
        Only you and the treasurer can see this. Nothing about your dues is public.
      </p>
      {data.myTier !== null && (
        <p style={{ font: "14px var(--font-ui)" }}>
          Tier: <b>{data.myTier.name}</b> <span className="tabular">{money(data.myTier.amountMinor, data.myTier.currency)}</span>
          {data.myTier.perks.voting === true ? " · voting" : ""}
          {data.myTier.perks.eventPriority === true ? " · event priority" : ""}
        </p>
      )}
      {data.owedMinor > 0 && (
        <p className="tabular" style={{ font: "600 15px var(--font-ui)", color: "var(--c-accent)" }}>
          Outstanding: {money(data.owedMinor, data.currency)}
        </p>
      )}
      {data.dues.length === 0
        ? <p style={{ font: "15px var(--font-ui)", color: "var(--c-neutral-500)" }}>No dues assessed yet.</p>
        : data.dues.map((d) => (
          <div key={d.id} className="row" style={{ padding: "8px 0" }}>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", font: "500 14px var(--font-ui)" }}>
                {d.period} · <span className="tabular">{money(d.amountMinor, d.currency)}</span>
                {d.tierName !== null ? <span className="micro"> · {d.tierName}</span> : ""}
              </span>
              <span className="micro tabular">due {new Date(d.dueDate).toLocaleDateString()} · {d.status}{d.receiptNo !== null ? ` · ${d.receiptNo}` : ""}</span>
            </span>
            {d.status !== "paid" && d.status !== "waived" && (
              <button type="button" className="btn btn--filled press" style={{ minHeight: 36 }} onClick={() => void pay(d.id)}>Pay</button>
            )}
          </div>
        ))}
      {tiers !== null && data.myTier === null && tiers.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div className="micro" style={{ paddingBottom: 4 }}>Choose a tier</div>
          <select value={joinTier} onChange={(e) => setJoinTier(e.target.value)} aria-label="Membership tier"
            style={{ width: "100%", minHeight: 44, border: "none", borderBottom: "1px solid var(--c-hairline)", background: "var(--c-base)", font: "14px var(--font-ui)", color: "var(--c-base-contrast)" }}>
            <option value="">Select…</option>
            {tiers.map((t) => <option key={t.id} value={t.id}>{t.name} — {money(t.amountMinor, t.currency)}</option>)}
          </select>
          <button type="button" className="btn btn--outlined press" style={{ marginTop: 8 }} onClick={() => void takeTier()} disabled={joinTier === ""}>Request tier</button>
        </div>
      )}
      {note !== null && <p style={{ font: "13px var(--font-ui)", color: "var(--c-accent)", marginTop: 8 }}>{note}</p>}

      <div className="micro" style={{ margin: "16px 0 8px" }}>My payments & receipts</div>
      {data.ledger.length === 0
        ? <p style={{ font: "14px var(--font-ui)", color: "var(--c-neutral-500)" }}>No payments yet.</p>
        : data.ledger.map((l) => (
          <div key={l.id} className="row" style={{ padding: "8px 0" }}>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", font: "500 14px var(--font-ui)", textTransform: "capitalize" }}>{l.kind}</span>
              <span className="micro tabular">{new Date(l.createdAt).toLocaleDateString()}{l.receiptNo !== null ? ` · ${l.receiptNo}` : ""} · {l.status}</span>
            </span>
            <span className="tabular" style={{ font: "600 14px var(--font-ui)" }}>{money(l.amountMinor, l.currency)}</span>
            {l.receiptNo !== null && (
              <button type="button" className="btn btn--underline-link press" style={{ minHeight: 28 }} onClick={() => void openReceipt(l.id)}>Receipt</button>
            )}
          </div>
        ))}

      {receipt !== null && (
        <div role="dialog" aria-modal="true" aria-label="Receipt" onClick={() => setReceipt(null)} style={{ position: "fixed", inset: 0, background: "var(--c-scrim)", zIndex: 55, display: "flex", alignItems: "flex-end" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", background: "var(--c-base)", borderTop: "2px solid var(--c-accent)", padding: 16 }}>
            <div className="micro">Receipt · {receipt.community}</div>
            <div className="tabular" style={{ font: "700 22px var(--font-ui)", color: "var(--c-accent)", margin: "8px 0" }}>{receipt.receiptNo}</div>
            <div style={{ font: "15px var(--font-ui)" }}>
              {receipt.payer} — <span className="tabular">{money(receipt.amountMinor, receipt.currency)}</span>
            </div>
            <div className="micro tabular" style={{ marginTop: 4 }}>{receipt.kind} · {new Date(receipt.issuedAt).toLocaleString()}</div>
            <button type="button" className="btn btn--outlined press" style={{ marginTop: 12 }} onClick={() => setReceipt(null)}>Close</button>
          </div>
        </div>
      )}
    </Section>
  );
}

/** Manage → Money: treasurer workbench (private dues, §P). */
export function MoneyAdminSection(): React.ReactElement {
  const [rows, setRows] = useState<AdminDuesRow[] | null>(null);
  const [filter, setFilter] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [period, setPeriod] = useState(new Date().getFullYear().toString());
  const [amount, setAmount] = useState("20000");
  const [tierName, setTierName] = useState("");
  const [tierAmount, setTierAmount] = useState("");
  const markRef = useRef<Map<string, string>>(new Map());

  const load = (): void => { Api.adminDues(filter || undefined).then((r) => setRows(r.assessments)).catch((e: Error) => setNote(e.message)); };
  useEffect(load, [filter]);

  const runCycle = async (): Promise<void> => {
    const amt = Number(amount);
    if (Number.isNaN(amt) || period.trim() === "") return;
    const r = await Api.runAssessments({ period, amountMinor: Math.round(amt * 100) }).catch((e: Error) => { setNote(e.message); return null; });
    if (r !== null) { setNote(`Assessed ${r.created} members for ${period}.`); load(); }
  };
  const runReminders = async (): Promise<void> => {
    const r = await Api.runReminders().catch((e: Error) => { setNote(e.message); return null; });
    if (r !== null) setNote(`Reminders sent to ${r.sent} overdue member(s).`);
  };
  const markPaid = async (id: string): Promise<void> => {
    const reference = markRef.current.get(id);
    const r = await Api.markDuesPaid(id, reference).catch((e: Error) => { setNote(e.message); return null; });
    if (r !== null) { setNote(`Marked paid — ${r.receiptNo}`); load(); }
  };
  const waive = async (id: string): Promise<void> => {
    await Api.waiveDues(id).catch((e: Error) => setNote(e.message));
    load();
  };
  const createTier = async (): Promise<void> => {
    const amt = Number(tierAmount);
    if (tierName.trim() === "" || Number.isNaN(amt)) return;
    await Api.createTier({ name: tierName, amountMinor: Math.round(amt * 100), currency: "NGN" }).catch((e: Error) => setNote(e.message));
    setTierName(""); setTierAmount("");
  };

  return (
    <section style={{ padding: "0 16px 24px" }}>
      <div className="micro" style={{ paddingBottom: 8, borderBottom: "1px solid var(--c-hairline)", marginBottom: 12 }}>Money — dues (private, §P)</div>
      {note !== null && <p style={{ font: "13px var(--font-ui)", color: "var(--c-accent)", margin: "0 0 8px" }}>{note}</p>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="Period, e.g. 2026" aria-label="Dues period"
          style={{ minHeight: 44, padding: "0 12px", border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "14px var(--font-ui)", color: "var(--c-base-contrast)" }} />
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="Base amount (naira)" aria-label="Base amount"
          style={{ minHeight: 44, padding: "0 12px", border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "14px var(--font-ui)", color: "var(--c-base-contrast)" }} />
        <button type="button" className="btn btn--filled press" onClick={() => void runCycle()}>Run cycle</button>
        <button type="button" className="btn btn--outlined press" onClick={() => void runReminders()}>Run reminders</button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input value={tierName} onChange={(e) => setTierName(e.target.value)} placeholder="New tier name" aria-label="Tier name"
          style={{ minHeight: 44, padding: "0 12px", border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "14px var(--font-ui)", color: "var(--c-base-contrast)" }} />
        <input value={tierAmount} onChange={(e) => setTierAmount(e.target.value)} inputMode="decimal" placeholder="Tier amount" aria-label="Tier amount"
          style={{ minHeight: 44, padding: "0 12px", border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "14px var(--font-ui)", color: "var(--c-base-contrast)" }} />
        <button type="button" className="btn btn--outlined press" onClick={() => void createTier()} disabled={tierName.trim() === ""}>Add tier</button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        {["", "due", "overdue", "paid", "waived"].map((f) => (
          <button key={f} type="button" className="press" onClick={() => setFilter(f)} aria-pressed={filter === f}
            style={{ minHeight: 36, padding: "0 10px", cursor: "pointer", border: "1px solid var(--c-hairline)", background: filter === f ? "var(--c-accent)" : "var(--c-base)", color: filter === f ? "var(--c-accent-contrast)" : "var(--c-base-contrast)", font: "12px var(--font-ui)" }}>
            {f === "" ? "all" : f}
          </button>
        ))}
      </div>

      {rows === null ? <div className="skeleton" style={{ height: 48 }} /> : rows.length === 0 ? (
        <p style={{ font: "15px var(--font-ui)", color: "var(--c-neutral-500)" }}>Nothing in this view.</p>
      ) : rows.map((r) => (
        <div key={r.id} className="row" style={{ padding: "8px 0", flexWrap: "wrap" }}>
          <span style={{ flex: 1, minWidth: 200 }}>
            <span style={{ display: "block", font: "500 14px var(--font-ui)" }}>
              {r.memberName} — <span className="tabular">{money(r.amountMinor, r.currency)}</span>
            </span>
            <span className="micro tabular">{r.period} · due {new Date(r.dueDate).toLocaleDateString()} · {r.status}{r.receiptNo !== null ? ` · ${r.receiptNo}` : ""}</span>
          </span>
          {r.status !== "paid" && r.status !== "waived" && (
            <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                placeholder="Reference (optional)" aria-label={`Payment reference for ${r.memberName}`}
                onChange={(e) => markRef.current.set(r.id, e.target.value)}
                style={{ minHeight: 36, padding: "0 8px", border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "13px var(--font-ui)", color: "var(--c-base-contrast)" }}
              />
              <button type="button" className="btn btn--filled press" style={{ minHeight: 36 }} onClick={() => void markPaid(r.id)}>Mark paid</button>
              <button type="button" className="btn btn--underline-link press" style={{ minHeight: 36 }} onClick={() => void waive(r.id)}>Waive</button>
            </span>
          )}
        </div>
      ))}
    </section>
  );
}

/** Manage → Giving: campaign creation/close + donation confirmation queue. */
export function CampaignAdmin(): React.ReactElement {
  const [campaigns, setCampaigns] = useState<CampaignView[] | null>(null);
  const [intents, setIntents] = useState<Array<{ id: string; memberName: string; amountMinor: number; currency: string; purpose: string; campaign: string | null }> | null>(null);
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const load = (): void => {
    Api.campaigns().then((r) => setCampaigns(r.campaigns)).catch(() => undefined);
    Api.moneyIntents().then((r) => setIntents(r.intents)).catch(() => undefined);
  };
  useEffect(load, []);

  const create = async (): Promise<void> => {
    const g = Number(goal);
    if (title.trim().length < 2 || Number.isNaN(g)) return;
    await Api.createCampaign({ title, goalMinor: Math.round(g * 100), currency: "NGN" }).catch((e: Error) => setNote(e.message));
    setTitle(""); setGoal("");
    load();
  };

  const confirm = async (id: string): Promise<void> => {
    const r = await Api.confirmIntent(id).catch((e: Error) => { setNote(e.message); return null; });
    if (r !== null) { setNote(`Confirmed — ${r.receiptNo}`); load(); }
  };

  return (
    <section style={{ padding: "0 16px 24px" }}>
      <div className="micro" style={{ paddingBottom: 8, borderBottom: "1px solid var(--c-hairline)", marginBottom: 12 }}>Giving — campaigns & confirmations</div>
      {note !== null && <p style={{ font: "13px var(--font-ui)", color: "var(--c-accent)", margin: "0 0 8px" }}>{note}</p>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Campaign title" aria-label="Campaign title"
          style={{ minHeight: 44, padding: "0 12px", border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "14px var(--font-ui)", color: "var(--c-base-contrast)" }} />
        <input value={goal} onChange={(e) => setGoal(e.target.value)} inputMode="decimal" placeholder="Goal (naira)" aria-label="Campaign goal"
          style={{ minHeight: 44, padding: "0 12px", border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "14px var(--font-ui)", color: "var(--c-base-contrast)" }} />
        <button type="button" className="btn btn--outlined press" onClick={() => void create()} disabled={title.trim().length < 2}>Create campaign</button>
      </div>

      {campaigns !== null && campaigns.map((c) => (
        <div key={c.id} className="row" style={{ padding: "8px 0" }}>
          <span style={{ flex: 1, font: "500 14px var(--font-ui)" }}>
            {c.title} <span className="micro tabular">{c.progress}%</span>
          </span>
          {c.status === "open" && (
            <button type="button" className="btn btn--underline-link press" style={{ minHeight: 28 }} onClick={() => void Api.closeCampaign(c.id).then(load)}>Close</button>
          )}
        </div>
      ))}

      <div className="micro" style={{ margin: "16px 0 8px" }}>Awaiting confirmation</div>
      {intents === null ? <div className="skeleton" style={{ height: 32 }} /> : intents.length === 0 ? (
        <p style={{ font: "14px var(--font-ui)", color: "var(--c-neutral-500)" }}>No gifts awaiting confirmation.</p>
      ) : intents.map((i) => (
        <div key={i.id} className="row" style={{ padding: "8px 0" }}>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", font: "500 14px var(--font-ui)" }}>
              {i.memberName} — <span className="tabular">{money(i.amountMinor, i.currency)}</span>
            </span>
            <span className="micro">{i.purpose}{i.campaign !== null ? ` · ${i.campaign}` : ""}</span>
          </span>
          <button type="button" className="btn btn--filled press" style={{ minHeight: 36 }} onClick={() => void confirm(i.id)}>Confirm</button>
        </div>
      ))}
    </section>
  );
}
