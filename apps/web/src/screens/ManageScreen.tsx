/**
 * Manage — Committee Panel shell (1.4): one gated area, sections matching
 * duties (spec §7). Phase 1 activates Overview and Members (verification
 * queue, roles); other sections are honest empty states until their phase.
 */
import React, { useEffect, useState } from "react";
import { Api } from "../api.js";
import { Empty } from "./InboxScreen.js";
import { MoneyAdminSection, CampaignAdmin } from "./Money.js";
import type { ManageOverview, QueueItem, SessionMember } from "@fedites/config";

const EMPTY_SECTIONS = [
  ["Moderation", "Report queue, mutes and bans, audit trail."],
  ["Speak", "Newsletter builder, WhatsApp bridge, email digests."],
  ["Govern", "Elections, motions, AGM toolkit, constitution."],
  ["Content", "Spotlights, Memory Lane uploads, wishlist."],
  ["Oversight", "Analytics, audit logs, data export, integrations."],
  ["Settings", "Dues cycle, emergency broadcast policy."],
  ["Studio", "Colors, families, nav patterns, terminology."],
] as const;

const ALL_ROLES = ["president", "treasurer", "secretary", "moderator", "editor", "member"] as const;
type RoleKey = (typeof ALL_ROLES)[number];

export function ManageScreen({ member, onNavigate }: { member: SessionMember; onNavigate: (to: string) => void }): React.ReactElement {
  const [overview, setOverview] = useState<ManageOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Api.manageOverview().then(setOverview).catch((e: Error) => setError(e.message));
  }, []);

  if (error !== null) return <Empty title="Admins only" body="The Manage panel is for role-holders. Ask an admin if you need access." />;

  return (
    <main style={{ paddingBottom: 96 }}>
      <h1 className="screen-title">Manage</h1>
      <div className="micro" style={{ padding: "0 16px 16px" }}>Committee panel · {member.roles.filter((r) => r !== "member").join(", ")}</div>

      {overview === null ? (
        <div style={{ padding: "0 16px" }}><div className="skeleton" style={{ height: 64 }} /></div>
      ) : (
        <section style={{ padding: "0 16px 24px" }}>
          <div className="micro" style={{ paddingBottom: 8, borderBottom: "1px solid var(--c-hairline)", marginBottom: 12 }}>Overview</div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <Stat label="Pending approval" value={overview.stats.pending} accent />
            <Stat label="Limited" value={overview.stats.limited} />
            <Stat label="Verified" value={overview.stats.verified} />
            <Stat label="Honorary" value={overview.stats.honorary} />
            <Stat label="Groups" value={overview.stats.groups} />
            <Stat label="Events" value={overview.stats.events} />
          </div>
        </section>
      )}

      <MembersSection />

      <MoneyAdminSection />

      <CampaignAdmin />

      <section style={{ padding: "0 16px 24px" }}>
        <div className="micro" style={{ paddingBottom: 8, borderBottom: "1px solid var(--c-hairline)", marginBottom: 12 }}>Events</div>
        <p style={{ font: "15px var(--font-ui)", color: "var(--c-base-contrast)", margin: "0 0 8px" }}>
          Reunion planning, QR door mode, and live counts live on each event's page.
        </p>
        <button type="button" className="btn btn--outlined press" onClick={() => onNavigate("/events")}>Open Events</button>
      </section>

      {onNavigate !== null && EMPTY_SECTIONS.map(([name, body]) => (
        <section key={name} style={{ padding: "0 16px 24px" }}>
          <div className="micro" style={{ paddingBottom: 8, borderBottom: "1px solid var(--c-hairline)", marginBottom: 12 }}>{name}</div>
          <p style={{ font: "15px var(--font-ui)", color: "var(--c-neutral-500)", margin: 0 }}>
            {body} Opens in its build phase (M3).
          </p>
        </section>
      ))}
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }): React.ReactElement {
  return (
    <div>
      <div className="tabular" style={{ font: "700 32px var(--font-ui)", color: accent ? "var(--c-accent)" : "var(--c-base-contrast)" }}>{value}</div>
      <div className="micro">{label}</div>
    </div>
  );
}

