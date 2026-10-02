/**
 * Nostalgia bundle screens (Phase 5 batch 3, session 5.3): remember-when
 * threads, recipes, radio, anthem/bell, stickers/frames, time capsules
 * (seal/unseal), letters to future self, birthdays (private), awards.
 * Flat rows, hairlines, no emojis (A1/D1/G1); audio via the media store.
 */
import React, { useEffect, useRef, useState } from "react";
import { Api } from "../api.js";
import { Empty } from "./InboxScreen.js";
import { Section } from "./ProfileScreen.js";

const inputStyle: React.CSSProperties = {
  width: "100%", minHeight: 44, border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "15px var(--font-ui)", color: "var(--c-base-contrast)",
};

export interface NostalgiaSsrData {
  threads?: { threads: Array<{ id: string; prompt: string; week: string; posts: number }> };
  recipes?: { recipes: Array<{ id: string; title: string; ingredients: string; steps: string; story: string | null; submitted_by_name: string }> };
  tracks?: { tracks: Array<{ id: string; title: string; artist: string | null; year: number | null; external_url: string | null; added_by_name: string }> };
  anthem?: { anthemMediaId: string | null; bellMediaId: string | null };
}

export function NostalgiaScreen({ ssrData }: { ssrData?: NostalgiaSsrData }): React.ReactElement {
  const [tab, setTab] = useState<"remember" | "recipes" | "radio" | "anthem" | "capsules" | "letters" | "birthdays" | "awards">("remember");
  return (
    <main style={{ paddingBottom: 96 }}>
      <h1 className="screen-title">Nostalgia</h1>
      <div style={{ display: "flex", borderBottom: "1px solid var(--c-hairline)", overflowX: "auto" }}>
        {([["remember", "Remember when"], ["recipes", "Recipes"], ["radio", "Radio"], ["anthem", "Anthem & bell"], ["capsules", "Capsules"], ["letters", "Future letters"], ["birthdays", "Birthdays"], ["awards", "Awards"]] as const).map(([k, label]) => (
          <button key={k} type="button" className="press" onClick={() => setTab(k)} aria-current={tab === k}
            style={{ minHeight: 44, flex: 1, background: "transparent", border: "none", borderBottom: tab === k ? "2px solid var(--c-accent)" : "2px solid transparent", color: tab === k ? "var(--c-accent)" : "var(--c-neutral-600)", font: "600 12px var(--font-ui)", cursor: "pointer", whiteSpace: "nowrap", padding: "0 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {label}
          </button>
        ))}
      </div>
      {tab === "remember" && <RememberWhen ssrData={ssrData} />}
      {tab === "recipes" && <Recipes ssrData={ssrData} />}
      {tab === "radio" && <Radio ssrData={ssrData} />}
      {tab === "anthem" && <AnthemAndBell ssrData={ssrData} />}
      {tab === "capsules" && <Capsules />}
      {tab === "letters" && <FutureLetters />}
      {tab === "birthdays" && <Birthdays />}
      {tab === "awards" && <Awards />}
    </main>
  );
}

function RememberWhen({ ssrData }: { ssrData?: NostalgiaSsrData }): React.ReactElement {
  const [threads, setThreads] = useState<Array<{ id: string; prompt: string; week: string; posts: number }> | null>(ssrData?.threads?.threads ?? null);
  const [open, setOpen] = useState<{ thread: { prompt: string; week: string }; stories: Array<{ id: string; story: string; author: string }> } | null>(null);
  const [story, setStory] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const load = (): void => { Api.rememberWhen().then((r) => setThreads(r.threads)).catch(() => undefined); };
  useEffect(() => { if (ssrData?.threads === undefined) load();
  }, []);

  const share = async (): Promise<void> => {
    if (story.trim().length < 4) return;
    try {
      const r = await Api.rememberWhenPost({ story });
      setNote("Shared with this week's prompt.");
      setStory("");
      const detail = await Api.rememberWhenThread(r.threadId);
      setOpen(detail);
      load();
    } catch (e) { setNote((e as Error).message); }
  };

  const openThread = async (id: string): Promise<void> => {
    Api.rememberWhenThread(id).then((r) => setOpen(r as never)).catch(() => undefined);
  };

  if (open !== null) {
    return (
      <div style={{ padding: 16 }}>
        <button type="button" className="btn btn--underline-link press" onClick={() => setOpen(null)}>All prompts</button>
        <h2 style={{ font: "700 22px var(--font-ui)" }}>{open.thread.prompt}</h2>
        <div className="micro tabular" style={{ paddingBottom: 8 }}>{open.thread.week}</div>
        {open.stories.map((s) => (
          <div key={s.id} style={{ borderBottom: "1px solid var(--c-hairline)", padding: "8px 0" }}>
            <span style={{ font: "14px var(--font-ui)" }}>{s.story}</span>
            <span className="micro"> — {s.author}</span>
          </div>
        ))}
        <textarea value={story} onChange={(e) => setStory(e.target.value)} placeholder="Add your memory…" aria-label="Your memory"
          style={{ ...inputStyle, minHeight: 72, resize: "vertical", margin: "12px 0 8px" }} />
        <button type="button" className="btn btn--filled press" onClick={() => void share()} disabled={story.trim().length < 4}>Share memory</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--c-hairline)" }}>
        <p className="micro" style={{ margin: 0 }}>This week's prompt is created automatically when the first memory lands.</p>
      </div>
      {note !== null && <p className="micro" style={{ padding: "8px 16px 0" }}>{note}</p>}
      {threads === null ? null : threads.length === 0 ? (
        <Empty title="No prompts yet" body="The first 'remember when' story starts the tradition." />
      ) : threads.map((t) => (
        <button key={t.id} type="button" className="row press" style={{ cursor: "pointer" }} onClick={() => void openThread(t.id)}>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", font: "600 15px var(--font-ui)" }}>{t.prompt}</span>
            <span className="micro tabular">{t.week} · {t.posts} memories</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function Recipes({ ssrData }: { ssrData?: NostalgiaSsrData }): React.ReactElement {
  const [recipes, setRecipes] = useState<NostalgiaSsrData["recipes"] extends undefined ? never : NonNullable<NostalgiaSsrData["recipes"]>["recipes"] | null>(ssrData?.recipes?.recipes ?? null);
  const [title, setTitle] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [steps, setSteps] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const load = (): void => { Api.recipes().then((r) => setRecipes(r.recipes)).catch(() => undefined); };
  useEffect(() => { if (ssrData?.recipes === undefined) load();
  }, []);

  const submit = async (): Promise<void> => {
    try {
      await Api.submitRecipe({ title, ingredients, steps });
      setTitle(""); setIngredients(""); setSteps("");
      load();
    } catch (e) { setNote((e as Error).message); }
  };

  return (
    <div>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--c-hairline)" }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Recipe name" aria-label="Recipe name" style={inputStyle} />
        <input value={ingredients} onChange={(e) => setIngredients(e.target.value)} placeholder="Ingredients" aria-label="Ingredients" style={inputStyle} />
        <input value={steps} onChange={(e) => setSteps(e.target.value)} placeholder="How it's made" aria-label="Steps" style={inputStyle} />
        <button type="button" className="btn btn--outlined press" style={{ margin: "8px 0" }} onClick={() => void submit()} disabled={title.trim() === ""}>Share recipe</button>
      </div>
      {note !== null && <p className="micro" style={{ padding: "8px 16px 0" }}>{note}</p>}
      {recipes === null ? null : recipes.length === 0 ? (
        <Empty title="No recipes yet" body="Recreate the tuck-shop and dining-hall classics together." />
      ) : recipes.map((r) => (
        <div key={r.id} style={{ borderBottom: "1px solid var(--c-hairline)", padding: "12px 16px" }}>
          <div style={{ font: "700 15px var(--font-ui)", color: "var(--c-accent)" }}>{r.title}</div>
          <div className="micro">Ingredients: {r.ingredients}</div>
          <div style={{ font: "14px var(--font-ui)" }}>{r.steps}</div>
          {r.story !== null && <div className="micro" style={{ fontStyle: "italic" }}>{r.story}</div>}
          <div className="micro">shared by {r.submitted_by_name}</div>
        </div>
      ))}
    </div>
  );
}

function Radio({ ssrData }: { ssrData?: NostalgiaSsrData }): React.ReactElement {
  const [tracks, setTracks] = useState<NostalgiaSsrData["tracks"] extends undefined ? never : NonNullable<NostalgiaSsrData["tracks"]>["tracks"] | null>(ssrData?.tracks?.tracks ?? null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const load = (): void => { Api.radio().then((r) => setTracks(r.tracks)).catch(() => undefined); };
  useEffect(() => { if (ssrData?.tracks === undefined) load();
  }, []);

  const add = async (): Promise<void> => {
    try {
      await Api.addTrack({ title, artist: artist || undefined, externalUrl: url || undefined });
      setTitle(""); setArtist(""); setUrl("");
      load();
    } catch (e) { setNote((e as Error).message); }
  };

  return (
    <div>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--c-hairline)" }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Song title" aria-label="Track title" style={inputStyle} />
        <input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Artist (optional)" aria-label="Artist" style={inputStyle} />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Link to the recording (optional)" aria-label="Track link" style={inputStyle} />
        <button type="button" className="btn btn--outlined press" style={{ margin: "8px 0" }} onClick={() => void add()} disabled={title.trim() === ""}>Add to the playlist</button>
      </div>
      {note !== null && <p className="micro" style={{ padding: "8px 16px 0" }}>{note}</p>}
      {tracks === null ? null : tracks.length === 0 ? (
        <Empty title="The playlist is empty" body="Curate the era-defining songs of your school days together." />
      ) : tracks.map((t, i) => (
        <div key={t.id} className="row" style={{ padding: "8px 16px" }}>
          <span className="tabular" style={{ font: "600 14px var(--font-ui)", color: "var(--c-accent)", minWidth: 28 }}>{String(i + 1).padStart(2, "0")}</span>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", font: "500 14px var(--font-ui)" }}>
              {t.title}{t.artist !== null ? ` — ${t.artist}` : ""}{t.year !== null ? ` (${String(t.year)})` : ""}
            </span>
            <span className="micro">added by {t.added_by_name}</span>
          </span>
          {t.external_url !== null && <a href={t.external_url} target="_blank" rel="noreferrer" style={{ font: "13px var(--font-ui)", color: "var(--c-accent)" }}>Play</a>}
        </div>
      ))}
    </div>
  );
}

function AnthemAndBell({ ssrData }: { ssrData?: NostalgiaSsrData }): React.ReactElement {
  const [audio, setAudio] = useState<{ anthemMediaId: string | null; bellMediaId: string | null } | null>(ssrData?.anthem ?? null);
  const anthemRef = useRef<HTMLInputElement | null>(null);
  const bellRef = useRef<HTMLInputElement | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => { if (ssrData?.anthem === undefined) Api.anthemBell().then((r) => setAudio(r as { anthemMediaId: string | null; bellMediaId: string | null })).catch(() => undefined);
  }, []);

  const upload = async (file: File, target: "anthem" | "bell"): Promise<void> => {
    try {
      const media = await Api.uploadMedia(file);
      if (target === "anthem") await Api.setAnthem(media.id);
      else await Api.setBell(media.id);
      setNote(target === "anthem" ? "Anthem updated." : "Bell chime updated.");
      const r = await Api.anthemBell();
      setAudio(r as { anthemMediaId: string | null; bellMediaId: string | null });
    } catch (e) { setNote((e as Error).message); }
  };

  return (
    <div style={{ padding: 16 }}>
      <Section label="Anthem player">
        <p style={{ font: "15px var(--font-ui)", margin: "0 0 12px" }}>
          Treasured recordings of the anthem and hymns, streamed by every member.
        </p>
        {audio !== null && audio.anthemMediaId !== null ? (
          <audio controls src={`/v1/media/${audio.anthemMediaId}`} style={{ width: "100%" }} />
        ) : (
          <p className="micro">No anthem uploaded yet — admins add it in Manage.</p>
        )}
        <input ref={anthemRef} type="file" accept="audio/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f !== undefined) void upload(f, "anthem"); }} />
        <button type="button" className="btn btn--outlined press" style={{ marginTop: 8 }} onClick={() => anthemRef.current?.click()}>Upload anthem (admin)</button>
      </Section>
      <Section label="School bell chime">
        <p style={{ font: "15px var(--font-ui)", margin: "0 0 12px" }}>
          Optional notification chime sampled from the old school bell.
        </p>
        {audio !== null && audio.bellMediaId !== null ? (
          <audio controls src={`/v1/media/${audio.bellMediaId}`} style={{ width: "100%" }} />
        ) : (
          <p className="micro">No bell recording yet.</p>
        )}
        <input ref={bellRef} type="file" accept="audio/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f !== undefined) void upload(f, "bell"); }} />
        <button type="button" className="btn btn--outlined press" style={{ marginTop: 8 }} onClick={() => bellRef.current?.click()}>Upload bell sound (admin)</button>
      </Section>
      {note !== null && <p className="micro" style={{ color: "var(--c-accent)" }}>{note}</p>}
    </div>
  );
}

function Capsules(): React.ReactElement {
  const [capsules, setCapsules] = useState<Array<{ id: string; title: string; openAt: string; sealed: boolean; opened: boolean; body: string | null }> | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [openAt, setOpenAt] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const load = (): void => { Api.capsules().then((r) => setCapsules(r.capsules)).catch(() => undefined); };
  useEffect(load, []);

  const seal = async (): Promise<void> => {
    try {
      await Api.sealCapsule({ title, body, openAt });
      setTitle(""); setBody(""); setOpenAt("");
      load();
    } catch (e) { setNote((e as Error).message); }
  };

  const open = async (id: string): Promise<void> => {
    try {
      await Api.openCapsule(id);
      load();
    } catch (e) { setNote((e as Error).message); }
  };

  return (
    <div style={{ padding: 16 }}>
      <Section label="Seal a time capsule">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Capsule title" aria-label="Capsule title" style={inputStyle} />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="What should the future you read?" aria-label="Capsule body"
          style={{ ...inputStyle, minHeight: 72, resize: "vertical", margin: "8px 0" }} />
        <input value={openAt} onChange={(e) => setOpenAt(e.target.value)} type="date" aria-label="Open date" style={inputStyle} />
        <button type="button" className="btn btn--filled press" style={{ margin: "8px 0" }} onClick={() => void seal()} disabled={title.trim() === "" || body.trim() === "" || openAt === ""}>Seal it</button>
      </Section>
      {note !== null && <p className="micro" style={{ color: "var(--c-danger)" }}>{note}</p>}
      {capsules === null ? null : capsules.length === 0 ? (
        <Empty title="No capsules yet" body="Seal messages and photos until the milestone reunion." />
      ) : capsules.map((c) => (
        <div key={c.id} className="row" style={{ padding: "8px 0", flexWrap: "wrap" }}>
          <span style={{ flex: 1, minWidth: 180 }}>
            <span style={{ display: "block", font: "600 14px var(--font-ui)" }}>{c.title}</span>
            <span className="micro tabular">opens {new Date(c.openAt).toLocaleDateString()} · {c.opened ? "opened" : c.sealed ? "sealed" : "ready to open"}</span>
            {c.body !== null && <span style={{ font: "14px var(--font-ui)" }}>{c.body}</span>}
          </span>
          {!c.sealed && !c.opened && (
            <button type="button" className="btn btn--filled press" style={{ minHeight: 36 }} onClick={() => void open(c.id)}>Open</button>
          )}
        </div>
      ))}
    </div>
  );
}

function FutureLetters(): React.ReactElement {
  const [letters, setLetters] = useState<Array<{ id: string; deliverOn: string; sealed: boolean; delivered: boolean; body: string | null }> | null>(null);
  const [body, setBody] = useState("");
  const [deliverOn, setDeliverOn] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const load = (): void => { Api.letters().then((r) => setLetters(r.letters)).catch(() => undefined); };
  useEffect(load, []);

  const write = async (): Promise<void> => {
    try {
      await Api.writeLetter({ body, deliverOn });
      setBody(""); setDeliverOn("");
      load();
    } catch (e) { setNote((e as Error).message); }
  };

  return (
    <div style={{ padding: 16 }}>
      <Section label="Write to your future self">
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Dear future me…" aria-label="Letter body"
          style={{ ...inputStyle, minHeight: 88, resize: "vertical", margin: "8px 0" }} />
        <input value={deliverOn} onChange={(e) => setDeliverOn(e.target.value)} type="date" aria-label="Delivery date" style={inputStyle} />
        <button type="button" className="btn btn--filled press" style={{ margin: "8px 0" }} onClick={() => void write()} disabled={body.trim() === "" || deliverOn === ""}>Seal the letter</button>
      </Section>
      {note !== null && <p className="micro" style={{ color: "var(--c-danger)" }}>{note}</p>}
      {letters === null ? null : letters.length === 0 ? (
        <Empty title="No letters yet" body="Write now, and your future self reads it on the chosen day." />
      ) : letters.map((l) => (
        <div key={l.id} className="row" style={{ padding: "8px 0" }}>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", font: "600 14px var(--font-ui)" }}>
              {l.delivered ? "Delivered" : "Sealed"} — reads {new Date(l.deliverOn).toLocaleDateString()}
            </span>
            {l.body !== null && <span style={{ font: "14px var(--font-ui)" }}>{l.body}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

function Birthdays(): React.ReactElement {
  const [birthdays, setBirthdays] = useState<Array<{ name: string; setYear: number | null; inDays: number }> | null>(null);
  useEffect(() => { Api.birthdays().then((r) => setBirthdays(r.birthdays)).catch(() => undefined); }, []);
  if (birthdays === null) return <main className="screen-pad" />;
  if (birthdays.length === 0) return <Empty title="No birthdays on your list" body="Setmates with visible birthdays appear here — gently." />;
  return (
    <div style={{ padding: 16 }}>
      <p className="micro" style={{ margin: "0 0 8px" }}>Yours and your setmates' — private, memorial members excluded.</p>
      {birthdays.map((b, i) => (
        <div key={i} className="row" style={{ padding: "8px 0" }}>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", font: "500 14px var(--font-ui)" }}>
              {b.name}{b.setYear !== null ? ` · Set '${String(b.setYear).slice(-2)}` : ""}
            </span>
          </span>
          <span className="micro tabular">{b.inDays === 0 ? "TODAY" : b.inDays === 1 ? "tomorrow" : `in ${b.inDays} days`}</span>
        </div>
      ))}
    </div>
  );
}

function Awards(): React.ReactElement {
  const [awards, setAwards] = useState<Array<{ id: string; member_name: string; title: string; citation: string | null; awarded_at: string }> | null>(null);
  const [title, setTitle] = useState("");
  const [citation, setCitation] = useState("");
  const memberIdRef = useRef<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = (): void => { Api.awards().then((r) => setAwards(r.awards)).catch(() => undefined); };
  useEffect(load, []);

  const award = async (): Promise<void> => {
    if (title.trim().length < 2 || memberIdRef.current === null) return;
    try {
      await Api.awardMember(memberIdRef.current, { title, citation: citation || undefined });
      setTitle(""); setCitation(""); memberIdRef.current = null;
      load();
    } catch (e) { setNote((e as Error).message); }
  };

  const pick = async (): Promise<void> => {
    // simple picker: use the first searched member
    const hits = await Api.searchMembers("").then((r) => r.members).catch(() => []);
    if (hits.length > 0) {
      memberIdRef.current = hits[0]!.id;
      setNote(`Award will go to ${hits[0]!.display_name} (first member in the list).`);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <Section label="Annual awards ceremony">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Award title" aria-label="Award title"
            style={{ flex: 1, minWidth: 160, ...inputStyle }} />
          <button type="button" className="btn btn--outlined press" onClick={() => void pick()}>Pick first member</button>
        </div>
        <input value={citation} onChange={(e) => setCitation(e.target.value)} placeholder="Citation (optional)" aria-label="Citation" style={{ ...inputStyle, marginTop: 8 }} />
        <button type="button" className="btn btn--filled press" style={{ margin: "8px 0" }} onClick={() => void award()} disabled={title.trim().length < 2}>Award</button>
      </Section>
      {note !== null && <p className="micro" style={{ color: "var(--c-accent)" }}>{note}</p>}
      {awards === null ? null : awards.length === 0 ? (
        <Empty title="No awards yet" body="The annual ceremony honours professional, charitable and lifetime service." />
      ) : awards.map((a) => (
        <div key={a.id} style={{ borderBottom: "1px solid var(--c-hairline)", padding: "12px 0" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
            <span style={{ font: "700 15px var(--font-ui)", color: "var(--c-accent)" }}>{a.title}</span>
            <span style={{ font: "600 14px var(--font-ui)" }}>{a.member_name}</span>
            <span className="micro tabular">{new Date(a.awarded_at).toLocaleDateString()}</span>
          </div>
          {a.citation !== null && <p style={{ font: "14px var(--font-ui)", margin: "4px 0 0" }}>{a.citation}</p>}
        </div>
      ))}
    </div>
  );
}
