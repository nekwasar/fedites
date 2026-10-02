/**
 * CAREERS PAGE REGISTRIES (MODULE 2) — config-driven component factory.
 *
 * <CareersHeaderRegistry variant={config.headerVariant} state={hook} />
 * <JobCardRegistry     variant={config.jobCardVariant} data={job} state={hook} />
 * <CareerFilterChips   state />
 *
 * Zero styling constants in templates: semantic classes + var() only. All
 * handlers/apply/save logic comes from useCareersPage (shared hook).
 */
import React, { useState } from "react";
import { Icon, Avatar, Badge, Button } from "@fedites/ui";
import type { JobRow } from "../events-types.js";
import type { CareersPageState } from "../hooks/useCareersPage.js";

export const CAREER_TABS = [
  { key: "jobs", label: "Job Board" },
  { key: "business", label: "Directory" },
  { key: "mentors", label: "Mentor Hours" },
  { key: "referrals", label: "Referrals" },
] as const;

/* --------------------------- Header registry -------------------------- */

export function CareersHeaderRegistry({ variant, state, tab, onTab }: {
  variant: CareersPageState["config"]["headerVariant"];
  state: CareersPageState;
  tab: string;
  onTab: (key: string) => void;
}): React.ReactElement {
  switch (variant) {
    case "indeed": return <IndeedHeader state={state} tab={tab} onTab={onTab} />;
    case "linkedin": return <LinkedInHeader state={state} tab={tab} onTab={onTab} />;
    default: return <StandardCareersHeader tab={tab} onTab={onTab} />;
  }
}

