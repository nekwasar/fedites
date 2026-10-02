/**
 * Careers page hook — business logic decoupled from header/job-card variants
 * (MODULE 2 spec). One hook owns the board data, filters, saved jobs,
 * applications and handlers; the three header variants and three job-card
 * variants render from config.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Api } from "../api.js";
import type { JobRow } from "../events-types.js";
import type { CareersPageConfig } from "@fedites/config";

const FILTERS: Record<string, (j: JobRow) => boolean> = {
  "full-time": (j) => j.employmentType === "full_time",
  "remote": (j) => j.workMode === "remote",
  "internship": (j) => j.employmentType === "internship",
  "graduate": (j) => j.employmentType === "graduate_trainee",
};

export function useCareersPage(config: CareersPageConfig) {
  const [jobs, setJobs] = useState<JobRow[] | null>(null);
  const [saved, setSaved] = useState<Array<{ id: string; title: string; company_name: string }>>([]);
  const [apps, setApps] = useState<Array<{ id: string; title: string; companyName: string; status: string; createdAt: string }>>([]);
  const [activeChips, setActiveChips] = useState<string[]>([]);
  const [keywords, setKeywords] = useState("");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [pendingApply, setPendingApply] = useState<string | null>(null);
  const [coverNote, setCoverNote] = useState("");

  const load = useCallback((): void => {
    Api.jobs({ text: keywords.trim() !== "" ? keywords : undefined })
      .then((r) => setJobs(r.jobs))
      .catch(() => setJobs([]));
    Api.savedJobs().then((r) => setSaved(r.jobs)).catch(() => undefined);
    Api.myApplications().then((r) => setApps(r.applications)).catch(() => undefined);
  }, [keywords]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    if (jobs === null) return null;
    let out = jobs;
    for (const chip of activeChips) {
      const f = FILTERS[chip];
      if (f !== undefined) out = out.filter(f);
    }
    const loc = location.trim().toLowerCase();
    if (loc !== "") out = out.filter((j) => j.city !== null && j.city.toLowerCase().includes(loc));
    return out;
  }, [jobs, activeChips, location]);

  const savedIds = useMemo(() => new Set(saved.map((s) => s.id)), [saved]);
  const appliedIds = useMemo(() => new Set(apps.map((a) => a.id)), [apps]);

  const toggleChip = useCallback((chip: string): void => {
    setActiveChips((chips) => (chips.includes(chip) ? chips.filter((c) => c !== chip) : [...chips, chip]));
  }, []);

  const requestApply = useCallback((jobId: string): void => {
    setPendingApply(jobId);
    setCoverNote("");
  }, []);

  const confirmApply = useCallback(async (): Promise<void> => {
    if (pendingApply === null) return;
    try {
      await Api.applyToJob(pendingApply, { coverNote: coverNote.trim() !== "" ? coverNote : undefined });
      setNote("Application submitted — the posting alumnus will move it through the pipeline.");
      setPendingApply(null);
      setCoverNote("");
      load();
    } catch (e) { setNote((e as Error).message); }
  }, [pendingApply, coverNote, load]);

  const toggleSave = useCallback(async (jobId: string, unsave: boolean): Promise<void> => {
    try {
      if (unsave) await Api.unsaveJob(jobId);
      else await Api.saveJob(jobId);
      load();
    } catch (e) { setNote((e as Error).message); }
  }, [load]);

  return {
    config,
    jobs: visible,
    saved, savedIds,
    apps, appliedIds,
    activeChips, toggleChip,
    keywords, setKeywords, location, setLocation,
    note, setNote,
    posting, setPosting,
    pendingApply, setPendingApply, coverNote, setCoverNote,
    requestApply, confirmApply, toggleSave,
    reload: load,
  };
}

export type CareersPageState = ReturnType<typeof useCareersPage>;
