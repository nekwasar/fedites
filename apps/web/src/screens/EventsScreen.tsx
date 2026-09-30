/**
 * Events (Phase 3, 3.1 + 3.2): unified calendar with countdowns and group
 * badges (§4.5), RSVP (optimistic, L6), my QR ticket sheet (E10), organizer
 * reunion suite (tasks, budget, RSVPs, door mode, QR scanning).
 */
import React, { useEffect, useRef, useState } from "react";
import { Api } from "../api.js";
import { Empty, SkeletonList } from "./InboxScreen.js";
import { Section } from "./ProfileScreen.js";
import type { EventListItem, Ticket, EventTask, BudgetItem } from "../events-types.js";

export function EventsScreen({ onNavigate, isAdmin }: { onNavigate: (to: string) => void; isAdmin: boolean }): React.ReactElement {
  const [data, setData] = useState<{ upcoming: EventListItem[]; past: EventListItem[] } | null>(null);
  const [mine, setMine] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [city, setCity] = useState("");
  const [groupId, setGroupId] = useState("");
  const [groups, setGroups] = useState<Array<{ id: string; name: string; canCreate: boolean }>>([]);
  const [error, setError] = useState<string | null>(null);

  const load = (): void => {
    Api.eventsList().then((d: { upcoming: EventListItem[]; past: EventListItem[] }) => setData(d)).catch((e: Error) => setError(e.message));
  };
  useEffect(load, []);

  const openCreate = (): void => {
    setCreating(true);
    Api.browseGroups().then((gr) => {
      const profPromises = gr.groups.filter((g) => g.joined).map((g) => Api.group(g.id).then((p) => ({ id: g.id, name: g.name, canCreate: p.my.isAdmin })));
      void Promise.all(profPromises).then((v) => setGroups(v));
    }).catch(() => undefined);
  };

  const create = async (): Promise<void> => {
    if (title.trim().length < 2 || when === "") return;
    try {
      await Api.createEvent({
        title,
        startsAt: new Date(when).toISOString(),
        city: city || undefined,
        groupId: groupId || undefined,
      });
      setCreating(false); setTitle(""); setWhen(""); setCity(""); setGroupId("");
      load();
    } catch (e) { setError((e as Error).message); }
  };

  if (error !== null) return <Empty title="Could not load events" body={error} />;
  if (data === null) return <SkeletonList />;

  const list = (mine ? data.upcoming.filter((e) => e.myResponse !== null) : data.upcoming);

  return (
    <main style={{ paddingBottom: 96 }}>
      <h1 className="screen-title">Events</h1>
      <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "0 16px 8px" }}>
        <button type="button" className="btn btn--underline-link press" onClick={() => setMine((v) => !v)}>
          {mine ? "Show all" : "My events"}
        </button>
        {(isAdmin || groups.some((g) => g.canCreate)) && (
          <button type="button" className="btn btn--filled press" onClick={openCreate}>Create event</button>
        )}
      </div>

      {creating && (
        <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--c-hairline)" }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" aria-label="Event title"
            style={{ width: "100%", minHeight: 44, border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "15px var(--font-ui)", color: "var(--c-base-contrast)" }} />
          <input value={when} onChange={(e) => setWhen(e.target.value)} type="datetime-local" aria-label="Starts at"
            style={{ width: "100%", minHeight: 44, border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "15px var(--font-ui)", color: "var(--c-base-contrast)" }} />
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" aria-label="City"
            style={{ width: "100%", minHeight: 44, border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "15px var(--font-ui)", color: "var(--c-base-contrast)" }} />
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)} aria-label="Group"
            style={{ width: "100%", minHeight: 44, border: "none", borderBottom: "1px solid var(--c-hairline)", background: "var(--c-base)", font: "15px var(--font-ui)", color: "var(--c-base-contrast)" }}>
            <option value="">No group (school-wide)</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <button type="button" className="btn btn--filled press" onClick={() => void create()} disabled={title.trim().length < 2 || when === ""}>Create</button>
        </div>
      )}

      {list.length === 0 && <Empty title="No events scheduled" body="Reunions and meetups appear here with their countdowns." />}

      {list.map((e) => {
        const days = Math.ceil((new Date(e.startsAt).getTime() - Date.now()) / 86_400_000);
        return (
          <button key={e.id} type="button" className="row press" style={{ cursor: "pointer" }} onClick={() => onNavigate(`/events/${e.id}`)}>
            <span aria-hidden="true" style={{ width: 48, textAlign: "center", flexShrink: 0 }}>
              <span style={{ display: "block", font: "700 17px var(--font-ui)", color: "var(--c-accent)" }}>{new Date(e.startsAt).getDate()}</span>
              <span className="micro">{new Date(e.startsAt).toLocaleString([], { month: "short" })}</span>
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", font: "600 15px var(--font-ui)", color: "var(--c-base-contrast)" }}>
                {e.title}{e.anniversary ? " · anniversary" : ""}
              </span>
              <span className="micro tabular">
                {e.groupName !== null ? `${e.groupName} · ` : ""}{e.venue ?? e.city ?? ""}
                {e.myResponse !== null ? ` · you: ${e.myResponse}` : ""}
              </span>
            </span>
            {days > 0 && days < 90 && (
              <span className="tabular" style={{ font: "700 17px var(--font-ui)", color: "var(--c-accent)", flexShrink: 0 }}>{days}d</span>
            )}
          </button>
        );
      })}

      {data.past.length > 0 && <div className="micro" style={{ padding: "16px 16px 8px" }}>Past</div>}
      {data.past.slice(0, 10).map((e) => (
        <button key={e.id} type="button" className="row press" style={{ cursor: "pointer", opacity: 0.75 }} onClick={() => onNavigate(`/events/${e.id}`)}>
          <span style={{ flex: 1, textAlign: "left" }}>
            <span style={{ display: "block", font: "500 15px var(--font-ui)", color: "var(--c-base-contrast)" }}>{e.title}</span>
            <span className="micro tabular">{new Date(e.startsAt).toLocaleDateString()}{e.groupName !== null ? ` · ${e.groupName}` : ""}</span>
          </span>
        </button>
      ))}
    </main>
  );
}