/** Variant 1 — Standard filter header: title + sub-navigation tabs. */
function StandardCareersHeader({ tab, onTab }: { tab: string; onTab: (key: string) => void }): React.ReactElement {
  return (
    <div>
      <h1 className="screen-title">Careers</h1>
      <div className="tabs">
        {CAREER_TABS.map((t) => (
          <button key={t.key} type="button" className="tabs__tab press" aria-current={tab === t.key ? "true" : undefined} onClick={() => onTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Variant 2 — Indeed style: stacked double search + full-width action button + tabs. */
function IndeedHeader({ state, tab, onTab }: { state: CareersPageState; tab: string; onTab: (key: string) => void }): React.ReactElement {
  return (
    <div>
      <h1 className="screen-title">Careers</h1>
      <div className="double-search">
        <input
          className="field__input"
          value={state.keywords}
          onChange={(e) => state.setKeywords(e.target.value)}
          placeholder="Job title or keywords"
          aria-label="Job title or keywords"
        />
        <input
          className="field__input"
          value={state.location}
          onChange={(e) => state.setLocation(e.target.value)}
          placeholder="Location or Remote"
          aria-label="Location or Remote"
        />
        <Button kind="filled" full onClick={() => state.reload()}>Search the board</Button>
      </div>
      <div className="tabs">
        {CAREER_TABS.map((t) => (
          <button key={t.key} type="button" className="tabs__tab press" aria-current={tab === t.key ? "true" : undefined} onClick={() => onTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Variant 3 — LinkedIn style command header: compact search + filter pill + quick chips + tabs. */
function LinkedInHeader({ state, tab, onTab }: { state: CareersPageState; tab: string; onTab: (key: string) => void }): React.ReactElement {
  const [filtersOpen, setFiltersOpen] = useState(false);
  return (
    <div>
      <div className="command-head">
        <Icon name="search" size={18} />
        <input
          className="field__input command-head__search"
          value={state.keywords}
          onChange={(e) => state.setKeywords(e.target.value)}
          placeholder="Search roles"
          aria-label="Search roles"
        />
        <button type="button" className="chip press" aria-pressed={filtersOpen} aria-label="Filters" onClick={() => setFiltersOpen((o) => !o)}>
          <Icon name="menu" size={14} /> Filters
        </button>
      </div>
      {filtersOpen && (
        <div className="double-search">
          <input
            className="field__input"
            value={state.location}
            onChange={(e) => state.setLocation(e.target.value)}
            placeholder="Location or Remote"
            aria-label="Location or Remote"
          />
          <Button kind="filled" full onClick={() => state.reload()}>Apply filters</Button>
        </div>
      )}
      <div className="chips">
        {[
          { key: "prefs", label: "Preferences" },
          { key: "tracker", label: "Job Tracker" },
          { key: "post", label: "Post a Job" },
        ].map((c) => (
          <button
            key={c.key}
            type="button"
            className="chip press"
            aria-pressed={c.key === "prefs"}
            onClick={() => {
              if (c.key === "post") state.setPosting(true);
              if (c.key === "tracker") state.reload();
            }}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="tabs">
        {CAREER_TABS.map((t) => (
          <button key={t.key} type="button" className="tabs__tab press" aria-current={tab === t.key ? "true" : undefined} onClick={() => onTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------- Job card registry ----------------------- */

export function JobCardRegistry({ variant, data, state }: {
  variant: CareersPageState["config"]["jobCardVariant"];
  data: JobRow;
  state: CareersPageState;
}): React.ReactElement {
  switch (variant) {
    case "card": return <ElevatedJobCard data={data} state={state} />;
    case "compact": return <CompactJobListing data={data} state={state} />;
    default: return <StandardJobRow data={data} state={state} />;
  }
}

function isFreshGrad(j: JobRow): boolean {
  return j.employmentType === "internship" || j.employmentType === "graduate_trainee";
}

function salaryOf(j: JobRow): string {
  if (j.salary === null) return "";
  const fmt = (m: number): string => (m / 100).toLocaleString();
  return j.salary.maxMinor !== null ? `${fmt(j.salary.minMinor)}–${fmt(j.salary.maxMinor)} ${j.salary.currency}/mo` : `${fmt(j.salary.minMinor)} ${j.salary.currency}/mo`;
}

/** Variant 1 — Standard job row: stacked title/company/location, salary tag, Apply. */
function StandardJobRow({ data, state }: { data: JobRow; state: CareersPageState }): React.ReactElement {
  return (
    <div style={{ borderBottom: "var(--hairline) solid var(--hairline-color)", padding: "var(--space-3) var(--density-pad-x)" }}>
      <div style={{ font: "var(--weight-bold) var(--type-body) var(--font-ui)" }}>{data.title}</div>
      <div className="micro">{data.companyName} · {data.city ?? "Anywhere"} · {data.workMode}</div>
      {data.salary !== null && <Badge variant="outline">{salaryOf(data)}</Badge>}
      <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
        <Button kind="filled" small disabled={state.appliedIds.has(data.id)} onClick={() => state.requestApply(data.id)}>
          {state.appliedIds.has(data.id) ? "Applied" : "Apply"}
        </Button>
      </div>
    </div>
  );
}

/** Variant 2 — Elevated job card: bg token, priority badge, bookmark, big CTA. */
function ElevatedJobCard({ data, state }: { data: JobRow; state: CareersPageState }): React.ReactElement {
  return (
    <div className="tile" style={{ marginBottom: "var(--space-2)" }}>
      <div className="tile__top">
        <Avatar name={data.companyName} />
        <span className="tile__name job-tile__title">{data.title}</span>
        {isFreshGrad(data) ? <Badge variant="solid">Fresh-Grad Priority</Badge> : <Badge variant="outline">Easy Apply</Badge>}
        <button type="button" className="press" aria-label="Save job" onClick={() => void state.toggleSave(data.id, state.savedIds.has(data.id))}>
          <Icon name="pin" size={18} />
        </button>
      </div>
      <div className="job-tile__meta">
        <span style={{ font: "var(--weight-medium) var(--type-body2) var(--font-ui)", color: "var(--c-base-contrast)" }}>{data.companyName}</span>
        <Badge variant="dot">{data.workMode}</Badge>
        {data.city !== null && <span>{data.city}</span>}
      </div>
      <div className="job-tile__footer">
        <span className="micro tabular">{salaryOf(data)}{data.createdAt !== undefined ? ` · ${new Date(data.createdAt).toLocaleDateString()}` : ""}</span>
        <span className="job-tile__spacer" />
        <Button kind="filled" small disabled={state.appliedIds.has(data.id)} onClick={() => state.requestApply(data.id)}>
          {state.appliedIds.has(data.id) ? "Applied" : "Apply Now"}
        </Button>
      </div>
    </div>
  );
}

/** Variant 3 — Compact listing: logo left, title+salary inline, icon action right. */
function CompactJobListing({ data, state }: { data: JobRow; state: CareersPageState }): React.ReactElement {
  return (
    <div className="compact-job">
      <Avatar name={data.companyName} variant="circled" />
      <span className="compact-job__title">{data.title}</span>
      <span className="compact-job__salary">{salaryOf(data)}</span>
      <button
        type="button"
        className="press"
        aria-label="Save job"
        onClick={() => void state.toggleSave(data.id, state.savedIds.has(data.id))}
        style={{ background: "transparent", border: "none", cursor: "pointer", color: state.savedIds.has(data.id) ? "var(--c-accent)" : "var(--c-neutral-500)", display: "inline-flex" }}
      >
        <Icon name="pin" size={16} />
      </button>
      <Button kind="underline-link" small disabled={state.appliedIds.has(data.id)} onClick={() => state.requestApply(data.id)}>
        {state.appliedIds.has(data.id) ? "Applied" : "Apply"}
      </Button>
    </div>
  );
}

/* --------------------------- Filter chips ----------------------------- */

export function CareerFilterChips({ state }: { state: CareersPageState }): React.ReactElement | null {
  if (state.config.filterChips.enabled !== true) return null;
  const labels: Record<string, string> = { "full-time": "Full-time", "remote": "Remote", "internship": "Internship", "graduate": "Graduate" };
  return (
    <div className="chips">
      {state.config.filterChips.options.map((opt) => (
        <button key={opt} type="button" className="chip press" aria-pressed={state.activeChips.includes(opt)} onClick={() => state.toggleChip(opt)}>
          {labels[opt] ?? opt}
        </button>
      ))}
    </div>
  );
}
