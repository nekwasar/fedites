/**
 * Giving screens (Phase 4 batch 2): campaigns with live progress, donate
 * flow with the anonymous toggle (§P), donor wall (names only — K2), the
 * transparent ledger (member-browsable + CSV), and the recurring schedules.
 * Confetti (F6) fires on goal completion and payment success only.
 */
import React, { useEffect, useState } from "react";
import { Api } from "../api.js";
import { Empty, SkeletonList } from "./InboxScreen.js";
import { Section } from "./ProfileScreen.js";
import { Confetti } from "../components/Confetti.js";
import type { CampaignView, DonorWall, TransparentLedger, DonationSchedule } from "../events-types.js";

const money = (minor: number, currency: string): string =>
  `${(minor / 100).toLocaleString()} ${currency}`;

/** Menu → Association: give back — campaigns, donate, schedules. */
export function GivingSection(): React.ReactElement {
  const [campaigns, setCampaigns] = useState<CampaignView[] | null>(null);
  const [schedules, setSchedules] = useState<DonationSchedule[] | null>(null);
  const [amount, setAmount] = useState("5000");
  const [anonymous, setAnonymous] = useState(false);
  const [recurring, setRecurring] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [paymentCelebrated, setPaymentCelebrated] = useState(false);

  const load = (): void => {
    Api.campaigns().then((r) => setCampaigns(r.campaigns)).catch(() => undefined);
    Api.schedules().then((r) => setSchedules(r.schedules)).catch(() => undefined);
    // F6 call site 2: a newly confirmed payment (dues/donation) in my ledger.
    Api.moneyOverview().then((o) => {
      const latest = o.ledger[0];
      if (latest !== undefined && latest.status === "confirmed" && paymentCelebrated === false && Date.now() - new Date(latest.createdAt).getTime() < 60_000) {
        setCelebrate(true);
        setPaymentCelebrated(true);
      }
    }).catch(() => undefined);
  };
  useEffect(load, []);

  const donate = async (campaignId: string | null): Promise<void> => {
    const amt = Number(amount);
    if (Number.isNaN(amt) || amt <= 0) return;
    try {
      const body: { amountMinor: number; currency: string; campaignId?: string; anonymous: boolean } = {
        amountMinor: Math.round(amt * 100), currency: "NGN", anonymous,
      };
      if (campaignId !== null) body.campaignId = campaignId;
      if (recurring) {
        await Api.createSchedule(body.amountMinor, body.currency, "monthly", campaignId ?? undefined);
        setNote("Monthly gift scheduled. We will nudge you gently each month.");
      } else {
        await Api.donate(body);
        setNote("Thank you. Your gift awaits treasurer confirmation — your receipt and name (or Anonymous) appear on the wall after.");
        setCelebrate(true); // F6: payment success moment
      }
      load();
    } catch (e) { setNote((e as Error).message); }
  };

  return (
    <Section label="Give back">
      <Confetti show={celebrate} onDone={() => setCelebrate(false)} />
      {note !== null && <p style={{ font: "13px var(--font-ui)", color: "var(--c-accent)", margin: "0 0 8px" }}>{note}</p>}

      <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="Amount (naira)" aria-label="Donation amount"
        style={{ width: "100%", minHeight: 44, border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "15px var(--font-ui)", color: "var(--c-base-contrast)" }} />
      <label style={{ font: "13px var(--font-ui)", display: "flex", gap: 8, alignItems: "center", margin: "8px 0" }}>
        <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} /> Give anonymously (§P toggle)
      </label>
      <label style={{ font: "13px var(--font-ui)", display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} /> Make it monthly
      </label>
      <button type="button" className="btn btn--filled press" onClick={() => void donate(null)}>Give to the community</button>

      <div className="micro" style={{ margin: "16px 0 8px" }}>Open campaigns</div>
      {campaigns === null ? <div className="skeleton" style={{ height: 32 }} /> : campaigns.length === 0 ? (
        <p style={{ font: "14px var(--font-ui)", color: "var(--c-neutral-500)" }}>No open campaigns right now.</p>
      ) : campaigns.map((c) => (
        <div key={c.id} style={{ borderBottom: "1px solid var(--c-hairline)", padding: "8px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span style={{ font: "600 14px var(--font-ui)" }}>{c.title}</span>
            <span className="micro tabular">{c.progress}%{c.goalReached ? " · goal reached" : ""}</span>
          </div>
          <div style={{ height: 6, background: "var(--c-neutral-100)", marginTop: 4 }}>
            <div style={{ width: `${c.progress}%`, height: "100%", background: "var(--c-accent)", transition: "width var(--motion-base, 200ms) ease-out" }} />
          </div>
          <div className="micro tabular" style={{ marginTop: 4 }}>
            {money(c.raisedMinor, c.currency)} of {money(c.goalMinor, c.currency)}{c.deadline !== null ? ` · by ${new Date(c.deadline).toLocaleDateString()}` : ""}
          </div>
          <button type="button" className="btn btn--underline-link press" style={{ minHeight: 28 }} onClick={() => void donate(c.id)}>Give to this campaign</button>
        </div>
      ))}

      {schedules !== null && schedules.length > 0 && (
        <>
          <div className="micro" style={{ margin: "16px 0 8px" }}>My monthly gifts</div>
          {schedules.map((s) => (
            <div key={s.id} className="row" style={{ padding: "8px 0" }}>
              <span style={{ flex: 1, font: "14px var(--font-ui)" }}>
                <span className="tabular">{money(s.amountMinor, s.currency)}</span> {s.frequency}{s.campaign !== null ? ` · ${s.campaign}` : ""}
              </span>
              <button type="button" className="btn btn--underline-link press" style={{ minHeight: 28 }} onClick={() => void Api.cancelSchedule(s.id).then(load)}>Cancel</button>
            </div>
          ))}
        </>
      )}
    </Section>
  );
}

/** One campaign: progress, F6 confetti on goal, donor wall (K2: names only). */
export function CampaignScreen({ campaignId, onNavigate }: { campaignId: string; onNavigate: (to: string) => void }): React.ReactElement {
  const [campaigns, setCampaigns] = useState<CampaignView[] | null>(null);
  const [wall, setWall] = useState<DonorWall | null>(null);
  const [amount, setAmount] = useState("5000");
  const [anonymous, setAnonymous] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  const load = (): void => {
    Api.campaigns().then((r) => setCampaigns(r.campaigns)).catch(() => undefined);
    Api.campaignDonors(campaignId).then(setWall).catch(() => undefined);
  };
  useEffect(load, [campaignId]);

  const campaign = campaigns?.find((c) => c.id === campaignId) ?? null;
  useEffect(() => {
    if (campaign?.goalReached === true) setCelebrate(true);
  }, [campaign?.goalReached]);
  const donate = async (): Promise<void> => {
    const amt = Number(amount);
    if (Number.isNaN(amt) || amt <= 0) return;
    try {
      await Api.donate({ amountMinor: Math.round(amt * 100), currency: "NGN", campaignId, anonymous });
      setNote("Thank you. Your gift awaits treasurer confirmation.");
      load();
    } catch (e) { setNote((e as Error).message); }
  };

  if (campaigns === null) return <SkeletonList />;
  if (campaign === null) return <Empty title="Campaign unavailable" body="It may be closed or the link is wrong." />;

  return (
    <main style={{ paddingBottom: 96 }}>
      <Confetti show={campaign.goalReached} onDone={() => setCelebrate(false)} />
      <Confetti show={celebrate} onDone={() => setCelebrate(false)} />
      <h1 className="screen-title">{campaign.title}</h1>
      {campaign.description !== null && <p style={{ padding: "0 16px 8px", font: "15px var(--font-ui)" }}>{campaign.description}</p>}
      <div style={{ padding: "0 16px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span className="tabular" style={{ font: "600 17px var(--font-ui)", color: "var(--c-accent)" }}>
            {money(campaign.raisedMinor, campaign.currency)}
          </span>
          <span className="micro tabular">of {money(campaign.goalMinor, campaign.currency)}</span>
        </div>
        <div style={{ height: 8, background: "var(--c-neutral-100)" }}>
          <div style={{ width: `${campaign.progress}%`, height: "100%", background: "var(--c-accent)", transition: "width var(--motion-base, 200ms) ease-out" }} />
        </div>
        {campaign.goalReached && <p className="micro" style={{ color: "var(--c-accent)", marginTop: 4 }}>Goal reached — thank you, everyone.</p>}
        {campaign.deadline !== null && <p className="micro tabular" style={{ marginTop: 4 }}>by {new Date(campaign.deadline).toLocaleDateString()}</p>}
      </div>

      <div style={{ padding: "0 16px 16px" }}>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" aria-label="Donation amount"
          style={{ width: "100%", minHeight: 44, border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "15px var(--font-ui)", color: "var(--c-base-contrast)" }} />
        <label style={{ font: "13px var(--font-ui)", display: "flex", gap: 8, alignItems: "center", margin: "8px 0" }}>
          <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} /> Give anonymously
        </label>
        <button type="button" className="btn btn--filled press" onClick={() => void donate()}>Give to this campaign</button>
        <button type="button" className="btn btn--underline-link press" onClick={() => onNavigate("/money/ledger")}>See the transparent ledger</button>
        {note !== null && <p style={{ font: "13px var(--font-ui)", color: "var(--c-accent)", marginTop: 8 }}>{note}</p>}
      </div>

      <section style={{ padding: "0 16px 24px" }}>
        <div className="micro" style={{ paddingBottom: 8, borderBottom: "1px solid var(--c-hairline)", marginBottom: 8 }}>Donor wall</div>
        {wall === null ? <div className="skeleton" style={{ height: 32 }} /> : wall.donors.length === 0 ? (
          <p style={{ font: "14px var(--font-ui)", color: "var(--c-neutral-500)" }}>Be the first name on the wall — or an anonymous friend.</p>
        ) : wall.donors.map((d, i) => (
          <div key={i} className="row" style={{ padding: "8px 0" }}>
            <span style={{ flex: 1, font: "500 14px var(--font-ui)" }}>{d.name}</span>
            <span className="micro tabular">{new Date(d.at).toLocaleDateString()}</span>
          </div>
        ))}
      </section>
    </main>
  );
}

/** Transparent ledger (rail 5 view): browsable + downloadable CSV. */
export function TransparentLedgerScreen(): React.ReactElement {
  const [data, setData] = useState<TransparentLedger | null>(null);
  useEffect(() => { Api.transparentLedger().then((v) => setData(v)).catch(() => undefined); }, []);
  if (data === null) return <SkeletonList />;
  return (
    <main style={{ paddingBottom: 96 }}>
      <h1 className="screen-title">Transparent ledger</h1>
      <div className="micro" style={{ padding: "0 16px 8px" }}>
        Every confirmed gift and spend — how each penny moved. Dues stay private (§P).
      </div>
      <div style={{ padding: "0 16px 12px" }}>
        {Object.entries(data.totals).map(([currency, minor]) => (
          <span key={currency} className="tabular" style={{ font: "600 15px var(--font-ui)", marginRight: 16 }}>
            {money(minor, currency)} in
          </span>
        ))}
        <a href={`/v1/money/transparent-ledger?format=csv`} download style={{ font: "14px var(--font-ui)", color: "var(--c-accent)" }}>Download CSV</a>
      </div>
      {data.rows.length === 0 ? (
        <Empty title="Nothing confirmed yet" body="Confirmed gifts and spends appear here." />
      ) : data.rows.map((r, i) => (
        <div key={i} className="row" style={{ padding: "8px 16px" }}>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", font: "500 14px var(--font-ui)", textTransform: "capitalize" }}>
              {r.kind}{r.campaign !== null ? ` · ${r.campaign}` : ""}
            </span>
            <span className="micro tabular">{new Date(r.createdAt).toLocaleDateString()}{r.receiptNo !== null ? ` · ${r.receiptNo}` : ""}{r.payer !== null ? ` · ${r.payer}` : ""}</span>
          </span>
          <span className="tabular" style={{ font: "600 14px var(--font-ui)" }}>{money(r.amountMinor, r.currency)}</span>
        </div>
      ))}
    </main>
  );
}