export function EventDetailScreen({ eventId, onNavigate, member }: {
  eventId: string; onNavigate: (to: string) => void; member: { id: string; roles: string[]; verification: string } | null;
}): React.ReactElement {
  const [event, setEvent] = useState<EventListItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [busy, setBusy] = useState(false);

  const load = (): void => {
    Api.eventDetail(eventId).then((v: EventListItem) => setEvent(v)).catch((e: Error) => setError(e.message));
  };
  useEffect(load, [eventId]);

  if (error !== null) return <Empty title="Event unavailable" body={error} />;
  if (event === null) return <SkeletonList />;

  const rsvp = async (response: "going" | "maybe" | "no"): Promise<void> => {
    if (member === null) { onNavigate("/auth"); return; }
    // Optimistic (L6): flip instantly, reconcile from the server response.
    setEvent((e) => (e !== null ? { ...e, myResponse: response, goingCount: e.goingCount + (response === "going" && e.myResponse !== "going" ? 1 : response !== "going" && e.myResponse === "going" ? -1 : 0) } : e));
    setBusy(true);
    try {
      const r = await Api.rsvp(eventId, response);
      setEvent((e) => (e !== null ? { ...e, goingCount: r.counts.going } : e));
      if (response === "going") await openTicket();
    } catch (e2) {
      setError((e2 as Error).message);
      load();
    } finally { setBusy(false); }
  };

  const openTicket = async (): Promise<void> => {
    try { setTicket(await Api.myTicket(eventId)); } catch { setTicket(null); }
  };

  const days = Math.ceil((new Date(event.startsAt).getTime() - Date.now()) / 86_400_000);
  const verified = member !== null && (member.verification === "verified" || member.verification === "honorary");

  return (
    <main style={{ paddingBottom: 96 }}>
      <h1 className="screen-title">{event.title}{event.anniversary ? " · anniversary" : ""}</h1>
      <div className="micro tabular" style={{ padding: "0 16px 8px" }}>
        {new Date(event.startsAt).toLocaleString([], { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
        {event.venue !== null ? ` · ${event.venue}` : ""}{event.city !== null ? `, ${event.city}` : ""}
        {days > 0 && days < 90 ? ` · ${days} days to go` : ""}
      </div>
      {event.groupName !== null && (
        <button type="button" className="btn btn--underline-link press" onClick={() => onNavigate(`/groups/${event.groupId}`)}>
          {event.groupName} event — open group
        </button>
      )}
      {event.description !== null && <p style={{ padding: "8px 16px", font: "15px var(--font-ui)" }}>{event.description}</p>}

      <div style={{ display: "flex", gap: 8, padding: "8px 16px", flexWrap: "wrap", alignItems: "center" }}>
        <span className="tabular" style={{ font: "600 15px var(--font-ui)" }}>{event.goingCount} going</span>
        <span className="micro">tap to respond</span>
      </div>
      <div style={{ display: "flex", gap: 8, padding: "0 16px 16px", flexWrap: "wrap" }}>
        {(["going", "maybe", "no"] as const).map((r) => (
          <button key={r} type="button" className="press" disabled={busy || !verified}
            onClick={() => void rsvp(r)}
            aria-pressed={event.myResponse === r}
            style={{
              minHeight: 44, padding: "0 16px", cursor: verified ? "pointer" : "not-allowed",
              background: event.myResponse === r ? "var(--c-accent)" : "var(--c-base)",
              color: event.myResponse === r ? "var(--c-accent-contrast)" : "var(--c-base-contrast)",
              border: "1px solid var(--c-hairline)", font: "600 13px var(--font-ui)", textTransform: "capitalize",
            }}>
            {r}
          </button>
        ))}
      </div>
      {!verified && member !== null && (
        <p className="micro" style={{ padding: "0 16px 8px" }}>RSVP unlocks after verification.</p>
      )}

      {event.myResponse === "going" && (
        <div style={{ padding: "0 16px 16px" }}>
          <button type="button" className="btn btn--outlined press" onClick={() => void openTicket()}>My QR ticket</button>
        </div>
      )}

      {event.virtualLink !== null && (
        <div style={{ padding: "0 16px 16px" }}>
          <p className="micro" style={{ paddingBottom: 8 }}>Virtual attendance</p>
          <a href={event.virtualLink} target="_blank" rel="noreferrer" style={{ font: "15px var(--font-ui)", color: "var(--c-accent)" }}>
            Join virtually (opens the meeting link)
          </a>
          {event.groupId !== null && (
            <button type="button" className="btn btn--underline-link press" onClick={() => onNavigate(`/groups/${event.groupId}`)}>
              Live chat in the group
            </button>
          )}
        </div>
      )}

      {event.organizer && <OrganizerSuite eventId={eventId} member={member} />}

      {ticket !== null && (
        <div role="dialog" aria-modal="true" aria-label="My QR ticket" onClick={() => setTicket(null)}
          style={{ position: "fixed", inset: 0, background: "var(--c-scrim)", zIndex: 55, display: "flex", alignItems: "flex-end" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", background: "var(--c-base)", borderTop: "2px solid var(--c-accent)", padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ font: "700 17px var(--font-masthead)", color: "var(--c-accent)" }}>{ticket.eventTitle}</span>
              <span className="micro tabular">{new Date(ticket.startsAt).toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "center", padding: 16 }} dangerouslySetInnerHTML={{ __html: ticket.qrSvg }} />
            <p className="micro" style={{ textAlign: "center" }}>Show this at the door. One scan per ticket.</p>
          </div>
        </div>
      )}
    </main>
  );
}

function OrganizerSuite({ eventId, member }: { eventId: string; member: { id: string; roles: string[] } | null }): React.ReactElement {
  const [tasks, setTasks] = useState<EventTask[] | null>(null);
  const [budget, setBudget] = useState<BudgetItem[] | null>(null);
  const [attendees, setAttendees] = useState<Array<{ memberId: string; name: string; response: string; checkedIn: boolean }> | null>(null);
  const [live, setLive] = useState<{ counts: { going: number; maybe: number; checkedIn: number }; checkInOpen: boolean } | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [budgetLabel, setBudgetLabel] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanRef = useRef<{ stop: () => void } | null>(null);

  const load = (): void => {
    Api.eventTasks(eventId).then((r) => { setTasks(r.tasks); setBudget(r.budget); }).catch(() => undefined);
    Api.eventAttendees(eventId).then((r) => setAttendees(r.attendees)).catch(() => undefined);
    Api.liveCounts(eventId).then(setLive).catch(() => undefined);
  };
  useEffect(load, [eventId]);

  const addTask = async (): Promise<void> => {
    if (taskTitle.trim().length < 2) return;
    await Api.addEventTask(eventId, { title: taskTitle, assignee: member?.id }).catch(() => undefined);
    setTaskTitle(""); load();
  };
  const toggleTask = async (t: EventTask): Promise<void> => {
    await Api.updateEventTask(eventId, t.id, { done: !t.done }).catch(() => undefined);
    load();
  };
  const addBudget = async (): Promise<void> => {
    const amount = Number(budgetAmount);
    if (budgetLabel.trim().length === 0 || Number.isNaN(amount)) return;
    await Api.addBudgetItem(eventId, { label: budgetLabel, amountMinor: Math.round(amount * 100), currency: "NGN", kind: "planned" }).catch(() => undefined);
    setBudgetLabel(""); setBudgetAmount(""); load();
  };

  const toggleDoor = async (): Promise<void> => {
    if (live === null) return;
    await Api.updateEvent(eventId, { checkInOpen: !live.checkInOpen }).catch(() => undefined);
    load();
  };

  const startScan = async (): Promise<void> => {
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const video = videoRef.current;
      if (video === null) return;
      video.srcObject = stream;
      await video.play();
      const jsQR = (await import("jsqr")).default;
      const canvas = document.createElement("canvas");
      const tick = (): void => {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth; canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");
          if (ctx !== null) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
            if (code !== null) {
              void Api.checkIn(eventId, code.data).then((r) => {
                setScanMsg(r.duplicate ? "Already checked in." : "Checked in.");
                load();
              }).catch((e: Error) => setScanMsg(e.message));
              stream.getTracks().forEach((t) => t.stop());
              setScanning(false);
              return;
            }
          }
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      scanRef.current = { stop: () => { stream.getTracks().forEach((t) => t.stop()); setScanning(false); } };
    } catch {
      setScanMsg("Camera unavailable. Use a device with a camera, or type the ticket code below.");
      setScanning(false);
    }
  };

  return (
    <div>
      <Section label="Organizer — door mode">
        {live !== null && (
          <div style={{ display: "flex", gap: 24, marginBottom: 12 }}>
            <Stat label="Going" value={live.counts.going} />
            <Stat label="Maybe" value={live.counts.maybe} />
            <Stat label="Checked in" value={live.counts.checkedIn} accent />
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn btn--filled press" onClick={() => void toggleDoor()}>
            {live?.checkInOpen === true ? "Close door" : "Open door"}
          </button>
          <button type="button" className="btn btn--outlined press" onClick={() => void startScan()} disabled={scanning}>
            {scanning ? "Scanning…" : "Scan ticket"}
          </button>
        </div>
        {scanning && (
          <div style={{ marginTop: 12 }}>
            <video ref={videoRef} style={{ width: "100%", maxHeight: 320, border: "1px solid var(--c-hairline)" }} muted playsInline />
            <button type="button" className="btn btn--underline-link press" onClick={() => { scanRef.current?.stop(); }}>Stop camera</button>
          </div>
        )}
        {scanMsg !== null && <p style={{ font: "14px var(--font-ui)", color: "var(--c-accent)" }}>{scanMsg}</p>}
      </Section>

      <Section label="Reunion tasks">
        {tasks !== null && tasks.map((t) => (
          <div key={t.id} className="row" style={{ padding: "8px 0" }}>
            <span style={{ flex: 1, font: "14px var(--font-ui)" }}>
              <span style={{ textDecoration: t.done ? "line-through" : "none" }}>{t.title}</span>
              <span className="micro">{t.assigneeName !== null ? ` · ${t.assigneeName}` : ""}</span>
            </span>
            <button type="button" className="btn btn--underline-link press" style={{ minHeight: 32 }} onClick={() => void toggleTask(t)}>
              {t.done ? "Undo" : "Done"}
            </button>
          </div>
        ))}
        <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="New task, e.g. Book the DJ" aria-label="New task"
          style={{ width: "100%", minHeight: 44, border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "14px var(--font-ui)", color: "var(--c-base-contrast)" }} />
        <button type="button" className="btn btn--outlined press" onClick={() => void addTask()} disabled={taskTitle.trim().length < 2}>Add task</button>
      </Section>

      <Section label="Budget">
        {budget !== null && budget.map((b) => (
          <div key={b.id} className="row tabular" style={{ padding: "8px 0" }}>
            <span style={{ flex: 1, font: "14px var(--font-ui)" }}>{b.label} <span className="micro">{b.kind}</span></span>
            <span style={{ font: "600 14px var(--font-ui)" }}>{(b.amountMinor / 100).toLocaleString()} {b.currency}</span>
          </div>
        ))}
        <input value={budgetLabel} onChange={(e) => setBudgetLabel(e.target.value)} placeholder="Line, e.g. Sound system" aria-label="Budget label"
          style={{ width: "100%", minHeight: 44, border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "14px var(--font-ui)", color: "var(--c-base-contrast)" }} />
        <input value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} inputMode="decimal" placeholder="Amount in naira" aria-label="Budget amount"
          style={{ width: "100%", minHeight: 44, border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "14px var(--font-ui)", color: "var(--c-base-contrast)" }} />
        <button type="button" className="btn btn--outlined press" onClick={() => void addBudget()} disabled={budgetLabel.trim().length === 0}>Add line</button>
      </Section>

      <Section label="RSVPs">
        {attendees !== null && attendees.map((a) => (
          <div key={a.memberId} className="row" style={{ padding: "8px 0" }}>
            <span style={{ flex: 1, font: "14px var(--font-ui)" }}>{a.name}</span>
            <span className="micro">{a.response}{a.checkedIn ? " · in" : ""}</span>
          </div>
        ))}
      </Section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }): React.ReactElement {
  return (
    <div>
      <div className="tabular" style={{ font: "700 28px var(--font-ui)", color: accent ? "var(--c-accent)" : "var(--c-base-contrast)" }}>{value}</div>
      <div className="micro">{label}</div>
    </div>
  );
}
