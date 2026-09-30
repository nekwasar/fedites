/**
 * Groups home (2.1, spec §4.1): adaptive by density — "Find your people" for
 * new members, "My groups" rows with unseen-activity tags for established
 * ones. Pinned first, then latest unseen activity. Discovery never disappears.
 */
import React, { useEffect, useState } from "react";
import { Api } from "../api.js";
import { Empty, SkeletonList } from "./InboxScreen.js";
import type { GroupsHome, GroupSummary } from "../phase2-types.js";

export function GroupsHomeScreen({ onNavigate }: { onNavigate: (to: string) => void }): React.ReactElement {
  const [home, setHome] = useState<GroupsHome | null>(null);
  const [browse, setBrowse] = useState<GroupSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Api.groupsHome().then(setHome).catch((e: Error) => setError(e.message));
    Api.browseGroups().then((r) => setBrowse(r.groups.filter((g) => g.enabled && !g.joined && (g.type === "interest" || g.type === "guild")))).catch(() => undefined);
  }, []);

  if (error !== null) return <Empty title="Could not load groups" body={error} />;
  if (home === null) return <SkeletonList />;

  const established = home.myGroups.length > 0;

  return (
    <main style={{ paddingBottom: 96 }}>
      <h1 className="screen-title">{established ? "My groups" : "Find your people"}</h1>
      {!established && (
        <p style={{ padding: "0 16px 16px", font: "15px var(--font-ui)", color: "var(--c-neutral-500)" }}>
          Your set group and house join automatically once you are verified.
        </p>
      )}

      {established && home.myGroups.map((g) => (
        <button key={g.id} type="button" className="row press" onClick={() => onNavigate(`/groups/${g.id}`)} style={{ cursor: "pointer" }}>
          <span aria-hidden="true" style={{ width: 40, height: 40, background: "var(--c-accent)", color: "var(--c-accent-contrast)", display: "flex", alignItems: "center", justifyContent: "center", font: "700 18px var(--font-masthead)", flexShrink: 0 }}>
            {g.name.slice(0, 1)}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", font: "600 15px var(--font-ui)", color: "var(--c-base-contrast)" }}>
              {g.pinned ? "Pinned · " : ""}{g.name}
            </span>
            <span className="micro tabular">
              {g.unseen.chatUnread > 0 && `${g.unseen.chatUnread} new messages · `}
              {g.unseen.newPosts > 0 && `${g.unseen.newPosts} new posts · `}
              {g.unseen.newPhotos > 0 && `${g.unseen.newPhotos} new photos · `}
              {g.memberCount} members
            </span>
          </span>
        </button>
      ))}

      <div style={{ padding: "24px 16px 8px" }} className="micro">Discover more</div>

      {home.discovery.map((g) => (
        <button key={g.id} type="button" className="row press" onClick={() => onNavigate(`/groups/${g.id}`)} style={{ cursor: "pointer" }}>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", font: "500 15px var(--font-ui)", color: "var(--c-base-contrast)" }}>{g.name}</span>
            <span className="micro tabular">
              {g.citySuggested ? "Near your city · " : ""}{g.postsThisWeek} posts this week · {g.memberCount} members
            </span>
          </span>
          <span className="micro" style={{ color: "var(--c-accent)" }}>View</span>
        </button>
      ))}

      {browse !== null && browse.slice(0, 3).map((g) => (
        <button key={g.id} type="button" className="row press" onClick={() => onNavigate(`/groups/${g.id}`)} style={{ cursor: "pointer" }}>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", font: "500 15px var(--font-ui)", color: "var(--c-base-contrast)" }}>{g.name}</span>
            <span className="micro tabular">{g.postsThisWeek} posts this week · {g.memberCount} members</span>
          </span>
        </button>
      ))}

      <div style={{ padding: "24px 16px" }}>
        <button type="button" className="btn btn--outlined press" onClick={() => onNavigate("/groups/new")}>Propose a group</button>
      </div>
    </main>
  );
}
