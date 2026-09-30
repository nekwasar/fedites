/**
 * News bulletin (2.4) + Feed v1 (2.5) with the melt-into-group signature
 * motion (F5) and intent rails v0.
 */
import React, { useEffect, useMemo, useState } from "react";
import { Api } from "../api.js";
import { Empty, SkeletonList } from "./InboxScreen.js";
import type { NewsItem, NewsResponse, FeedResponse, FeedItem } from "../phase2-types.js";

export function NewsScreen({ signedIn, onNavigate }: { signedIn: boolean; onNavigate: (to: string) => void }): React.ReactElement {
  const [data, setData] = useState<NewsResponse | null>(null);
  const [composer, setComposer] = useState("");
  const [commentsOn, setCommentsOn] = useState(false);

  const load = (): void => { Api.news().then(setData).catch(() => setData({ items: [], mySetGroup: null })); };
  useEffect(load, []);

  const post = async (): Promise<void> => {
    if (composer.trim().length === 0) return;
    await Api.postNews({ body: composer, commentsEnabled: commentsOn }).catch(() => undefined);
    setComposer(""); setCommentsOn(false);
    load();
  };

  if (data === null) return <SkeletonList />;

  return (
    <main style={{ paddingBottom: 96 }}>
      <h1 className="screen-title">News</h1>
      <div className="micro" style={{ padding: "0 16px 16px" }}>Official bulletins from the school and the alumni admins</div>

      {signedIn && (
        <div style={{ padding: "0 16px 16px", borderBottom: "1px solid var(--c-hairline)" }}>
          <textarea
            value={composer} onChange={(e) => setComposer(e.target.value)} placeholder="Write a bulletin…" aria-label="News composer"
            style={{ width: "100%", minHeight: 56, border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "15px var(--font-ui)", color: "var(--c-base-contrast)", resize: "vertical" }}
          />
          <label style={{ font: "13px var(--font-ui)", display: "block", margin: "8px 0" }}>
            <input type="checkbox" checked={commentsOn} onChange={(e) => setCommentsOn(e.target.checked)} /> Allow comments on this post
          </label>
          <button type="button" className="btn btn--filled press" onClick={() => void post()}>Post bulletin</button>
        </div>
      )}

      {data.items.length === 0 && <Empty title="No bulletins yet" body="Official news appears here and in your feed." />}

      {data.items.map((n) => (
        <NewsRow key={n.id} item={n} mySetGroup={data.mySetGroup} onNavigate={onNavigate} reload={load} />
      ))}
    </main>
  );
}

