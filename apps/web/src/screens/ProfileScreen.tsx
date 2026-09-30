/**
 * Profile + settings (1.3): profile builder, privacy controls, private
 * legacy family links, 2FA, invites. Digital ID lives on /id.
 */
import React, { useEffect, useState } from "react";
import { Api } from "../api.js";
import { Empty, SkeletonList } from "./InboxScreen.js";
import type { FamilyLink, Invite, SessionMember, VerificationStatus } from "@fedites/config";

const fieldStyle: React.CSSProperties = {
  width: "100%", minHeight: 44, padding: "0 12px", marginBottom: 12,
  border: "none", borderBottom: "1px solid var(--c-hairline)",
  background: "transparent", color: "var(--c-base-contrast)", font: "15px var(--font-ui)",
};

export function ProfileScreen({ member, onNavigate }: { member: SessionMember; onNavigate: (to: string) => void }): React.ReactElement {
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [city, setCity] = useState("");
  const [profession, setProfession] = useState("");
  const [bio, setBio] = useState("");
  const [memory, setMemory] = useState("");
  const [saved, setSaved] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [invites, setInvites] = useState<Invite[] | null>(null);

  useEffect(() => {
    Api.verificationStatus().then(setStatus).catch(() => undefined);
    Api.invites().then((r) => setInvites(r.invites)).catch(() => undefined);
  }, []);

  const save = async (): Promise<void> => {
    await Api.updateProfile({
      city: city || undefined,
      profession: profession || undefined,
      bio: bio || undefined,
      favoriteMemory: memory || undefined,
    }).catch(() => undefined);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <main style={{ paddingBottom: 96 }}>
      <h1 className="screen-title">{member.displayName}</h1>
      <div className="micro" style={{ padding: "0 16px 16px" }}>
        {status ? `${status.verification} · ${status.vouchCount}/${status.vouchesRequired} setmate confirmations${status.setYear ? ` · Set '${String(status.setYear).slice(-2)}` : ""}` : member.verification}
      </div>

      <Section label="Profile">
        <input style={fieldStyle} placeholder="City" defaultValue={city} onChange={(e) => setCity(e.target.value)} aria-label="City" />
        <input style={fieldStyle} placeholder="Profession" defaultValue={profession} onChange={(e) => setProfession(e.target.value)} aria-label="Profession" />
        <input style={fieldStyle} placeholder="A favorite old school memory" defaultValue={memory} onChange={(e) => setMemory(e.target.value)} aria-label="Favorite memory" />
        <textarea style={{ ...fieldStyle, minHeight: 72, paddingTop: 12 }} placeholder="Short bio" defaultValue={bio} onChange={(e) => setBio(e.target.value)} aria-label="Bio" />
        <button type="button" className="btn btn--filled press" onClick={() => void save()}>{saved ? "Saved" : "Save profile"}</button>
      </Section>

      <Section label="Your alumni ID">
        <p style={{ font: "15px var(--font-ui)", margin: "0 0 12px" }}>A scannable proof of membership for events and check-ins.</p>
        <button type="button" className="btn btn--outlined press" onClick={() => onNavigate("/id")}>Open my ID card</button>
      </Section>

      <Section label="Privacy">
        <p style={{ font: "15px var(--font-ui)", margin: "0 0 12px" }}>
          Contact details and birthday are private by default. Revealing another member's contacts is a logged action on both sides.
        </p>
        <button type="button" className="btn btn--outlined press" onClick={() => onNavigate("/members/" + member.id)}>View my public profile</button>
      </Section>

      <FamilyLinks />

      <Section label="Two-factor authentication">
        <TwoFactor enabled={member.totpEnabled} />
      </Section>

      {member.verification === "verified" || member.verification === "honorary" ? (
        <Section label="Invite codes">
          <button
            type="button"
            className="btn btn--filled press"
            onClick={() => void Api.createInvite().then((r) => { setInviteCode(r.code); return Api.invites().then((x) => setInvites(x.invites)); })}
          >
            Create invite code
          </button>
          {inviteCode && (
            <p style={{ font: "16px var(--font-mono)", margin: "12px 0 0" }}>New code: {inviteCode}</p>
          )}
          {invites !== null && invites.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {invites.slice(0, 5).map((i) => (
                <div key={i.code} className="tabular" style={{ font: "13px var(--font-ui)", padding: "8px 0", borderBottom: "1px solid var(--c-hairline)" }}>
                  {i.code} {i.used_at ? "· used" : "· unused"}
                </div>
              ))}
            </div>
          )}
        </Section>
      ) : null}

      <Section label="Session">
        <button type="button" className="btn btn--outlined press" onClick={() => void Api.logout().then(() => { window.location.href = "/auth"; })}>Sign out</button>
      </Section>
    </main>
  );
}

