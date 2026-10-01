/**
 * Profile + settings (1.3): profile builder, privacy controls, private
 * legacy family links, 2FA, invites. Digital ID lives on /id.
 */
import React, { useEffect, useRef, useState } from "react";
import { Api } from "../api.js";
import { Empty, SkeletonList } from "./InboxScreen.js";
import { AssociationSection } from "./Money.js";
import { GivingSection } from "./Giving.js";
import { StructuredGiving, PledgesSection, ReimbursementsSection, SponsorsSection, ScholarshipsSection } from "./Structured.js";
import type { FamilyLink, Invite, SessionMember, VerificationStatus } from "@fedites/config";
import type { RecognitionMe } from "../phase2-types.js";

const fieldStyle: React.CSSProperties = {
  width: "100%", minHeight: 44, padding: "0 12px", marginBottom: 12,
  border: "none", borderBottom: "1px solid var(--c-hairline)",
  background: "transparent", color: "var(--c-base-contrast)", font: "15px var(--font-ui)",
};

export function ProfileScreen({ member, onNavigate, dark, onDark }: { member: SessionMember; onNavigate: (to: string) => void; dark?: boolean; onDark?: (v: boolean) => void }): React.ReactElement {
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

      <AssociationSection />

      <Section label="Careers & networking">
        <p style={{ font: "15px var(--font-ui)", margin: "0 0 12px" }}>
          The job board (fresh graduates first), the alumni business directory, mentor office hours, referrals and endorsements.
        </p>
        <button type="button" className="btn btn--filled press" onClick={() => onNavigate("/careers")}>Open Careers</button>
      </Section>

      <Section label="The School Bridge">
        <p style={{ font: "15px var(--font-ui)", margin: "0 0 12px" }}>
          Wishlist, adopt-a-project, past questions bank, teacher tributes, facility booking, and records verification.
        </p>
        <button type="button" className="btn btn--filled press" onClick={() => onNavigate("/bridge")}>Open the School Bridge</button>
      </Section>

      <Section label="Nostalgia corner">
        <p style={{ font: "15px var(--font-ui)", margin: "0 0 12px" }}>
          Remember-when prompts, recipes, the radio, anthem and bell, time capsules, letters to your future self, birthdays, and awards.
        </p>
        <button type="button" className="btn btn--filled press" onClick={() => onNavigate("/nostalgia")}>Open the nostalgia corner</button>
      </Section>

      <Section label="School knowledge">
        <p style={{ font: "15px var(--font-ui)", margin: "0 0 12px" }}>
          The wiki, slang dictionary, history timeline, spotlights, and member articles.
        </p>
        <button type="button" className="btn btn--filled press" onClick={() => onNavigate("/knowledge")}>Open School knowledge</button>
      </Section>

      <Section label="Memory Lane">
        <p style={{ font: "15px var(--font-ui)", margin: "0 0 12px" }}>
          The archive, yearbooks, on-this-day, hall of fame, and memorials.
        </p>
        <button type="button" className="btn btn--filled press" onClick={() => onNavigate("/memory")}>Open Memory Lane</button>
      </Section>

      <GivingSection />

      <StructuredGiving />

      <PledgesSection />

      <ReimbursementsSection />

      <SponsorsSection />

      <ScholarshipsSection />

      <FaceSearch />

      <RecognitionSection />

      <IntentsSection />

      <Section label="Notifications">
        <NotifyPrefs />
        <p style={{ font: "13px var(--font-ui)", color: "var(--c-neutral-500)" }}>
          Quiet hours still silence everything (J4).
        </p>
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

      <Section label="Appearance">
        <label style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", font: "var(--type-body) var(--font-ui)" }}>
          <input type="checkbox" checked={dark === true} onChange={(e) => onDark?.(e.target.checked)} />
          Dark mode (designed for both, light-first)
        </label>
      </Section>

      <Section label="Session">
        <button type="button" className="btn btn--outlined press" onClick={() => void Api.logout().then(() => { window.location.href = "/auth"; })}>Sign out</button>
      </Section>
    </main>
  );
}

function RecognitionSection(): React.ReactElement {
  const [data, setData] = useState<{ points: number; badges: Array<{ badge: string; title: string; description: string; awardedAt: string; awardedBy: string | null }>; streak: { current: number; longest: number } } | null>(null);

  useEffect(() => { Api.myRecognition().then((v: RecognitionMe) => setData(v)).catch(() => undefined); }, []);

  return (
    <Section label="Recognition">
      {data === null ? <div className="skeleton" style={{ height: 16 }} /> : (
        <>
          <div style={{ display: "flex", gap: 24, marginBottom: 12 }}>
            <div>
              <div className="tabular" style={{ font: "700 28px var(--font-ui)", color: "var(--c-accent)" }}>{data.points}</div>
              <div className="micro">Activity points</div>
            </div>
            <div>
              <div className="tabular" style={{ font: "700 28px var(--font-ui)" }}>{data.streak.current}</div>
              <div className="micro">Week streak (yours only)</div>
            </div>
          </div>
          {data.badges.length === 0
            ? <p style={{ font: "15px var(--font-ui)", color: "var(--c-neutral-500)" }}>Badges land as you take part. No leagues, no shaming.</p>
            : data.badges.map((b) => (
              <div key={b.badge} className="row" style={{ padding: "8px 0" }}>
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", font: "600 15px var(--font-ui)", color: "var(--c-base-contrast)" }}>{b.title}</span>
                  <span className="micro">{b.description}</span>
                </span>
                <span className="micro tabular">{new Date(b.awardedAt).toLocaleDateString()}</span>
              </div>
            ))}
        </>
      )}
    </Section>
  );
}

