/**
 * Member public profile (1.3) + logged contact reveal.
 * K1/K5: what is hidden is explained plainly; declining costs nothing.
 */
import React, { useEffect, useState } from "react";
import { Api } from "../api.js";
import { Empty } from "./InboxScreen.js";
import type { MemberPublic } from "@fedites/config";

export function MemberScreen({ id, ssrData }: { id: string; ssrData?: { member?: MemberPublic; badges?: { badges: Array<{ badge: string; title: string; awardedAt: string }> } } }): React.ReactElement {
  const [member, setMember] = useState<MemberPublic | null>(ssrData?.member ?? null);
  const [error, setError] = useState<string | null>(null);
  const [contact, setContact] = useState<{ email: string; phone: string | null } | null>(null);

  useEffect(() => {
    if (ssrData?.member === undefined) Api.member(id).then(setMember).catch((e: Error) => setError(e.message));
  }, [id]);

  if (error !== null) return <Empty title="Member not found" body="The link may be wrong, or the profile is not available." />;
  if (member === null) return <main className="screen-pad" />;

  const reveal = (): void => {
    void Api.revealContact(member.id).then(setContact).catch((e: Error) => setError(e.message));
  };

  return (
    <main style={{ paddingBottom: 96 }}>
      <h1 className="screen-title">{member.displayName}</h1>
      <div className="micro" style={{ padding: "0 16px 16px" }}>
        {member.verification}
        {member.setYear !== null ? ` · Set '${String(member.setYear).slice(-2)}` : ""}
        {member.house !== null ? ` · ${member.house}` : ""}
      </div>
      <section style={{ padding: "0 16px 24px" }}>
        {member.bio !== null && <p style={{ font: "15px var(--font-ui)" }}>{member.bio}</p>}
        {member.favoriteMemory !== null && (
          <p style={{ font: "15px var(--font-ui)", fontStyle: "italic" }}>{member.favoriteMemory}</p>
        )}
        <p style={{ font: "13px var(--font-ui)", color: "var(--c-neutral-500)" }}>
          {[member.profession, member.city, member.country].filter((x) => x !== null && x !== "").join(" · ")}
        </p>
      </section>
      <MemberBadges id={member.id} />

      <section style={{ padding: "0 16px 24px" }}>
        <div className="micro" style={{ paddingBottom: 8, borderBottom: "1px solid var(--c-hairline)", marginBottom: 12 }}>Contact</div>
        {member.contactVisible || contact !== null ? (
          <div className="tabular" style={{ font: "14px var(--font-ui)" }}>
            <div>{contact !== null ? contact.email : member.email}</div>
            {(contact !== null ? contact.phone : member.phone) !== null && <div>{contact !== null ? contact.phone : member.phone}</div>}
          </div>
        ) : (
          <>
            <p style={{ font: "13px var(--font-ui)", color: "var(--c-neutral-500)" }}>
              Contact details are private. Revealing them tells the member and is recorded in the audit log.
            </p>
            <button type="button" className="btn btn--outlined press" onClick={reveal}>Reveal contact details</button>
          </>
        )}
      </section>
    </main>
  );
}

function MemberBadges({ id }: { id: string }): React.ReactElement {
  const [badges, setBadges] = useState<Array<{ badge: string; title: string; awardedAt: string }> | null>(null);
  useEffect(() => {
    Api.memberRecognition(id).then((r) => setBadges(r.badges)).catch(() => setBadges([]));
  }, [id]);
  if (badges === null || badges.length === 0) return <span />;
  return (
    <section style={{ padding: "0 16px 24px" }}>
      <div className="micro" style={{ paddingBottom: 8, borderBottom: "1px solid var(--c-hairline)", marginBottom: 12 }}>Recognition</div>
      {badges.map((b) => (
        <div key={b.badge} className="row" style={{ padding: "8px 0" }}>
          <span style={{ flex: 1, font: "600 14px var(--font-ui)" }}>{b.title}</span>
          <span className="micro tabular">{new Date(b.awardedAt).toLocaleDateString()}</span>
        </div>
      ))}
    </section>
  );
}
