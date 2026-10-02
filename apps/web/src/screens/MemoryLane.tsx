/**
 * Memory Lane (Phase 5 batch 1, session 5.1): throwback archive (era filter),
 * yearbooks with name search, on-this-day, hall of fame, memorials with
 * condolence book + funeral coordination. Member uploads await admin approval
 * (§P). Flat rows, no cards, no emojis (A1/D1/G1).
 */
import React, { useEffect, useRef, useState } from "react";
import { Api } from "../api.js";
import { Empty } from "./InboxScreen.js";
import { Section } from "./ProfileScreen.js";
import type { MemoryItem, Era, Yearbook, YearbookDetail, MemorialView } from "../events-types.js";

export interface MemorySsrData { throwbacks?: { items: MemoryItem[] }; eras?: { eras: Era[] }; yearbooks?: { yearbooks: Yearbook[] }; onThisDay?: { memories: Array<{ id: string; kind: string; body: string | null; caption: string | null; year: number | null; mediaId: string | null }> }; honourees?: { honourees: Array<{ id: string; display_name: string; citation: string; year: number | null }> }; memorials?: { memorials: MemorialView[] } }

export function MemoryLaneScreen({ member, ssrData }: { member: { id: string; roles: string[] } | null; ssrData?: MemorySsrData }): React.ReactElement {
  const [tab, setTab] = useState<"throwbacks" | "yearbooks" | "onthisday" | "fame" | "memorials">("throwbacks");
  return (
    <main style={{ paddingBottom: 96 }}>
      <h1 className="screen-title">Memory Lane</h1>
      <div style={{ display: "flex", borderBottom: "1px solid var(--c-hairline)", overflowX: "auto" }}>
        {([["throwbacks", "Archive"], ["yearbooks", "Yearbooks"], ["onthisday", "On this day"], ["fame", "Hall of fame"], ["memorials", "Memorials"]] as const).map(([k, label]) => (
          <button key={k} type="button" className="press" onClick={() => setTab(k)} aria-current={tab === k}
            style={{ minHeight: 44, flex: 1, background: "transparent", border: "none", borderBottom: tab === k ? "2px solid var(--c-accent)" : "2px solid transparent", color: tab === k ? "var(--c-accent)" : "var(--c-neutral-600)", font: "600 13px var(--font-ui)", cursor: "pointer", whiteSpace: "nowrap", padding: "0 12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {label}
          </button>
        ))}
      </div>
      {tab === "throwbacks" && <Throwbacks member={member} ssrData={ssrData} />}
      {tab === "yearbooks" && <Yearbooks ssrData={ssrData} />}
      {tab === "onthisday" && <OnThisDay ssrData={ssrData} />}
      {tab === "fame" && <HallOfFame ssrData={ssrData} />}
      {tab === "memorials" && <Memorials member={member} ssrData={ssrData} />}
    </main>
  );
}

function Throwbacks({ member, ssrData }: { member: { id: string; roles: string[] } | null; ssrData?: MemorySsrData }): React.ReactElement {
  const [items, setItems] = useState<MemoryItem[] | null>(ssrData?.throwbacks?.items ?? null);
  const [eras, setEras] = useState<Era[]>(ssrData?.eras?.eras ?? []);
  const [eraFilter, setEraFilter] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = (): void => {
    Api.throwbacks(eraFilter || undefined).then((r) => setItems(r.items)).catch(() => undefined);
    Api.memoryEras().then((r) => setEras(r.eras)).catch(() => undefined);
  };
  useEffect(load, [eraFilter]);

  const upload = async (file: File): Promise<void> => {
    try {
      const media = await Api.uploadMedia(file);
      const r = await Api.addThrowback({ mediaId: media.id, eraId: eraFilter || undefined });
      setNote(r.status === "pending" ? "Upload received — an admin will approve it into the archive." : "Added to the archive.");
      load();
    } catch (e) { setNote((e as Error).message); }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, padding: "12px 16px", flexWrap: "wrap", alignItems: "center", borderBottom: "1px solid var(--c-hairline)" }}>
        <select value={eraFilter} onChange={(e) => setEraFilter(e.target.value)} aria-label="Filter by era"
          style={{ minHeight: 44, padding: "0 12px", border: "none", borderBottom: "1px solid var(--c-hairline)", background: "var(--c-base)", font: "14px var(--font-ui)", color: "var(--c-base-contrast)" }}>
          <option value="">All eras</option>
          {eras.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        {member !== null && (
          <>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f !== undefined) void upload(f); }} />
            <button type="button" className="btn btn--outlined press" onClick={() => fileRef.current?.click()}>Add a throwback</button>
          </>
        )}
      </div>
      {note !== null && <p className="micro" style={{ padding: "8px 16px 0" }}>{note}</p>}
      {items === null ? <main className="screen-pad" /> : items.length === 0 ? (
        <Empty title="The archive awaits" body="Old photos from the school years live here, organized by era." />
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 16 }}>
          {items.map((i) => (
            <figure key={i.id} style={{ width: 220, margin: 0 }}>
              <img src={`/v1/media/${i.mediaId}`} alt={i.caption ?? "Throwback"} loading="lazy"
                style={{ width: 220, aspectRatio: "3 / 2", objectFit: "cover", border: "1px solid var(--c-hairline)", display: "block" }} />
              <figcaption style={{ font: "13px var(--font-ui)", paddingTop: 4 }}>
                {i.caption ?? "Untitled"}
                <span className="micro tabular"> {i.year !== null ? `· ${i.year}` : ""}{i.status === "pending" ? " · pending approval" : ""}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}

function Yearbooks({ ssrData }: { ssrData?: MemorySsrData }): React.ReactElement {
  const books = ssrData?.yearbooks?.yearbooks ?? null;
  const [open, setOpen] = useState<YearbookDetail | null>(null);
  const [query, setQuery] = useState("");

  const search = (id: string, q: string): void => {
    Api.yearbook(id, q).then((r) => { setOpen(r); setQuery(q); }).catch(() => undefined);
  };

  if (open !== null) {
    return (
      <div style={{ padding: 16 }}>
        <button type="button" className="btn btn--underline-link press" onClick={() => setOpen(null)}>All yearbooks</button>
        <h2 style={{ font: "700 22px var(--font-ui)" }}>{open.yearbook.year} — {open.yearbook.title ?? "Yearbook"}</h2>
        <input value={query} onChange={(e) => search(open.yearbook.id, e.target.value)} placeholder="Search a name or section…" aria-label="Search yearbook"
          style={{ width: "100%", minHeight: 44, border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "15px var(--font-ui)", color: "var(--c-base-contrast)" }} />
        <div style={{ marginTop: 12 }}>
          {open.entries.length === 0
            ? <p style={{ font: "14px var(--font-ui)", color: "var(--c-neutral-500)" }}>No names match.</p>
            : open.entries.map((e) => (
              <div key={e.id} className="row" style={{ padding: "8px 0" }}>
                <span style={{ flex: 1, font: "500 14px var(--font-ui)" }}>{e.full_name}</span>
                {e.section !== null && <span className="micro">{e.section}</span>}
              </div>
            ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {books === null ? null : books.length === 0 ? (
        <Empty title="No yearbooks yet" body="Digitized yearbooks appear here, searchable by name." />
      ) : books.map((b) => (
        <button key={b.id} type="button" className="row press" style={{ cursor: "pointer" }} onClick={() => search(b.id, "")}>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", font: "600 15px var(--font-ui)" }}>{b.year} — {b.title ?? "Yearbook"}</span>
            <span className="micro tabular">{b.entryCount} names indexed</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function OnThisDay({ ssrData }: { ssrData?: MemorySsrData }): React.ReactElement {
  const [memories, setMemories] = useState<NonNullable<MemorySsrData["onThisDay"]>["memories"] | null>(ssrData?.onThisDay?.memories ?? null);
  const load = (): void => { Api.onThisDay().then((r) => setMemories(r.memories)).catch(() => undefined); };
  useEffect(() => { if (ssrData?.onThisDay === undefined) load();
  }, []);
  if (memories === null) return <main className="screen-pad" />;
  if (memories.length === 0) return <Empty title="Nothing from this day — yet" body="Memories from past years resurface every morning." />;
  return (
    <div style={{ padding: 16 }}>
      {memories.map((m, i) => (
        <div key={`${m.kind}-${i}`} className="row" style={{ padding: "8px 0" }}>
          {m.mediaId !== null && <img src={`/v1/media/${m.mediaId}`} alt="" style={{ width: 64, height: 43, objectFit: "cover", border: "1px solid var(--c-hairline)" }} />}
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", font: "500 14px var(--font-ui)" }}>{m.caption ?? m.body ?? "A memory"}</span>
            <span className="micro tabular">{m.year !== null ? `${m.year}` : ""} · {m.kind === "post" ? "from the groups" : "from the archive"}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function HallOfFame({ ssrData }: { ssrData?: MemorySsrData }): React.ReactElement {
  const [honourees, setHonourees] = useState<Array<{ id: string; display_name: string; citation: string; year: number | null }> | null>(ssrData?.honourees?.honourees ?? null);
  const load = (): void => { Api.hallOfFame().then((r) => setHonourees(r.honourees)).catch(() => undefined); };
  useEffect(() => { if (ssrData?.honourees === undefined) load();
  }, []);
  if (honourees === null) return <main className="screen-pad" />;
  if (honourees.length === 0) return <Empty title="The hall is being furnished" body="Distinguished members are honoured here by the admins." />;
  return (
    <div style={{ padding: 16 }}>
      {honourees.map((h) => (
        <div key={h.id} style={{ borderBottom: "1px solid var(--c-hairline)", padding: "12px 0" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
            <span style={{ font: "700 17px var(--font-ui)", color: "var(--c-accent)" }}>{h.display_name}</span>
            <span className="micro tabular">{h.year !== null ? String(h.year) : ""}</span>
          </div>
          <p style={{ font: "14px var(--font-ui)", margin: "4px 0 0" }}>{h.citation}</p>
        </div>
      ))}
    </div>
  );
}

function Memorials({ member, ssrData }: { member: { id: string; roles: string[] } | null; ssrData?: MemorySsrData }): React.ReactElement {
  const [list, setList] = useState<MemorialView[] | null>(ssrData?.memorials?.memorials ?? null);
  const [open, setOpen] = useState<MemorialView | null>(null);
  const [condolences, setCondolences] = useState<Array<{ id: string; message: string; attending: boolean; name: string }> | null>(null);
  const [message, setMessage] = useState("");
  const [attending, setAttending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const load = (): void => { Api.memorials().then((r) => setList(r.memorials)).catch(() => undefined); };
  useEffect(() => { if (ssrData?.memorials === undefined) load();
  }, []);
  const openPage = (m: MemorialView): void => {
    setOpen(m);
    Api.memorialCondolences(m.id).then((r) => setCondolences(r.condolences)).catch(() => undefined);
  };

  const leave = async (): Promise<void> => {
    if (open === null || message.trim().length < 2) return;
    try {
      await Api.leaveCondolence(open.id, message, attending);
      setMessage("");
      setCondolences((await Api.memorialCondolences(open.id)).condolences);
    } catch (e) { setNote((e as Error).message); }
  };

  if (list === null) return <main className="screen-pad" />;
  if (open !== null) {
    return (
      <div style={{ padding: 16 }}>
        <button type="button" className="btn btn--underline-link press" onClick={() => setOpen(null)}>All memorials</button>
        <h2 style={{ font: "700 22px var(--font-ui)" }}>{open.memberName}</h2>
        <div className="micro tabular" style={{ paddingBottom: 8 }}>
          {open.setYear !== null ? `Set '${String(open.setYear).slice(-2)} · ` : ""}{open.status}
          {open.funeralDate !== null ? ` · funeral ${new Date(open.funeralDate).toLocaleDateString()}` : ""}
        </div>
        {open.tribute !== null && <p style={{ font: "15px var(--font-ui)", fontStyle: "italic" }}>{open.tribute}</p>}
        <div className="micro" style={{ margin: "16px 0 8px" }}>Condolence book</div>
        {condolences === null ? <div className="skeleton" style={{ height: 32 }} /> : condolences.map((c) => (
          <div key={c.id} style={{ borderBottom: "1px solid var(--c-hairline)", padding: "8px 0" }}>
            <span style={{ font: "14px var(--font-ui)" }}>{c.message}</span>
            <span className="micro"> — {c.name}{c.attending ? " · attending the funeral" : ""}</span>
          </div>
        ))}
        <div style={{ marginTop: 12 }}>
          <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Leave a message" aria-label="Condolence message"
            style={{ width: "100%", minHeight: 44, border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "14px var(--font-ui)", color: "var(--c-base-contrast)" }} />
          <label style={{ font: "13px var(--font-ui)", display: "flex", gap: 8, alignItems: "center", margin: "8px 0" }}>
            <input type="checkbox" checked={attending} onChange={(e) => setAttending(e.target.checked)} /> I plan to attend the funeral
          </label>
          <button type="button" className="btn btn--filled press" onClick={() => void leave()} disabled={message.trim().length < 2}>Sign the book</button>
        </div>
      </div>
    );
  }
  return (
    <div>
      {note !== null && <p className="micro" style={{ padding: "0 16px 8px", color: "var(--c-danger)" }}>{note}</p>}
      {list.length === 0 ? (
        <Empty title="No memorial pages" body="Memorial pages open after a member request and admin approval — family confirmed by the admins." />
      ) : list.map((m) => (
        <button key={m.id} type="button" className="row press" style={{ cursor: "pointer" }} onClick={() => openPage(m)}>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", font: "600 15px var(--font-ui)" }}>{m.memberName}</span>
            {m.tribute !== null && <span className="micro">{m.tribute.slice(0, 60)}</span>}
          </span>
        </button>
      ))}
      {member !== null && <p className="micro" style={{ padding: "12px 16px" }}>To request a memorial page for a departed classmate, contact the committee — family is confirmed by the admins.</p>}
    </div>
  );
}

/** Admin workbench (Manage → Content): bulk upload, yearbooks, approvals. */
export function MemoryAdmin(): React.ReactElement {
  const [note, setNote] = useState<string | null>(null);
  void note;
  const [pending, setPending] = useState<Array<{ id: string; media_id: string; caption: string | null; uploader_name: string }> | null>(null);
  const [memorialReqs, setMemorialReqs] = useState<Array<{ id: string; member_name: string; requested_by_name: string }> | null>(null);
  const [eras, setEras] = useState<Era[]>([]);
  const [eraName, setEraName] = useState("");
  const [eraFrom, setEraFrom] = useState("");
  const [eraTo, setEraTo] = useState("");
  const [bookYear, setBookYear] = useState("");
  const [bulkYear, setBulkYear] = useState("");
  const bulkRef = useRef<HTMLInputElement | null>(null);
  const csvRef = useRef<HTMLTextAreaElement | null>(null);
  const [honName, setHonName] = useState("");
  const [honCitation, setHonCitation] = useState("");

  const load = (): void => {
    Api.memoryQueue().then((r) => setPending(r.pending)).catch(() => undefined);
    Api.memorialRequests().then((r) => setMemorialReqs(r.requests)).catch(() => undefined);
    Api.memoryEras().then((r) => setEras(r.eras)).catch(() => undefined);
  };
  useEffect(load, []);

  const bulkUpload = async (files: FileList): Promise<void> => {
    const form = new FormData();
    for (const f of Array.from(files)) form.append("files", f);
    form.append("kind", "throwback");
    form.append("eraId", eraName ? (eras.find((e) => e.name === eraName)?.id ?? "") : "");
    form.append("year", bulkYear);
    const r = await fetch(`${(import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8787")}/v1/manage/memory/bulk`, { method: "POST", credentials: "include", body: form });
    if (!r.ok) { setNote("Bulk upload failed. Check file sizes and try again."); return; }
    const body = (await r.json()) as { created: number };
    setNote(`Uploaded ${body.created} item(s) into the archive.`);
    load();
  };

  const createEra = async (): Promise<void> => {
    if (eraName.trim().length === 0) return;
    await Api.createEra({ name: eraName, yearFrom: eraFrom ? Number(eraFrom) : undefined, yearTo: eraTo ? Number(eraTo) : undefined }).catch((e: Error) => setNote(e.message));
    setEraName(""); setEraFrom(""); setEraTo("");
    Api.memoryEras().then((r) => setEras(r.eras)).catch(() => undefined);
  };

  const importCsv = async (): Promise<void> => {
    const csv = csvRef.current?.value ?? "";
    const books = await Api.yearbooks();
    if (books.yearbooks.length === 0) { setNote("Create a yearbook first."); return; }
    const r = await Api.importYearbookNames(books.yearbooks[0]!.id, csv).catch((e: Error) => { setNote(e.message); return null; });
    if (r !== null) setNote(`Imported ${r.imported} names into ${books.yearbooks[0]!.year}.`);
  };

  const createHonouree = async (): Promise<void> => {
    if (honName.trim().length < 2 || honCitation.trim().length < 4) return;
    await Api.addHonouree({ name: honName, citation: honCitation }).catch((e: Error) => setNote(e.message));
    setHonName(""); setHonCitation("");
  };

  const decide = async (id: string, decision: "approve" | "decline"): Promise<void> => {
    await Api.decideMemoryItem(id, decision).catch((e: Error) => setNote(e.message));
    load();
  };

  const decideMemorial = async (id: string, decision: "approve" | "decline"): Promise<void> => {
    await Api.decideMemorial(id, decision).catch((e: Error) => setNote(e.message));
    load();
  };

  const inputStyle: React.CSSProperties = { width: "100%", minHeight: 44, border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "14px var(--font-ui)", color: "var(--c-base-contrast)" };
  const fieldStyle: React.CSSProperties = { flex: 1, minWidth: 140, minHeight: 44, padding: "0 12px", border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "14px var(--font-ui)", color: "var(--c-base-contrast)" };

  return (
    <>
      <Section label="Bulk upload (era archive)">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <input value={eraName} onChange={(e) => setEraName(e.target.value)} placeholder="New era name" aria-label="Era name" style={fieldStyle} />
          <input value={eraFrom} onChange={(e) => setEraFrom(e.target.value)} inputMode="numeric" placeholder="From year" aria-label="Era from" style={{ ...fieldStyle, maxWidth: 120 }} />
          <input value={eraTo} onChange={(e) => setEraTo(e.target.value)} inputMode="numeric" placeholder="To year" aria-label="Era to" style={{ ...fieldStyle, maxWidth: 120 }} />
          <button type="button" className="btn btn--outlined press" onClick={() => void createEra()}>Add era</button>
        </div>
        {eras.length > 0 && <p className="micro">Eras: {eras.map((e) => e.name).join(" · ")}</p>}
        <input ref={bulkRef} type="file" multiple accept="image/*" hidden onChange={(e) => { const f = e.target.files; if (f !== null && f.length > 0) void bulkUpload(f); }} />
        <input value={bulkYear} onChange={(e) => setBulkYear(e.target.value)} inputMode="numeric" placeholder="Year for the upload" aria-label="Upload year" style={inputStyle} />
        <button type="button" className="btn btn--filled press" style={{ marginTop: 8 }} onClick={() => bulkRef.current?.click()}>Select files to upload</button>
      </Section>

      <Section label="Archive approval queue (member uploads)">
        {pending === null ? <div className="skeleton" style={{ height: 32 }} /> : pending.length === 0 ? (
          <p style={{ font: "14px var(--font-ui)", color: "var(--c-neutral-500)" }}>Nothing awaiting approval.</p>
        ) : pending.map((p) => (
          <div key={p.id} className="row" style={{ padding: "8px 0" }}>
            <img src={`/v1/media/${p.media_id}`} alt="" style={{ width: 64, height: 43, objectFit: "cover", border: "1px solid var(--c-hairline)" }} />
            <span style={{ flex: 1, font: "500 14px var(--font-ui)" }}>
              {p.caption ?? "Untitled"} <span className="micro">by {p.uploader_name}</span>
            </span>
            <button type="button" className="btn btn--filled press" style={{ minHeight: 36 }} onClick={() => void decide(p.id, "approve")}>Approve</button>
            <button type="button" className="btn btn--underline-link press" style={{ minHeight: 36 }} onClick={() => void decide(p.id, "decline")}>Decline</button>
          </div>
        ))}
      </Section>

      <Section label="Yearbook + names CSV">
        <input value={bookYear} onChange={(e) => setBookYear(e.target.value)} inputMode="numeric" placeholder="Yearbook year, e.g. 1998" aria-label="Yearbook year" style={inputStyle} />
        <button type="button" className="btn btn--outlined press" style={{ margin: "8px 0" }} disabled={bookYear === ""} onClick={() => void Api.createYearbook({ year: Number(bookYear) }).then(() => setNote(`Yearbook ${bookYear} created.`)).catch((e: Error) => setNote(e.message))}>Create yearbook</button>
        <textarea ref={csvRef} placeholder={"One name per line; optional section:\nAda President,House Mercury\nFemi Member,Science Club"} aria-label="Yearbook names CSV"
          style={{ width: "100%", minHeight: 72, border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "14px var(--font-ui)", color: "var(--c-base-contrast)", resize: "vertical" }} />
        <button type="button" className="btn btn--filled press" style={{ marginTop: 8 }} onClick={() => void importCsv()}>Import names</button>
      </Section>

      <Section label="Hall of fame">
        <input value={honName} onChange={(e) => setHonName(e.target.value)} placeholder="Honouree name" aria-label="Honouree name" style={inputStyle} />
        <input value={honCitation} onChange={(e) => setHonCitation(e.target.value)} placeholder="Citation" aria-label="Citation" style={inputStyle} />
        <button type="button" className="btn btn--filled press" style={{ marginTop: 8 }} onClick={() => void createHonouree()} disabled={honName.trim().length < 2 || honCitation.trim().length < 4}>Add honouree</button>
      </Section>

      <Section label="Memorial page requests">
        {memorialReqs === null ? <div className="skeleton" style={{ height: 32 }} /> : memorialReqs.length === 0 ? (
          <p style={{ font: "14px var(--font-ui)", color: "var(--c-neutral-500)" }}>No requests. Approval puts the member into memorial state.</p>
        ) : memorialReqs.map((m) => (
          <div key={m.id} className="row" style={{ padding: "8px 0" }}>
            <span style={{ flex: 1, font: "500 14px var(--font-ui)" }}>
              {m.member_name} <span className="micro">requested by {m.requested_by_name}</span>
            </span>
            <button type="button" className="btn btn--filled press" style={{ minHeight: 36 }} onClick={() => void decideMemorial(m.id, "approve")}>Approve</button>
            <button type="button" className="btn btn--underline-link press" style={{ minHeight: 36 }} onClick={() => void decideMemorial(m.id, "decline")}>Decline</button>
          </div>
        ))}
      </Section>
    </>
  );
}