function MembersSection(): React.ReactElement {
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [selected, setSelected] = useState<QueueItem | null>(null);
  const [memberRoles, setMemberRoles] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);

  const load = (): void => {
    Api.queue().then((r) => setQueue(r.queue)).catch((e: Error) => setNote(e.message));
  };
  useEffect(load, []);

  const openMember = (q: QueueItem): void => {
    setSelected(q);
    Api.roles(q.id).then((r) => setMemberRoles(r.roles)).catch(() => setMemberRoles([]));
  };

  const decide = async (decision: "activate" | "verify" | "honorary" | "reject"): Promise<void> => {
    if (selected === null) return;
    if (decision === "reject") {
      // G9: type-to-confirm destruction.
      const typed = window.prompt(`Type the member's name to reject ${selected.display_name}:`);
      if (typed !== selected.display_name) return;
    }
    try {
      await Api.decide({ memberId: selected.id, decision });
      setNote(`${selected.display_name}: ${decision}`);
      setSelected(null);
      load();
    } catch (e) {
      setNote((e as Error).message);
    }
  };

  const toggleRole = async (roleKey: RoleKey): Promise<void> => {
    if (selected === null) return;
    try {
      if (memberRoles.includes(roleKey)) await Api.removeRole(selected.id, roleKey);
      else await Api.setRole(selected.id, { roleKey });
      setMemberRoles(await Api.roles(selected.id).then((r) => r.roles));
    } catch (e) {
      setNote((e as Error).message);
    }
  };

  return (
    <section style={{ padding: "0 16px 24px" }}>
      <div className="micro" style={{ paddingBottom: 8, borderBottom: "1px solid var(--c-hairline)", marginBottom: 12 }}>Members</div>
      {note && <p style={{ font: "13px var(--font-ui)", color: "var(--c-accent)" }}>{note}</p>}
      {queue === null ? <div className="skeleton" style={{ height: 48 }} /> : queue.length === 0 ? (
        <p style={{ font: "15px var(--font-ui)", color: "var(--c-neutral-500)" }}>No signups waiting. The queue is clear.</p>
      ) : (
        queue.map((q) => (
          <button
            key={q.id}
            type="button"
            className="row press"
            onClick={() => openMember(q)}
            style={{ cursor: "pointer", textAlign: "left" }}
            aria-expanded={selected?.id === q.id}
          >
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", font: "600 15px var(--font-ui)" }}>{q.display_name}</span>
              <span className="micro tabular">
                {q.verification}{q.set_year !== null ? ` · Set '${String(q.set_year).slice(-2)}` : ""} · {q.vouch_count}/3 confirmations
              </span>
            </span>
          </button>
        ))
      )}

      {selected !== null && (
        <div style={{ border: "1px solid var(--c-hairline)", padding: 16, marginTop: 12 }}>
          <div style={{ font: "600 15px var(--font-ui)", marginBottom: 8 }}>{selected.display_name}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            <button type="button" className="btn btn--filled press" onClick={() => void decide("activate")}>Activate</button>
            <button type="button" className="btn btn--outlined press" onClick={() => void decide("verify")}>Verify now</button>
            <button type="button" className="btn btn--outlined press" onClick={() => void decide("honorary")}>Make honorary</button>
            <button type="button" className="btn btn--underline-link press" onClick={() => void decide("reject")}>Reject signup</button>
          </div>
          <div className="micro" style={{ marginBottom: 8 }}>Roles (changes are logged and reversible for 30 days)</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {ALL_ROLES.map((r) => (
              <button
                key={r}
                type="button"
                className="press"
                onClick={() => void toggleRole(r)}
                aria-pressed={memberRoles.includes(r)}
                style={{
                  minHeight: 44, padding: "0 12px", cursor: "pointer",
                  background: memberRoles.includes(r) ? "var(--c-accent)" : "var(--c-base)",
                  color: memberRoles.includes(r) ? "var(--c-accent-contrast)" : "var(--c-base-contrast)",
                  border: "1px solid var(--c-hairline)", font: "13px var(--font-ui)",
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
