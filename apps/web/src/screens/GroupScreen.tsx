/**
 * Group space (2.1/2.2/2.6): profile, join per rules, Activity | Chat tabs on
 * mobile (G7 — true siblings), side-by-side on desktop (E3). Group admin
 * panel: pin, promote-to-News, remove content via reports, join requests.
 * Lifecycle: archived groups render read-only (N1). Library components only.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Api } from "../api.js";
import { Row, Button, Badge, Empty, Skeleton, SectionHead, Tabs } from "@fedites/ui";
import type { GroupProfile, ActivityItem, ActivityFeed } from "../phase2-types.js";

export function GroupScreen({ groupId, onNavigate, signedIn, onOpenChat }: {
  groupId: string;
  onNavigate: (to: string) => void;
  signedIn: boolean;
  onOpenChat: (groupId: string) => void;
}): React.ReactElement {
  const [profile, setProfile] = useState<GroupProfile | null>(null);
  const [activity, setActivity] = useState<ActivityFeed | null>(null);
  const [tab, setTab] = useState<string>("activity");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [requests, setRequests] = useState<Array<{ id: string; display_name: string }>>([]);

  const load = useCallback((): void => {
    Api.group(groupId).then((v) => setProfile(v)).catch((e: Error) => setError(e.message));
    Api.groupActivity(groupId).then((v) => setActivity(v)).catch((e: Error) => setError(e.message));
    Api.joinRequests(groupId).then((r) => setRequests(r.requests)).catch(() => undefined);
  }, [groupId]);
  useEffect(() => { load(); }, [load]);

  if (error !== null) return <Empty title="Group unavailable" body={error} />;
  if (profile === null || activity === null) return <Skeleton height="var(--lh-headline)" />;

  const join = async (): Promise<void> => {
    try {
      const r = await Api.joinGroup(groupId);
      setNote(r.joined ? "Welcome in. Introduce yourself below." : r.requested === true ? "Request sent. A group admin will review it." : "");
      load();
    } catch (e) { setNote((e as Error).message); }
  };

  const toggleMute = async (): Promise<void> => {
    await Api.feedMute(groupId, !profile.my.feedMuted).catch(() => undefined);
    load();
  };

  return (
    <main className="screen-pad">
      <header style={{ padding: "0 var(--density-pad-x) var(--space-3)", borderBottom: "var(--hairline) solid var(--hairline-color)" }}>
        <h1 className="screen-title" style={{ padding: "var(--space-4) 0 var(--space-1)" }}>{profile.name}</h1>
        <div className="micro tabular" style={{ paddingBottom: "var(--space-2)" }}>
          {profile.type} · {profile.memberCount} members{profile.status !== "active" ? ` · ${profile.status}` : ""}
        </div>
        {profile.description !== null && (
          <p style={{ font: "var(--type-body) var(--font-ui)", margin: "0 0 var(--space-3)" }}>{profile.description}</p>
        )}
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          {profile.my.joined ? (
            <>
              <Button kind="filled" small onClick={() => onOpenChat(groupId)}>Open chat</Button>
              <Button kind="outlined" small onClick={() => void toggleMute()}>
                {profile.my.feedMuted ? "Unmute in feed" : "Less from this group"}
              </Button>
            </>
          ) : (
            <Button kind="filled" onClick={() => void join()} disabled={!signedIn}>
              {profile.type === "guild" ? "Request to join" : "Join group"}
            </Button>
          )}
        </div>
        {note !== null && <p className="micro" style={{ color: "var(--c-accent)", margin: "var(--space-2) 0 0" }}>{note}</p>}
      </header>

      {profile.my.isAdmin && requests.length > 0 && (
        <section>
          <SectionHead label="Join requests" />
          {requests.map((r) => (
            <Row key={r.id}>
              <span style={{ flex: 1, font: "var(--type-body) var(--font-ui)" }}>{r.display_name}</span>
              <Button kind="underline-link" small onClick={() => void Api.decideJoinRequest(groupId, r.id, "approve").then(load)}>Approve</Button>
              <Button kind="underline-link" small onClick={() => void Api.decideJoinRequest(groupId, r.id, "reject").then(load)}>Reject</Button>
            </Row>
          ))}
        </section>
      )}

      {profile.status === "archived" ? (
        <Empty title="This group is archived" body="Twenty years of set history stay readable here, forever." />
      ) : isDesktop() ? (
        <div className="pane-row">
          <section className="pane">
            <ActivityPane groupId={groupId} profile={profile} activity={activity} reload={load} onNavigate={onNavigate} />
          </section>
          <section className="pane">
            <ChatPane groupId={groupId} onNavigate={onNavigate} />
          </section>
        </div>
      ) : (
        <>
          <Tabs tabs={[{ key: "activity", label: "Activity" }, { key: "chat", label: "Chat" }]} value={tab} onChange={setTab} grow />
          {tab === "activity" && <ActivityPane groupId={groupId} profile={profile} activity={activity} reload={load} onNavigate={onNavigate} />}
          {tab === "chat" && <ChatPane groupId={groupId} onNavigate={onNavigate} />}
        </>
      )}
    </main>
  );
}

function isDesktop(): boolean {
  return window.innerWidth >= 1024;
}

/** The chat thread embedded in the group space (desktop side-by-side, E3). */
function ChatPane({ groupId, onNavigate }: { groupId: string; onNavigate: (to: string) => void }): React.ReactElement {
  return <ChatThreadEmbedded type="group" id={groupId} onNavigate={onNavigate} />;
}