function IntentsSection(): React.ReactElement {
  const OPTIONS: Array<{ key: string; label: string }> = [
    { key: "reconnect", label: "Reconnect" },
    { key: "network", label: "Network & jobs" },
    { key: "give-back", label: "Give back to school" },
    { key: "events", label: "Events & reunions" },
    { key: "business", label: "Grow my business" },
    { key: "mentor", label: "Mentor" },
  ];
  const [selected, setSelected] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { Api.getIntents().then((r) => setSelected(r.intents)).catch(() => setSelected([])); }, []);

  const toggle = (key: string): void => {
    if (selected === null) return;
    setSelected(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  };
  const save = async (): Promise<void> => {
    if (selected === null) return;
    await Api.setIntents(selected).catch(() => undefined);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Section label="What brings you here">
      <p style={{ font: "15px var(--font-ui)", margin: "0 0 12px" }}>
        This tunes your feed, suggestions, and Menu ranking. Explainable, editable anytime.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {OPTIONS.map((o) => {
          const on = selected?.includes(o.key) === true;
          return (
            <button key={o.key} type="button" className="press" onClick={() => toggle(o.key)} aria-pressed={on}
              style={{ minHeight: 44, padding: "0 12px", cursor: "pointer", border: "1px solid var(--c-hairline)", background: on ? "var(--c-accent)" : "var(--c-base)", color: on ? "var(--c-accent-contrast)" : "var(--c-base-contrast)", font: "13px var(--font-ui)" }}>
              {o.label}
            </button>
          );
        })}
      </div>
      <button type="button" className="btn btn--filled press" style={{ marginTop: 12 }} onClick={() => void save()}>{saved ? "Saved" : "Save"}</button>
    </Section>
  );
}

function NotifyPrefs(): React.ReactElement {
  const [prefs, setPrefs] = useState<{ mentions: string; events: string; news: string } | null>(null);
  useEffect(() => { Api.getNotifyPrefs().then((r) => setPrefs(r.prefs)).catch(() => undefined); }, []);
  const flip = (key: "mentions" | "events" | "news"): void => {
    if (prefs === null) return;
    const next = { ...prefs, [key]: prefs[key] === "on" ? "off" : "on" };
    setPrefs(next);
    void Api.setNotifyPrefs({ [key]: next[key] }).catch(() => undefined);
  };
  if (prefs === null) return <div className="skeleton" style={{ height: 16 }} />;
  return (
    <div>
      {(["mentions", "events", "news"] as const).map((k) => (
        <div key={k} className="row" style={{ padding: "8px 0" }}>
          <span style={{ flex: 1, font: "14px var(--font-ui)", textTransform: "capitalize" }}>{k}</span>
          <button type="button" className="press" onClick={() => flip(k)} aria-pressed={prefs[k] === "on"}
            style={{ minHeight: 36, padding: "0 12px", cursor: "pointer", border: "1px solid var(--c-hairline)", background: prefs[k] === "on" ? "var(--c-accent)" : "var(--c-base)", color: prefs[k] === "on" ? "var(--c-accent-contrast)" : "var(--c-base-contrast)", font: "13px var(--font-ui)" }}>
            {prefs[k]}
          </button>
        </div>
      ))}
    </div>
  );
}

function FaceSearch(): React.ReactElement {
  const [status, setStatus] = useState<{ optIn: boolean; enrolled: boolean } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = (): void => { Api.faceStatus().then(setStatus).catch(() => undefined); };
  useEffect(load, []);

  const toggle = async (): Promise<void> => {
    if (status === null) return;
    try {
      await Api.faceOptIn(!status.optIn);
      setNote(!status.optIn ? "Face search is on. Enroll a reference selfie to make photos of you findable — to you only." : "Face search is off. Your face index has been deleted.");
      load();
    } catch (e) { setNote((e as Error).message); }
  };

  const enroll = async (file: File): Promise<void> => {
    try {
      await Api.faceEnroll(file);
      setNote("Reference saved. Only you can search with it.");
      load();
    } catch (e) { setNote((e as Error).message); }
  };

  const wipe = async (): Promise<void> => {
    try {
      await Api.faceDelete();
      setNote("Face index deleted.");
      load();
    } catch (e) { setNote((e as Error).message); }
  };

  return (
    <Section label="Face search (AI photo finder)">
      <p style={{ font: "15px var(--font-ui)", margin: "0 0 12px" }}>
        Opt in to find photos of yourself on event walls. Self-only: searches run your reference and can never surface anyone else's data. Turning it off, or deleting below, removes your entire face index.
      </p>
      {status !== null && (
        <p className="micro">Opt-in: {status.optIn ? "on" : "off"} · reference: {status.enrolled ? "enrolled" : "none"}</p>
      )}
      {status !== null && !status.optIn && (
        <button type="button" className="btn btn--filled press" onClick={() => void toggle()}>Turn on face search</button>
      )}
      {status !== null && status.optIn && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f !== undefined) void enroll(f); }} />
          <button type="button" className="btn btn--outlined press" onClick={() => fileRef.current?.click()}>
            {status.enrolled ? "Re-enroll reference" : "Enroll reference selfie"}
          </button>
          <button type="button" className="btn btn--underline-link press" onClick={() => void wipe()}>Delete my face data</button>
          <button type="button" className="btn btn--underline-link press" onClick={() => void toggle()}>Turn off</button>
        </div>
      )}
      {note !== null && <p style={{ font: "13px var(--font-ui)", color: "var(--c-accent)", marginTop: 8 }}>{note}</p>}
    </Section>
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
