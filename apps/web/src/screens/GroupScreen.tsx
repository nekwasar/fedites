/**
 * Group space (2.1/2.2/2.6): profile, join per rules, Activity | Chat tabs on
 * mobile (G7 — true siblings), side-by-side on desktop (E3). Group admin
 * panel: pin, promote-to-News, remove content via reports, join requests.
 * Lifecycle: archived groups render read-only (N1).
 */
import React, { useEffect, useState } from "react";
import { Api } from "../api.js";
import { Empty, SkeletonList } from "./InboxScreen.js";
import type { GroupProfile, ActivityItem, ActivityFeed } from "../phase2-types.js";

export function GroupScreen({ groupId, onNavigate, signedIn, onOpenChat }: {
  groupId: string;
  onNavigate: (to: string) => void;
  signedIn: boolean;
  onOpenChat: (groupId: string) => void;
}): React.ReactElement {
  const [profile, setProfile] = useState<GroupProfile | null>(null);
  const [activity, setActivity] = useState<ActivityFeed | null>(null);
  const [tab, setTab] = useState<"activity" | "chat">("activity");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [requests, setRequests] = useState<Array<{ id: string; display_name: string }>>([]);
  const isDesktop = useIsDesktop();

  const load = (): void => {
    Api.group(groupId).then(setProfile).catch((e: Error) => setError(e.message));
    Api.groupActivity(groupId).then(setActivity).catch((e: Error) => setError(e.message));
    Api.joinRequests(groupId).then((r) => setRequests(r.requests)).catch(() => undefined);
  };
  useEffect(load, [groupId]);

  if (error !== null) return <Empty title="Group unavailable" body={error} />;
  if (profile === null || activity === null) return <SkeletonList />;

  const join = async (): Promise<void> => {
    try {
      const r = await Api.joinGroup(groupId);
      setNote(r.joined ? "Welcome in. Introduce yourself below." : r.requested ? "Request sent. A group admin will review it." : "");
      load();
    } catch (e) { setNote((e as Error).message); }
  };

  return (
    <main style={{ paddingBottom: 96 }}>
      <header style={{ padding: "0 16px 12px", borderBottom: "1px solid var(--c-hairline)" }}>
        <h1 className="screen-title" style={{ padding: 0 }}>{profile.name}</h1>
        <div className="micro tabular" style={{ paddingBottom: 8 }}>
          {profile.type} · {profile.memberCount} members{profile.status !== "active" ? ` · ${profile.status}` : ""}
        </div>
        {profile.description !== null && <p style={{ font: "15px var(--font-ui)", margin: "0 0 12px" }}>{profile.description}</p>}
        {profile.my.joined ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn--outlined press" onClick={() => onOpenChat(groupId)}>Open chat</button>
            <button type="button" className="btn btn--underline-link press" onClick={() => void Api.feedMute(groupId, !profile.my.feedMuted).then(load)}>
              {profile.my.feedMuted ? "Unmute in feed" : "Less from this group"}
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn--filled press" onClick={() => void join()} disabled={!signedIn}>
            {profile.type === "guild" ? "Request to join" : "Join group"}
          </button>
        )}
        {note !== null && <p style={{ font: "13px var(--font-ui)", color: "var(--c-accent)", margin: "8px 0 0" }}>{note}</p>}
      </header>

      {profile.my.isAdmin && requests.length > 0 && (
        <section style={{ padding: "16px" }}>
          <div className="micro" style={{ paddingBottom: 8, borderBottom: "1px solid var(--c-hairline)", marginBottom: 8 }}>Join requests</div>
          {requests.map((r) => (
            <div key={r.id} className="row" style={{ padding: "8px 0" }}>
              <span style={{ flex: 1, font: "15px var(--font-ui)" }}>{r.display_name}</span>
              <button type="button" className="btn btn--underline-link press" onClick={() => void Api.decideJoinRequest(groupId, r.id, "approve").then(load)}>Approve</button>
              <button type="button" className="btn btn--underline-link press" onClick={() => void Api.decideJoinRequest(groupId, r.id, "reject").then(load)}>Reject</button>
            </div>
          ))}
        </section>
      )}

      {profile.status === "archived" ? (
        <Empty title="This group is archived" body="Twenty years of set history stay readable here, forever (N1)." />
      ) : isDesktop ? (
        // Desktop restructures (E3): Activity and Chat side-by-side.
        <div style={{ display: "flex", alignItems: "stretch" }}>
          <section style={{ flex: 1, minWidth: 0 }}>
            <ActivityPane groupId={groupId} profile={profile} activity={activity} reload={load} onNavigate={onNavigate} />
          </section>
          <section style={{ flex: 1, minWidth: 0, borderLeft: "1px solid var(--c-hairline)" }}>
            <ChatPane groupId={groupId} onNavigate={onNavigate} />
          </section>
        </div>
      ) : (
        // Mobile: Activity | Chat tabs — true siblings (G7).
        <>
          <div style={{ display: "flex", borderBottom: "1px solid var(--c-hairline)" }}>
            {(["activity", "chat"] as const).map((t) => (
              <button key={t} type="button" className="press" onClick={() => setTab(t)} aria-current={tab === t}
                style={{ minHeight: 44, flex: 1, background: "transparent", border: "none", borderBottom: tab === t ? "2px solid var(--c-accent)" : "2px solid transparent", color: tab === t ? "var(--c-accent)" : "var(--c-neutral-600)", font: "600 13px var(--font-ui)", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {t}
              </button>
            ))}
          </div>
          {tab === "activity" && <ActivityPane groupId={groupId} profile={profile} activity={activity} reload={load} onNavigate={onNavigate} />}
          {tab === "chat" && <ChatPane groupId={groupId} onNavigate={onNavigate} />}
        </>
      )}
    </main>
  );
}


function ActivityPane({ groupId, profile, activity, reload, onNavigate }: {
  groupId: string; profile: GroupProfile; activity: ActivityFeed; reload: () => void; onNavigate: (to: string) => void;
}): React.ReactElement {
  const [composer, setComposer] = useState("");
  const [pollMode, setPollMode] = useState(false);
  const [options, setOptions] = useState(["", ""]);

  const send = async (): Promise<void> => {
    if (composer.trim().length === 0) return;
    await Api.postActivity(groupId, { kind: "post", body: composer }).catch(() => undefined);
    setComposer("");
    reload();
  };

  const createPoll = async (): Promise<void> => {
    const opts = options.map((o) => o.trim()).filter((o) => o.length > 0);
    if (opts.length < 2) return;
    await Api.createPoll(groupId, { options: opts, body: composer || undefined }).catch(() => undefined);
    setComposer(""); setOptions(["", ""]); setPollMode(false);
    reload();
  };

  return (
    <div>
      <div className="micro" style={{ padding: "16px 16px 8px", display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--c-hairline)" }}>
        <span>Activity</span>
        <span className="tabular">{activity.items.length} items</span>
      </div>

      {profile.my.joined && (
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--c-hairline)" }}>
          <textarea
            value={composer}
            onChange={(e) => setComposer(e.target.value)}
            placeholder={pollMode ? "Ask the group…" : "Share something with the group…"}
            aria-label="Write a post"
            style={{ width: "100%", minHeight: 56, border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "15px var(--font-ui)", color: "var(--c-base-contrast)", resize: "vertical" }}
          />
          {pollMode && options.map((o, i) => (
            <input
              key={i}
              value={o}
              onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder={`Option ${i + 1}`}
              aria-label={`Poll option ${i + 1}`}
              style={{ width: "100%", minHeight: 40, border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "14px var(--font-ui)", color: "var(--c-base-contrast)" }}
            />
          ))}
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button type="button" className="btn btn--filled press" onClick={() => void (pollMode ? createPoll() : send())}>
              {pollMode ? "Post poll" : "Post"}
            </button>
            <button type="button" className="btn btn--underline-link press" onClick={() => setPollMode((v) => !v)}>
              {pollMode ? "Write a post instead" : "Poll instead"}
            </button>
          </div>
        </div>
      )}

      {activity.items.length === 0 && (
        <Empty title="Nothing here yet" body="The first post starts the story of this group." />
      )}

      {activity.items.map((item) => (
        <ActivityRow key={item.id} item={item} groupId={groupId} isAdmin={profile.my.isAdmin} joined={profile.my.joined} reload={reload} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

function ActivityRow({ item, isAdmin, joined, reload, onNavigate }: {
  item: ActivityItem; groupId: string; isAdmin: boolean; joined: boolean; reload: () => void; onNavigate: (to: string) => void;
}): React.ReactElement {
  const [comments, setComments] = useState<Array<{ id: string; body: string; parentId: string | null; author: string; isMine: boolean }> | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");

  const react = async (emoji: string): Promise<void> => {
    await Api.react(item.id, emoji).catch(() => undefined);
    reload();
  };

  const loadComments = (): void => { Api.comments(item.id).then((r) => setComments(r.comments)).catch(() => undefined); };

  const sendComment = async (): Promise<void> => {
    if (draft.trim().length === 0) return;
    await Api.addComment(item.id, draft, replyTo ?? undefined).catch(() => undefined);
    setDraft(""); setReplyTo(null);
    loadComments();
  };

  const report = async (): Promise<void> => {
    await Api.report({ postId: item.id, reason }).catch(() => undefined);
    setReporting(false); setReason("");
  };

  const vote = async (optionId: string): Promise<void> => {
    await Api.votePoll(item.id, optionId).catch(() => undefined);
    reload();
  };

  return (
    <article style={{ borderBottom: "1px solid var(--c-hairline)", padding: "16px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ font: "600 13px var(--font-ui)", color: "var(--c-base-contrast)" }}>{item.author ?? "Admin"}</span>
        {item.pinnedAt !== null && <span className="micro" style={{ color: "var(--c-accent)" }}>Pinned</span>}
        <span className="micro tabular" style={{ marginLeft: "auto" }}>{new Date(item.createdAt).toLocaleDateString()}</span>
      </div>
      {item.body !== null && <p style={{ font: "15px var(--font-ui)", margin: "8px 0" }}>{item.body}</p>}
      {item.media.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {item.media.map((m) => (
            <img key={m.id} src={`/v1/media/${m.id}`} alt="Group media" style={{ width: 200, height: 133, objectFit: "cover", border: "1px solid var(--c-hairline)" }} />
          ))}
        </div>
      )}
      {item.poll !== null && (
        <div style={{ marginTop: 8 }}>
          {item.poll.options.map((o) => {
            const total = item.poll!.options.reduce((s, x) => s + x.votes, 0) || 1;
            return (
              <button key={o.id} type="button" className="row press" style={{ cursor: "pointer", display: "block", width: "100%" }} onClick={() => void vote(o.id)}>
                <span style={{ display: "flex", justifyContent: "space-between", font: "14px var(--font-ui)" }}>
                  <span>{o.label}</span>
                  <span className="tabular">{Math.round((o.votes / total) * 100)}% · {o.votes}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
      {item.promotedFrom !== null && item.kind === "news" && (
        <button type="button" className="btn btn--underline-link press" onClick={() => onNavigate(`/groups/${item.promotedFrom?.id ?? ""}`)}>
          From {item.promotedFrom.name}
        </button>
      )}

      {/* Reactions: emoji-counts within the group (K2). */}
      <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
        {(["thumb", "heart", "laugh", "wow", "sad"] as const).map((e) => (
          <button key={e} type="button" className="press" onClick={() => void react(e)}
            aria-label={`React ${e}`}
            style={{
              minHeight: 36, padding: "0 10px", cursor: "pointer", font: "13px var(--font-ui)",
              border: "1px solid var(--c-hairline)", background: item.myReaction === e ? "var(--c-neutral-100)" : "var(--c-base)",
              color: "var(--c-base-contrast)",
            }}>
            {e}{item.reactions[e] !== undefined ? ` ${item.reactions[e]}` : ""}
          </button>
        ))}
        <button type="button" className="btn btn--underline-link press" onClick={loadComments}>
          Comments{item.commentCount > 0 ? ` · ${item.commentCount}` : ""}
        </button>
        {joined && (
          <button type="button" className="btn btn--underline-link press" onClick={() => setReporting((v) => !v)}>Report</button>
        )}
        {isAdmin && (
          <>
            <button type="button" className="btn btn--underline-link press" onClick={() => void Api.pinPost(item.id).then(reload)}>
              {item.pinnedAt !== null ? "Unpin" : "Pin"}
            </button>
            {item.kind !== "news" && (
              <button type="button" className="btn btn--underline-link press" onClick={() => void Api.promoteToNews(item.id).then(() => onNavigate("/news"))}>
                Promote to News
              </button>
            )}
          </>
        )}
      </div>

      {reporting && (
        <div style={{ marginTop: 8 }}>
          <input
            value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are you reporting this?"
            aria-label="Report reason"
            style={{ width: "100%", minHeight: 40, border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "14px var(--font-ui)", color: "var(--c-base-contrast)" }}
          />
          <button type="button" className="btn btn--outlined press" onClick={() => void report()} disabled={reason.trim().length < 4}>Send report</button>
        </div>
      )}

      {comments !== null && (
        <div style={{ marginTop: 8, paddingLeft: 12, borderLeft: "2px solid var(--c-hairline)" }}>
          {comments.map((c) => (
            <div key={c.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--c-hairline)" }}>
              <span style={{ font: "13px var(--font-ui)" }}>
                <b>{c.author}</b> {c.body}
              </span>
              <button type="button" className="btn btn--underline-link press" style={{ minHeight: 28 }} onClick={() => setReplyTo(c.id)}>Reply</button>
            </div>
          ))}
          {joined && (
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input
                value={draft} onChange={(e) => setDraft(e.target.value)}
                placeholder={replyTo !== null ? "Reply to thread…" : "Add a comment…"}
                aria-label="Comment"
                style={{ flex: 1, minHeight: 40, border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "14px var(--font-ui)", color: "var(--c-base-contrast)" }}
              />
              <button type="button" className="btn btn--filled press" style={{ minHeight: 40 }} onClick={() => void sendComment()}>Send</button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

import { ChatPane } from "./ChatThread.js";

function useIsDesktop(): boolean {
  const [is, setIs] = useState(window.innerWidth >= 1024);
  useEffect(() => {
    const on = (): void => setIs(window.innerWidth >= 1024);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return is;
}