function NewsRow({ item, mySetGroup, onNavigate, reload }: {
  item: NewsItem; mySetGroup: { id: string; name: string } | null; onNavigate: (to: string) => void; reload: () => void;
}): React.ReactElement {
  const [comments, setComments] = useState<Array<{ id: string; body: string; author: string }> | null>(null);
  const [draft, setDraft] = useState("");

  const react = async (emoji: string): Promise<void> => {
    await Api.react(item.id, emoji).catch(() => undefined);
    reload();
  };
  const loadComments = (): void => { Api.comments(item.id).then((r) => setComments(r.comments)).catch(() => undefined); };
  const comment = async (): Promise<void> => {
    if (draft.trim().length === 0) return;
    await Api.addComment(item.id, draft).catch(() => undefined);
    setDraft(""); loadComments();
  };

  return (
    <article style={{ borderBottom: "1px solid var(--c-hairline)", padding: 16 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
        <span style={{ font: "600 13px var(--font-ui)" }}>{item.author ?? "Admin"}</span>
        <span className="micro tabular">{new Date(item.createdAt).toLocaleDateString()}</span>
        {item.promotedFrom !== null && (
          <button type="button" className="btn btn--underline-link press" style={{ minHeight: 28 }} onClick={() => onNavigate(`/groups/${item.promotedFrom?.id ?? ""}`)}>
            From {item.promotedFrom.name}
          </button>
        )}
      </div>
      <p style={{ font: "15px var(--font-ui)", margin: "8px 0" }}>{item.body}</p>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {(["thumb", "heart", "laugh", "wow", "sad"] as const).map((e) => (
          <button key={e} type="button" className="press" onClick={() => void react(e)} aria-label={`React ${e}`}
            style={{ minHeight: 36, padding: "0 10px", cursor: "pointer", font: "13px var(--font-ui)", border: "1px solid var(--c-hairline)", background: item.myReaction === e ? "var(--c-neutral-100)" : "var(--c-base)", color: "var(--c-base-contrast)" }}>
            {e}{item.reactions[e] !== undefined ? ` ${item.reactions[e]}` : ""}
          </button>
        ))}
      </div>
      {item.commentsEnabled ? (
        <div style={{ marginTop: 8 }}>
          <button type="button" className="btn btn--underline-link press" onClick={loadComments}>Comments</button>
          {comments !== null && comments.map((c) => (
            <div key={c.id} style={{ font: "13px var(--font-ui)", padding: "4px 0" }}><b>{c.author}</b> {c.body}</div>
          ))}
          <div style={{ display: "flex", gap: 8 }}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Comment" placeholder="Add a comment…"
              style={{ flex: 1, minHeight: 40, border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "14px var(--font-ui)", color: "var(--c-base-contrast)" }} />
            <button type="button" className="btn btn--filled press" style={{ minHeight: 40 }} onClick={() => void comment()}>Send</button>
          </div>
        </div>
      ) : (
        // Comments off (default): reactions stay, discussion moves to the set group (§2).
        mySetGroup !== null && (
          <button type="button" className="btn btn--underline-link press" onClick={() => onNavigate(`/groups/${mySetGroup.id}`)}>
            Discuss this in your set group
          </button>
        )
      )}
    </article>
  );
}

/* ------------------------------ Feed v1 ------------------------------ */

export function FeedScreen({ onNavigate }: { onNavigate: (to: string) => void }): React.ReactElement {
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [meltDismissed, setMeltDismissed] = useState(false);

  const load = (): void => { Api.feed().then(setFeed).catch(() => undefined); };
  useEffect(load, []);

  // Melt-into-group (§4.2): three consecutive items from one group morph the
  // header into that group's space. Guardrails: groups only, never News.
  const meltTargetRaw = useMemo(() => {
    if (feed === null) return null;
    const items = feed.items.filter((i) => i.groupId !== null) as Array<FeedItem & { groupId: string; groupName: string }>;
    for (let i = 0; i + 2 < items.length; i++) {
      if (items[i]!.groupId === items[i + 1]!.groupId && items[i]!.groupId === items[i + 2]!.groupId) {
        return { groupId: items[i]!.groupId, groupName: items[i]!.groupName };
      }
    }
    return null;
  }, [feed]);
  const meltTarget = meltDismissed ? null : meltTargetRaw;

  if (feed === null) return <SkeletonList />;

  return (
    <main style={{ paddingBottom: 96 }}>
      <header style={{ borderBottom: "1px solid var(--c-hairline)" }}>
        <h1 className="screen-title">{meltTarget !== null ? meltTarget.groupName : "My Feed"}</h1>
        {meltTarget !== null ? (
          // The signature pill (F5): the feed slid into Set '98's activity.
          <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "0 16px 12px" }}>
            <span className="micro" style={{ color: "var(--c-accent)" }}>
              You are browsing {meltTarget.groupName}'s activity
            </span>
            <button type="button" className="btn btn--filled press" style={{ minHeight: 36 }} onClick={() => onNavigate(`/groups/${meltTarget.groupId}`)}>Open group</button>
            <button type="button" className="btn btn--underline-link press" onClick={() => setMeltDismissed(true)}>Back to My Feed</button>
          </div>
        ) : (
          <div className="micro" style={{ padding: "0 16px 12px" }}>Your groups first, then school-wide. Every card names its source.</div>
        )}
      </header>

      {feed.rails.map((rail) => (
        <section key={rail.key} style={{ borderBottom: "1px solid var(--c-hairline)", padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div className="micro">{rail.title}</div>
            <button type="button" className="btn btn--underline-link press" style={{ minHeight: 28 }} onClick={() => void Api.dismissRail(rail.key).then(load)}>
              Dismiss
            </button>
          </div>
          {rail.items.map((raw) => {
            const item = raw as Record<string, unknown>;
            if (rail.key === "classmates") {
              return (
                <button key={String(item.id)} type="button" className="row press" style={{ cursor: "pointer" }} onClick={() => onNavigate(`/members/${String(item.id)}`)}>
                  <span style={{ flex: 1, textAlign: "left" }}>
                    <span style={{ font: "500 14px var(--font-ui)", color: "var(--c-base-contrast)" }}>{String(item.name)}</span>
                    <span className="micro tabular">{item.setYear !== null && item.setYear !== undefined ? `Set '${String(Number(item.setYear)).slice(-2)}` : "Classmate"}</span>
                  </span>
                  <span className="micro" style={{ color: "var(--c-accent)" }}>Say hello</span>
                </button>
              );
            }
            if (rail.key === "countdowns") {
              const startsAt = new Date(String(item.startsAt));
              const days = Math.ceil((startsAt.getTime() - Date.now()) / 86_400_000);
              return (
                <div key={String(item.id)} className="row" style={{ padding: "8px 0" }}>
                  <span style={{ flex: 1, font: "14px var(--font-ui)" }}>
                    {String(item.title)} <span className="micro">{String(item.groupName ?? "")}</span>
                  </span>
                  <span className="tabular" style={{ font: "700 17px var(--font-ui)", color: "var(--c-accent)" }}>{days}d</span>
                </div>
              );
            }
            return (
              <button key={String(item.id)} type="button" className="row press" style={{ cursor: "pointer" }} onClick={() => onNavigate(`/groups/${String(item.id)}`)}>
                <span style={{ flex: 1, textAlign: "left", font: "14px var(--font-ui)" }}>
                  {String(item.name)}
                  <span className="micro tabular">{String(item.postsThisWeek)} posts this week · {String(item.memberCount)} members</span>
                </span>
              </button>
            );
          })}
        </section>
      ))}

      {feed.items.length === 0 && <Empty title="Nothing here yet" body="Join groups and the activity lands in this feed." />}

      {feed.items.map((item) => (
        <article key={`${item.kind}:${item.id}`} style={{ borderBottom: "1px solid var(--c-hairline)", padding: 16 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
            {item.groupId !== null ? (
              <button type="button" className="press" onClick={() => onNavigate(`/groups/${item.groupId}`)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
                <span aria-hidden="true" style={{ width: 20, height: 20, background: "var(--c-accent)", color: "var(--c-accent-contrast)", display: "inline-flex", alignItems: "center", justifyContent: "center", font: "700 11px var(--font-masthead)" }}>
                  {(item.groupName ?? "?").slice(0, 1)}
                </span>
                <span className="micro" style={{ color: "var(--c-accent)" }}>{item.groupName}</span>
              </button>
            ) : (
              <span className="micro" style={{ color: "var(--c-accent)" }}>News</span>
            )}
            <span className="micro tabular" style={{ marginLeft: "auto" }}>{new Date(item.createdAt).toLocaleDateString()}</span>
          </div>
          <p style={{ font: "15px var(--font-ui)", margin: "8px 0" }}>{item.body}</p>
          {item.author !== null && <div className="micro">by {item.author}</div>}
          {item.groupId !== null && (
            <>
              <button type="button" className="btn btn--underline-link press" style={{ minHeight: 28 }}
                onClick={() => { void Api.tuneGroup(item.groupId!, true).then(load); }}>
                More from this group
              </button>
              <button type="button" className="btn btn--underline-link press" style={{ minHeight: 28 }}
                onClick={() => { void Api.feedMute(item.groupId!, true).then(load); }}>
                Less from this group
              </button>
            </>
          )}
        </article>
      ))}
    </main>
  );
}
