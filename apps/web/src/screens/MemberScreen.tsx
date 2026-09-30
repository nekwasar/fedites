/**
 * Member public profile (1.3) + logged contact reveal.
 * K1/K5: what is hidden is explained plainly; declining costs nothing.
 */
import React, { useEffect, useState } from "react";
import { Api } from "../api.js";
import { Empty, SkeletonList } from "./InboxScreen.js";
import type { MemberPublic } from "@fedites/config";

export function MemberScreen({ id }: { id: string }): React.ReactElement {
  const [member, setMember] = useState<MemberPublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contact, setContact] = useState<{ email: string; phone: string | null } | null>(null);

  useEffect(() => {
    Api.member(id).then(setMember).catch((e: Error) => setError(e.message));
  }, [id]);

  if (error !== null) return <Empty title="Member not found" body="The link may be wrong, or the profile is not available." />;
  if (member === null) return <SkeletonList />;

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