function FamilyLinks(): React.ReactElement {
  const [links, setLinks] = useState<FamilyLink[] | null>(null);
  const [email, setEmail] = useState("");
  const [relation, setRelation] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = (): void => { Api.familyLinks().then((r) => setLinks(r.links)).catch(() => undefined); };
  useEffect(load, []);

  return (
    <Section label="Legacy family links (private)">
      <p style={{ font: "15px var(--font-ui)", margin: "0 0 12px" }}>
        Connect relatives who attended the school. Only you can see these links.
      </p>
      {links === null ? <div className="skeleton" style={{ height: 16 }} /> : (
        links.length === 0
          ? <p style={{ font: "13px var(--font-ui)", color: "var(--c-neutral-500)" }}>No family links yet.</p>
          : links.map((l) => (
            <div key={l.id} className="row" style={{ padding: "8px 0" }}>
              <span style={{ flex: 1, font: "15px var(--font-ui)" }}>{l.name} <span className="micro">{l.relation}</span></span>
              <button type="button" className="btn btn--underline-link press" onClick={() => void Api.removeFamilyLink(l.id).then(load)}>Remove</button>
            </div>
          ))
      )}
      <input style={fieldStyle} placeholder="Relative's email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Relative's email" />
      <input style={fieldStyle} placeholder="Relation, e.g. younger brother" value={relation} onChange={(e) => setRelation(e.target.value)} aria-label="Relation" />
      {error && <p style={{ color: "var(--c-danger)", font: "13px var(--font-ui)" }}>{error}</p>}
      <button
        type="button"
        className="btn btn--outlined press"
        onClick={() => {
          setError(null);
          void Api.addFamilyLink(email, relation).then(() => { setEmail(""); setRelation(""); load(); }).catch((e: Error) => setError(e.message));
        }}
      >
        Link relative
      </button>
    </Section>
  );
}

function TwoFactor({ enabled }: { enabled: boolean }): React.ReactElement {
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const start = (): void => {
    Api.totpSetup().then(setSetup).catch((e: Error) => setMessage(e.message));
  };
  const enable = (): void => {
    void Api.totpEnable(code).then(() => { setMessage("2FA is on. Sign-in will now ask for a code."); setSetup(null); }).catch((e: Error) => setMessage(e.message));
  };
  const disable = (): void => {
    void Api.totpDisable(code).then(() => { setMessage("2FA is off."); setCode(""); }).catch((e: Error) => setMessage(e.message));
  };

  return (
    <div>
      <p style={{ font: "15px var(--font-ui)", margin: "0 0 12px" }}>
        {enabled ? "2FA is currently on for this account." : "Add a second step to protect your account."}
      </p>
      {!enabled && setup === null && <button type="button" className="btn btn--filled press" onClick={start}>Start 2FA setup</button>}
      {setup !== null && (
        <>
          <p className="tabular" style={{ font: "14px var(--font-mono)", wordBreak: "break-all" }}>{setup.secret}</p>
          <p style={{ font: "13px var(--font-ui)", color: "var(--c-neutral-500)" }}>Add this secret to your authenticator app, then enter the current code.</p>
          <input style={fieldStyle} inputMode="numeric" placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Authentication code" />
          <button type="button" className="btn btn--filled press" onClick={enable}>Turn on 2FA</button>
        </>
      )}
      {enabled && (
        <>
          <input style={fieldStyle} inputMode="numeric" placeholder="6-digit code to turn off" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Authentication code" />
          <button type="button" className="btn btn--outlined press" onClick={disable}>Turn off 2FA</button>
        </>
      )}
      {message && <p style={{ font: "13px var(--font-ui)", marginTop: 8 }}>{message}</p>}
    </div>
  );
}

export function Section({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <section style={{ padding: "0 16px 24px" }}>
      <div className="micro" style={{ paddingBottom: 8, borderBottom: "1px solid var(--c-hairline)", marginBottom: 12 }}>{label}</div>
      {children}
    </section>
  );
}

export { Empty, SkeletonList };
