/**
 * Event photo wall + AI photo finder (3.3).
 * D3: photos are content at the fixed 3:2 ratio. K3: opt-in, self-only
 * (§P), deletion takes the data. Optimistic-free — uploads confirm first.
 */
import React, { useEffect, useRef, useState } from "react";
import { Api } from "../api.js";
import type { PhotoWallItem } from "../events-types.js";
import type { MemberHit } from "../phase2-types.js";
import type { EventListItem } from "../events-types.js";

export function PhotoWall({ event, member, onNavigate }: {
  event: EventListItem;
  member: { id: string; verification: string } | null;
  onNavigate: (to: string) => void;
}): React.ReactElement {
  const [photos, setPhotos] = useState<PhotoWallItem[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [tagging, setTagging] = useState<string | null>(null);
  const [hits, setHits] = useState<MemberHit[]>([]);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Array<{ mediaId: string; score: number }> | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const selfRef = useRef<HTMLInputElement | null>(null);

  const isAttendee = event.myResponse === "going" || event.myResponse === "maybe";

  const load = (): void => { Api.eventPhotos(event.id).then((r) => setPhotos(r.photos)).catch(() => setPhotos([])); };
  useEffect(load, [event.id]);

  const upload = async (file: File): Promise<void> => {
    try {
      await Api.uploadEventPhoto(event.id, file);
      setNote(null);
      load();
    } catch (e) { setNote((e as Error).message); }
  };

  const searchMembers = (q: string, photoId: string): void => {
    setTagging(photoId); setQuery(q);
    Api.searchMembers(q).then((r) => setHits(r.members)).catch(() => undefined);
  };

  const tag = async (photoId: string, memberId: string): Promise<void> => {
    try {
      await Api.tagPhoto(event.id, photoId, memberId);
      setTagging(null); setQuery("");
      load();
    } catch (e) { setNote((e as Error).message); }
  };

  const report = async (photoId: string): Promise<void> => {
    await Api.report({ postId: undefined, messageId: undefined, reason: "photo" }).catch(() => undefined);
    void photoId;
  };

  const findMe = async (): Promise<void> => {
    if (member === null) { onNavigate("/auth"); return; }
    try {
      const status = await Api.faceStatus();
      if (!status.optIn) { setNote("Turn on face search in your profile (privacy) to use the finder."); return; }
      if (!status.enrolled) {
        selfRef.current?.click();
        return;
      }
      const r = await Api.findMe(event.id);
      setMatches(r.matches);
      if (r.matches.length === 0) setNote("No photos of you found in this wall yet.");
    } catch (e) { setNote((e as Error).message); }
  };

  const enrollSelfie = async (file: File): Promise<void> => {
    try {
      await Api.faceEnroll(file);
      setNote("Reference saved. Searching…");
      const r = await Api.findMe(event.id);
      setMatches(r.matches);
      setNote(r.matches.length === 0 ? "Enrolled. No matches in this wall yet." : null);
    } catch (e) { setNote((e as Error).message); }
  };

  const matchIds = new Set((matches ?? []).map((m) => m.mediaId));

  return (
    <section style={{ padding: "16px" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
        <div className="micro" style={{ flex: 1 }}>Photo wall</div>
        {isAttendee && (
          <>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f !== undefined) void upload(f); }} />
            <button type="button" className="btn btn--outlined press" onClick={() => fileRef.current?.click()}>Add photo</button>
          </>
        )}
        <button type="button" className="btn btn--underline-link press" onClick={() => void findMe()}>Find me</button>
      </div>
      {note !== null && <p style={{ font: "13px var(--font-ui)", color: "var(--c-accent)", margin: "8px 0" }}>{note}</p>}
      <input ref={selfRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f !== undefined) void enrollSelfie(f); }} />

      {matches !== null && (
        <p className="micro" style={{ padding: "4px 0" }}>
          Showing {matches.length} photo{matches.length === 1 ? "" : "s"} matched to your reference (self-search only).
          {" "}<button type="button" className="btn btn--underline-link press" style={{ minHeight: 28 }} onClick={() => setMatches(null)}>Show all</button>
        </p>
      )}

      {photos === null ? (
        <div className="skeleton" style={{ height: 120 }} />
      ) : photos.filter((p) => matches === null || matchIds.has(p.mediaId)).length === 0 ? (
        <p style={{ font: "15px var(--font-ui)", color: "var(--c-neutral-500)" }}>
          {isAttendee ? "The wall is empty. Add the first photo." : "Photos appear here once attendees add them."}
        </p>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingTop: 8 }}>
          {photos.filter((p) => matches === null || matchIds.has(p.mediaId)).map((p) => (
            <figure key={p.id} style={{ width: 220, margin: 0 }}>
              <img src={`/v1/media/${p.mediaId}`} alt={`Photo by ${p.uploader}`} loading="lazy"
                style={{ width: 220, aspectRatio: "3 / 2", objectFit: "cover", border: "1px solid var(--c-hairline)", display: "block" }} />
              <figcaption style={{ font: "13px var(--font-ui)", paddingTop: 4 }}>
                {p.uploader}
                {p.tags.length > 0 && <span className="micro"> · with {p.tags.map((t) => t.name).join(", ")}</span>}
              </figcaption>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn btn--underline-link press" style={{ minHeight: 28 }}
                  onClick={() => searchMembers("", p.id)}>Tag</button>
                {!p.isMine && (
                  <button type="button" className="btn btn--underline-link press" style={{ minHeight: 28 }} onClick={() => void report(p.id)}>Report</button>
                )}
              </div>
              {tagging === p.id && (
                <div style={{ border: "1px solid var(--c-hairline)", padding: 8, marginTop: 4 }}>
                  <input value={query} onChange={(e) => searchMembers(e.target.value, p.id)} placeholder="Search members" aria-label="Search members to tag"
                    style={{ width: "100%", minHeight: 36, border: "none", borderBottom: "1px solid var(--c-hairline)", background: "transparent", font: "14px var(--font-ui)", color: "var(--c-base-contrast)" }} />
                  {hits.map((h) => (
                    <button key={h.id} type="button" className="row press" style={{ padding: "4px 0", cursor: "pointer" }} onClick={() => void tag(p.id, h.id)}>
                      <span style={{ font: "14px var(--font-ui)" }}>{h.display_name}</span>
                    </button>
                  ))}
                  <button type="button" className="btn btn--underline-link press" style={{ minHeight: 28 }} onClick={() => setTagging(null)}>Cancel</button>
                </div>
              )}
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
