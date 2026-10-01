/**
 * Groups home (2.1, spec §4.1): adaptive by density — "Find your people" for
 * new members, "My groups" rows with unseen-activity tags for established
 * ones. Pinned first, then latest unseen activity. Discovery never disappears.
 * Library components only (M2).
 */
import React, { useEffect, useState } from "react";
import { Api } from "../api.js";
import { Row, Button, Avatar, Badge, Empty, Skeleton, SectionHead } from "@fedites/ui";
import type { GroupsHome, GroupSummary } from "../phase2-types.js";

export function GroupsHomeScreen({ onNavigate }: { onNavigate: (to: string) => void }): React.ReactElement {
  const [home, setHome] = useState<GroupsHome | null>(null);
  const [browse, setBrowse] = useState<GroupSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Api.groupsHome().then((v) => setHome(v)).catch((e: Error) => setError(e.message));
    Api.browseGroups().then((r) => setBrowse(r.groups.filter((g) => g.enabled && !g.joined && (g.type === "interest" || g.type === "guild")))).catch(() => undefined);
  }, []);

  if (error !== null) return <Empty title="Could not load groups" body={error} />;
  if (home === null) return <Skeleton height="var(--lh-headline)" />;

  const established = home.myGroups.length > 0;

  return (
    <main className="screen-pad">
      <h1 className="screen-title">{established ? "My groups" : "Find your people"}</h1>
      {!established && (
        <p style={{ padding: "0 var(--density-pad-x) var(--space-4)", font: "var(--type-body) var(--font-ui)", color: "var(--c-neutral-500)" }}>
          Your set group and house join automatically once you are verified.
        </p>
      )}

      {established && home.myGroups.map((g) => (
        <Row key={g.id} as="button" onClick={() => onNavigate(`/groups/${g.id}`)} active={g.pinned}>
          <Avatar name={g.name} />
          <span className="row-main">
            <span style={{ font: "var(--weight-semibold) var(--type-body) var(--font-ui)", color: "var(--c-base-contrast)" }}>{g.name}</span>
            <span className="micro tabular">
              {g.unseen.chatUnread > 0 && `${g.unseen.chatUnread} new messages · `}
              {g.unseen.newPosts > 0 && `${g.unseen.newPosts} new posts · `}
              {g.unseen.newPhotos > 0 && `${g.unseen.newPhotos} new photos · `}
              {g.memberCount} members
            </span>
          </span>
        </Row>
      ))}

      <SectionHead label="Discover more" />

      {home.discovery.map((g) => (
        <Row key={g.id} as="button" onClick={() => onNavigate(`/groups/${g.id}`)}>
          <span className="row-main">
            <span style={{ font: "var(--weight-medium) var(--type-body) var(--font-ui)", color: "var(--c-base-contrast)" }}>{g.name}</span>
            <span className="micro tabular">
              {g.citySuggested ? "Near your city · " : ""}{g.postsThisWeek} posts this week · {g.memberCount} members
            </span>
          </span>
          <Badge variant="dot">View</Badge>
        </Row>
      ))}

      {browse !== null && browse
        .filter((g) => !home.discovery.some((d) => d.id === g.id))
        .slice(0, 3)
        .map((g) => (
        <Row key={g.id} as="button" onClick={() => onNavigate(`/groups/${g.id}`)}>
          <span className="row-main">
            <span style={{ font: "var(--weight-medium) var(--type-body) var(--font-ui)", color: "var(--c-base-contrast)" }}>{g.name}</span>
            <span className="micro tabular">{g.postsThisWeek} posts this week · {g.memberCount} members</span>
          </span>
        </Row>
      ))}

      <div style={{ padding: "var(--space-6) var(--density-pad-x)" }}>
        <Button kind="outlined" onClick={() => onNavigate("/groups/new")}>Propose a group</Button>
      </div>
    </main>
  );
}
