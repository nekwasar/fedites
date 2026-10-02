/**
 * Knowledge & voices screens (Phase 5 batch 2, session 5.2): wiki with
 * revision history + revert + lock, slang dictionary (submit/approve),
 * history timeline, alumni spotlights, long-form articles with admin
 * screening. Flat rows, hairlines, no emojis (A1/D1/G1).
 */
import React, { useEffect, useState } from "react";
import { Api } from "../api.js";
import { Empty } from "./InboxScreen.js";
import type { WikiPage } from "../events-types.js";

const inputStyle: React.CSSProperties = {
  width: "100%", minHeight: 44, border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "15px var(--font-ui)", color: "var(--c-base-contrast)",
};

export interface KnowledgeSsrData {
  wiki?: { pages: WikiPage[] };
  slang?: { terms: Array<{ id: string; term: string; meaning: string; example: string | null }> };
  timeline?: { events: Array<{ id: string; year: number; title: string; story: string | null }> };
  spotlights?: { spotlights: Array<{ id: string; member_name: string; interview: string; published_at: string }> };
  articles?: { articles: Array<{ id: string; title: string; body: string; author_name: string; published_at: string }> };
}

export function KnowledgeScreen({ ssrData }: { ssrData?: KnowledgeSsrData }): React.ReactElement {
  const [tab, setTab] = useState<"wiki" | "slang" | "timeline" | "spotlights" | "articles">("wiki");
  return (
    <main style={{ paddingBottom: 96 }}>
      <h1 className="screen-title">School knowledge</h1>
      <div style={{ display: "flex", borderBottom: "1px solid var(--c-hairline)", overflowX: "auto" }}>
        {([["wiki", "Wiki"], ["slang", "Slang"], ["timeline", "Timeline"], ["spotlights", "Spotlights"], ["articles", "Articles"]] as const).map(([k, label]) => (
          <button key={k} type="button" className="press" onClick={() => setTab(k)} aria-current={tab === k}
            style={{ minHeight: 44, flex: 1, background: "transparent", border: "none", borderBottom: tab === k ? "2px solid var(--c-accent)" : "2px solid transparent", color: tab === k ? "var(--c-accent)" : "var(--c-neutral-600)", font: "600 13px var(--font-ui)", cursor: "pointer", whiteSpace: "nowrap", padding: "0 12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {label}
          </button>
        ))}
      </div>
      {tab === "wiki" && <WikiTab ssrData={ssrData} />}
      {tab === "slang" && <SlangTab ssrData={ssrData} />}
      {tab === "timeline" && <TimelineTab ssrData={ssrData} />}
      {tab === "spotlights" && <SpotlightsTab ssrData={ssrData} />}
      {tab === "articles" && <ArticlesTab ssrData={ssrData} />}
    </main>
  );
}

function WikiTab({ ssrData }: { ssrData?: KnowledgeSsrData }): React.ReactElement {
  const [note, setNote] = useState<string | null>(null);
  const [pages, setPages] = useState<WikiPage[] | null>(ssrData?.wiki?.pages ?? null);
  const [open, setOpen] = useState<{ slug: string; title: string; body: string; locked: boolean; history: Array<{ id: string; author_name: string; note: string | null; created_at: string }> } | null>(null);
  const [editBody, setEditBody] = useState("");
  const [query, setQuery] = useState("");

  const load = (): void => { Api.wikiPages(query).then((r) => setPages(r.pages)).catch(() => undefined); };
  useEffect(() => { if (ssrData?.wiki === undefined && query === "") load(); else if (query !== "") load();
  }, [query]);

  const openPage = (slug: string): void => {
    Api.wikiPage(slug).then((r) => { setOpen(r as never); setEditBody((r as { page: { body: string } }).page.body); }).catch(() => undefined);
  };

  const save = async (): Promise<void> => {
    if (open === null || editBody.trim().length === 0) return;
    try {
      await Api.saveWikiPage(open.slug, { body: editBody });
    } catch (e) { setNote((e as Error).message); }
    openPage(open.slug);
  };

  const revert = async (revisionId: string): Promise<void> => {
    if (open === null) return;
    try {
      await Api.revertWikiPage(open.slug, revisionId);
    } catch (e) { setNote((e as Error).message); }
    openPage(open.slug);
  };

  if (open !== null) {
    return (
      <div style={{ padding: 16 }}>
        <button type="button" className="btn btn--underline-link press" onClick={() => setOpen(null)}>All pages</button>
        <h2 style={{ font: "700 22px var(--font-ui)" }}>{open.title}{open.locked ? " (locked)" : ""}</h2>
        <p style={{ font: "15px var(--font-ui)", whiteSpace: "pre-wrap" }}>{open.body}</p>
        <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} aria-label="Edit page"
          style={{ ...inputStyle, minHeight: 100, resize: "vertical", marginBottom: 8 }} />
        <button type="button" className="btn btn--filled press" style={{ marginBottom: 16 }} onClick={() => void save()}>Save revision</button>
        <div className="micro" style={{ margin: "12px 0 8px" }}>Revision history</div>
        {open.history.map((h, i) => (
          <div key={h.id} className="row" style={{ padding: "8px 0" }}>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", font: "500 14px var(--font-ui)" }}>
                {i === 0 ? "Current" : `Revision ${open.history.length - i}`}{h.note !== null ? ` — ${h.note}` : ""}
              </span>
              <span className="micro tabular">{h.author_name} · {new Date(h.created_at ?? Date.now()).toLocaleString()}</span>
            </span>
            {i !== 0 && (
              <button type="button" className="btn btn--underline-link press" style={{ minHeight: 28 }} onClick={() => void revert(h.id)}>Revert</button>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--c-hairline)" }}>
        {note !== null && <p className="micro" style={{ color: "var(--c-danger)", paddingBottom: 4 }}>{note}</p>}
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search pages…" aria-label="Search wiki"
          style={{ ...inputStyle, minHeight: 44 }} />
        <button type="button" className="btn btn--underline-link press" style={{ marginTop: 4 }} onClick={() => { const slug = query.trim().toLowerCase().replace(/\s+/g, "-"); if (slug.length > 0) openPage(slug); }}>
          Open or create "{query.trim()}"
        </button>
      </div>
      {pages === null ? null : pages.length === 0 ? (
        <Empty title="The wiki is empty" body="Start the encyclopedia of houses, traditions and legends." />
      ) : pages.map((p) => (
        <button key={p.id} type="button" className="row press" style={{ cursor: "pointer" }} onClick={() => openPage(p.slug)}>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", font: "600 15px var(--font-ui)" }}>{p.title}{p.locked ? " (locked)" : ""}</span>
            <span className="micro tabular">edited {new Date(p.updated_at).toLocaleDateString()}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function SlangTab({ ssrData }: { ssrData?: KnowledgeSsrData }): React.ReactElement {
  const [terms, setTerms] = useState<Array<{ id: string; term: string; meaning: string; example: string | null }> | null>(ssrData?.slang?.terms ?? null);
  const [term, setTerm] = useState("");
  const [meaning, setMeaning] = useState("");
  const [query, setQuery] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const load = (): void => { Api.slang(query).then((r) => setTerms(r.terms)).catch(() => undefined); };
  useEffect(load, [query]);

  const submit = async (): Promise<void> => {
    try {
      const r = await Api.submitSlang({ term, meaning });
      setNote(r.status === "pending" ? "Submitted — an admin will review it." : "Added to the dictionary.");
      setTerm(""); setMeaning("");
      load();
    } catch (e) { setNote((e as Error).message); }
  };

  return (
    <div>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--c-hairline)" }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the dictionary…" aria-label="Search slang" style={{ ...inputStyle, minHeight: 44 }} />
        <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="New term" aria-label="Slang term" style={{ ...inputStyle, minHeight: 44 }} />
        <input value={meaning} onChange={(e) => setMeaning(e.target.value)} placeholder="What it means" aria-label="Slang meaning" style={{ ...inputStyle, minHeight: 44 }} />
        <button type="button" className="btn btn--outlined press" style={{ margin: "8px 0" }} onClick={() => void submit()} disabled={term.trim() === "" || meaning.trim() === ""}>Submit term</button>
      </div>
      {note !== null && <p className="micro" style={{ padding: "8px 16px 0" }}>{note}</p>}
      {terms === null ? null : terms.length === 0 ? (
        <Empty title="The dictionary awaits" body="Crowd-source the school's vocabulary — admins review each term." />
      ) : terms.map((t) => (
        <div key={t.id} style={{ borderBottom: "1px solid var(--c-hairline)", padding: "12px 16px" }}>
          <div style={{ font: "700 15px var(--font-ui)", color: "var(--c-accent)" }}>{t.term}</div>
          <div style={{ font: "14px var(--font-ui)" }}>{t.meaning}</div>
          {t.example !== null && <div className="micro" style={{ fontStyle: "italic" }}>"{t.example}"</div>}
        </div>
      ))}
    </div>
  );
}

function TimelineTab({ ssrData }: { ssrData?: KnowledgeSsrData }): React.ReactElement {
  const events = ssrData?.timeline?.events ?? null;
  if (events === null) return <main className="screen-pad" />;
  if (events.length === 0) return <Empty title="The timeline is empty" body="Milestones from the founding to today, curated by the admins." />;
  return (
    <div style={{ padding: 16 }}>
      {events.map((e) => (
        <div key={e.id} style={{ display: "flex", gap: 16, borderBottom: "1px solid var(--c-hairline)", padding: "12px 0" }}>
          <span className="tabular" style={{ font: "700 22px var(--font-ui)", color: "var(--c-accent)", minWidth: 64 }}>{e.year}</span>
          <span>
            <span style={{ display: "block", font: "600 15px var(--font-ui)" }}>{e.title}</span>
            {e.story !== null && <span style={{ font: "14px var(--font-ui)" }}>{e.story}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

function SpotlightsTab({ ssrData }: { ssrData?: KnowledgeSsrData }): React.ReactElement {
  const spotlights = ssrData?.spotlights?.spotlights ?? null;
  if (spotlights === null) return <main className="screen-pad" />;
  if (spotlights.length === 0) return <Empty title="No spotlights yet" body="Regular interviews celebrating inspiring members." />;
  return (
    <div style={{ padding: 16 }}>
      {spotlights.map((s) => (
        <div key={s.id} style={{ borderBottom: "1px solid var(--c-hairline)", padding: "12px 0" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
            <span style={{ font: "700 15px var(--font-ui)", color: "var(--c-accent)" }}>{s.member_name}</span>
            <span className="micro tabular">{new Date(s.published_at).toLocaleDateString()}</span>
          </div>
          <p style={{ font: "14px var(--font-ui)", whiteSpace: "pre-wrap", margin: "8px 0 0" }}>{s.interview}</p>
        </div>
      ))}
    </div>
  );
}

function ArticlesTab({ ssrData }: { ssrData?: KnowledgeSsrData }): React.ReactElement {
  const [articles, setArticles] = useState<Array<{ id: string; title: string; body: string; author_name: string; published_at: string }> | null>(ssrData?.articles?.articles ?? null);
  const [writing, setWriting] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const load = (): void => { Api.articles().then((r) => setArticles(r.articles)).catch(() => undefined); };
  useEffect(load, []);

  const submit = async (): Promise<void> => {
    try {
      const r = await Api.submitArticle({ title, body });
      setNote(r.status === "submitted" ? "Submitted — an admin will screen it before publication." : "Published.");
      setWriting(false); setTitle(""); setBody("");
      load();
    } catch (e) { setNote((e as Error).message); }
  };

  return (
    <div>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--c-hairline)" }}>
        {!writing && <button type="button" className="btn btn--filled press" onClick={() => setWriting(true)}>Write an article</button>}
        {writing && (
          <>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" aria-label="Article title" style={{ ...inputStyle, minHeight: 44 }} />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Your story, memoir, or reflection…" aria-label="Article body"
              style={{ ...inputStyle, minHeight: 120, resize: "vertical", margin: "8px 0" }} />
            <button type="button" className="btn btn--filled press" onClick={() => void submit()} disabled={title.trim().length < 2 || body.trim().length < 10}>Submit for screening</button>
          </>
        )}
      </div>
      {note !== null && <p className="micro" style={{ padding: "8px 16px 0" }}>{note}</p>}
      {articles === null ? null : articles.length === 0 ? (
        <Empty title="No published articles" body="Essays, memoirs and tributes appear here after admin screening." />
      ) : articles.map((a) => (
        <div key={a.id} style={{ borderBottom: "1px solid var(--c-hairline)", padding: "16px" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
            <span style={{ font: "700 17px var(--font-ui)", color: "var(--c-accent)" }}>{a.title}</span>
            <span className="micro tabular">{new Date(a.published_at).toLocaleDateString()}</span>
          </div>
          <div className="micro">by {a.author_name}</div>
          <p style={{ font: "15px var(--font-ui)", whiteSpace: "pre-wrap", margin: "8px 0 0" }}>{a.body}</p>
        </div>
      ))}
    </div>
  );
}

export function KnowledgeQueues(): React.ReactElement {
  const [slang, setSlang] = useState<Array<{ id: string; term: string; meaning: string; submitted_by_name: string }> | null>(null);
  const [articles, setArticles] = useState<Array<{ id: string; title: string; author_name: string }> | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const load = (): void => {
    Api.slangQueue().then((r) => setSlang(r.pending)).catch(() => undefined);
    Api.articleQueue().then((r) => setArticles(r.submitted)).catch(() => undefined);
  };
  useEffect(load, []);
  const decideSlang = async (id: string, decision: "approve" | "decline"): Promise<void> => {
    await Api.decideSlang(id, decision).catch((e: Error) => setNote(e.message));
    load();
  };
  const decideArticle = async (id: string, decision: "publish" | "decline"): Promise<void> => {
    await Api.decideArticle(id, decision).catch((e: Error) => setNote(e.message));
    load();
  };
  return (
    <>
      <section style={{ padding: "0 16px 24px" }}>
        <div className="micro" style={{ paddingBottom: 8, borderBottom: "1px solid var(--c-hairline)", marginBottom: 12 }}>Slang terms</div>
        {note !== null && <p style={{ font: "13px var(--font-ui)", color: "var(--c-accent)", margin: "0 0 8px" }}>{note}</p>}
        {slang === null ? <div className="skeleton" style={{ height: 32 }} /> : slang.length === 0 ? (
          <p style={{ font: "14px var(--font-ui)", color: "var(--c-neutral-500)" }}>No terms awaiting review.</p>
        ) : slang.map((s) => (
          <div key={s.id} className="row" style={{ padding: "8px 0", flexWrap: "wrap" }}>
            <span style={{ flex: 1, minWidth: 200 }}>
              <span style={{ display: "block", font: "500 14px var(--font-ui)" }}>{s.term} — {s.meaning}</span>
              <span className="micro">by {s.submitted_by_name}</span>
            </span>
            <span style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn--filled press" style={{ minHeight: 36 }} onClick={() => void decideSlang(s.id, "approve")}>Approve</button>
              <button type="button" className="btn btn--underline-link press" style={{ minHeight: 36 }} onClick={() => void decideSlang(s.id, "decline")}>Decline</button>
            </span>
          </div>
        ))}
      </section>
      <section style={{ padding: "0 16px 24px" }}>
        <div className="micro" style={{ paddingBottom: 8, borderBottom: "1px solid var(--c-hairline)", marginBottom: 12 }}>Articles for screening</div>
        {articles === null ? null : articles.length === 0 ? (
          <p style={{ font: "14px var(--font-ui)", color: "var(--c-neutral-500)" }}>No articles awaiting screening.</p>
        ) : articles.map((a) => (
          <div key={a.id} className="row" style={{ padding: "8px 0", flexWrap: "wrap" }}>
            <span style={{ flex: 1, minWidth: 200 }}>
              <span style={{ display: "block", font: "500 14px var(--font-ui)" }}>{a.title}</span>
              <span className="micro">by {a.author_name}</span>
            </span>
            <span style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn--filled press" style={{ minHeight: 36 }} onClick={() => void decideArticle(a.id, "publish")}>Publish</button>
              <button type="button" className="btn btn--underline-link press" style={{ minHeight: 36 }} onClick={() => void decideArticle(a.id, "decline")}>Decline</button>
            </span>
          </div>
        ))}
      </section>
    </>
  );
}