import { ChatThreadScreen } from "./ChatThread.js";
const ChatThreadEmbedded = ChatThreadScreen;

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
      <SectionHead label={`Activity · ${activity.items.length} items`} />

      {profile.my.joined && (
        <div style={{ padding: "var(--space-3) var(--density-pad-x)", borderBottom: "var(--hairline) solid var(--hairline-color)" }}>
          <textarea
            value={composer}
            onChange={(e) => setComposer(e.target.value)}
            placeholder={pollMode ? "Ask the group…" : "Share something with the group…"}
            aria-label="Write a post"
            style={{ width: "100%", minHeight: 56, border: "none", borderBottom: "var(--hairline) solid var(--hairline-color)", background: "transparent", font: "var(--type-body) var(--font-ui)", color: "var(--c-base-contrast)", resize: "vertical" }}
          />
          {pollMode && options.map((o, i) => (
            <input
              key={i}
              value={o}
              onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder={`Option ${i + 1}`}
              aria-label={`Poll option ${i + 1}`}
              style={{ width: "100%", minHeight: 40, border: "none", borderBottom: "var(--hairline) solid var(--hairline-color)", background: "transparent", font: "var(--type-body2) var(--font-ui)", color: "var(--c-base-contrast)" }}
            />
          ))}
          <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-2)" }}>
            <Button kind="filled" small onClick={() => void (pollMode ? createPoll() : send())}>
              {pollMode ? "Post poll" : "Post"}
            </Button>
            <Button kind="underline-link" small onClick={() => setPollMode((v) => !v)}>
              {pollMode ? "Write a post instead" : "Poll instead"}
            </Button>
          </div>
        </div>
      )}

      {activity.items.length === 0 && (
        <Empty title="Nothing here yet" body="The first post starts the story of this group." />
      )}

      {activity.items.map((item) => (
        <ActivityRow key={item.id} item={item} isAdmin={profile.my.isAdmin} joined={profile.my.joined} reload={reload} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

function ActivityRow({ item, isAdmin, joined, reload, onNavigate }: {
  item: ActivityItem; isAdmin: boolean; joined: boolean; reload: () => void; onNavigate: (to: string) => void;
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
    <article style={{ borderBottom: "var(--hairline) solid var(--hairline-color)", padding: "var(--space-4) var(--density-pad-x)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)" }}>
        <span style={{ font: "var(--weight-semibold) var(--type-body2) var(--font-ui)", color: "var(--c-base-contrast)" }}>{item.author ?? "Admin"}</span>
        {item.pinnedAt !== null && <Badge variant="solid">Pinned</Badge>}
        <span className="micro tabular" style={{ marginLeft: "auto" }}>{new Date(item.createdAt).toLocaleDateString()}</span>
      </div>
      {item.body !== null && <p style={{ font: "var(--type-body) var(--font-ui)", margin: "var(--space-2) 0" }}>{item.body}</p>}
      {item.media.length > 0 && (
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          {item.media.map((m) => (
            <img key={m.id} src={`/v1/media/${m.id}`} alt="Group media" loading="lazy" style={{ width: 200, height: 133, objectFit: "cover", border: "var(--hairline) solid var(--hairline-color)" }} />
          ))}
        </div>
      )}
      {item.poll !== null && (
        <div style={{ marginTop: "var(--space-2)" }}>
          {item.poll.options.map((o) => {
            const total = item.poll!.options.reduce((s, x) => s + x.votes, 0) || 1;
            return (
              <Row key={o.id} as="button" onClick={() => void vote(o.id)}>
                <span style={{ display: "flex", justifyContent: "space-between", font: "var(--type-body2) var(--font-ui)", flex: 1 }}>
                  <span>{o.label}</span>
                  <span className="tabular">{Math.round((o.votes / total) * 100)}% · {o.votes}</span>
                </span>
              </Row>
            );
          })}
        </div>
      )}
      {item.promotedFrom !== null && item.kind === "news" && (
        <Button kind="underline-link" small onClick={() => onNavigate(`/groups/${item.promotedFrom?.id ?? ""}`)}>
          From {item.promotedFrom.name}
        </Button>
      )}

      <div style={{ display: "flex", gap: "var(--space-1)", marginTop: "var(--space-2)", flexWrap: "wrap", alignItems: "center" }}>
        {(["thumb", "heart", "laugh", "wow", "sad"] as const).map((e) => (
          <button key={e} type="button" className="press" onClick={() => void react(e)}
            aria-label={`React ${e}`}
            style={{
              minHeight: 36, padding: "0 var(--space-3)", cursor: "pointer", font: "var(--type-body2) var(--font-ui)",
              border: "var(--hairline) solid var(--hairline-color)", background: item.myReaction === e ? "var(--c-neutral-100)" : "var(--c-base)",
              color: "var(--c-base-contrast)",
            }}>
            {e}{item.reactions[e] !== undefined ? ` ${item.reactions[e]}` : ""}
          </button>
        ))}
        <Button kind="underline-link" small onClick={loadComments}>
          Comments{item.commentCount > 0 ? ` · ${item.commentCount}` : ""}
        </Button>
        {joined && (
          <Button kind="underline-link" small onClick={() => setReporting((v) => !v)}>Report</Button>
        )}
        {isAdmin && (
          <>
            <Button kind="underline-link" small onClick={() => void Api.pinPost(item.id).then(reload)}>
              {item.pinnedAt !== null ? "Unpin" : "Pin"}
            </Button>
            {item.kind !== "news" && (
              <Button kind="underline-link" small onClick={() => void Api.promoteToNews(item.id).then(() => onNavigate("/news"))}>
                Promote to News
              </Button>
            )}
          </>
        )}
      </div>

      {reporting && (
        <div style={{ marginTop: "var(--space-2)" }}>
          <input
            value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are you reporting this?"
            aria-label="Report reason"
            style={{ width: "100%", minHeight: 40, border: "none", borderBottom: "var(--hairline) solid var(--hairline-color)", background: "transparent", font: "var(--type-body2) var(--font-ui)", color: "var(--c-base-contrast)" }}
          />
          <Button kind="outlined" small onClick={() => void report()} disabled={reason.trim().length < 4}>Send report</Button>
        </div>
      )}

      {comments !== null && (
        <div style={{ marginTop: "var(--space-2)", paddingLeft: "var(--space-3)", borderLeft: "2px solid var(--hairline-color)" }}>
          {comments.map((c) => (
            <div key={c.id} style={{ padding: "var(--space-1) 0", borderBottom: "var(--hairline) solid var(--hairline-color)" }}>
              <span style={{ font: "var(--type-body2) var(--font-ui)" }}>
                <b>{c.author}</b> {c.body}
              </span>
              <Button kind="underline-link" small onClick={() => setReplyTo(c.id)}>Reply</Button>
            </div>
          ))}
          {joined && (
            <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
              <input
                value={draft} onChange={(e) => setDraft(e.target.value)}
                placeholder={replyTo !== null ? "Reply to thread…" : "Add a comment…"}
                aria-label="Comment"
                style={{ flex: 1, minHeight: 40, border: "none", borderBottom: "var(--hairline) solid var(--hairline-color)", background: "transparent", font: "var(--type-body2) var(--font-ui)", color: "var(--c-base-contrast)" }}
              />
              <Button kind="filled" small onClick={() => void sendComment()}>Send</Button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
