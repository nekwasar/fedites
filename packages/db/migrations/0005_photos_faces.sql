-- 0005_photos_faces.sql — Phase 3 batch 2 (phases.md session 3.3).
--
-- Event photo wall: attendees upload; members tag each other (realtime via
-- the WS hub). Face index: K3 — opt-in per member, SELF-ONLY search (§P:
-- you can only find photos of yourself), deletable anytime taking the data.
-- Embeddings come from the pluggable provider (apps/api/src/face.ts); the
-- stub ships first, real providers swap in behind the interface.

ALTER TABLE members ADD COLUMN face_opt_in boolean NOT NULL DEFAULT false;

CREATE TABLE event_photos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  event_id    uuid NOT NULL REFERENCES events(id),
  media_id    uuid NOT NULL REFERENCES media(id),
  uploader_id uuid NOT NULL REFERENCES members(id),
  archived_at timestamptz,                -- N1: archived, never deleted
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, media_id)
);

CREATE TABLE photo_tags (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id      uuid NOT NULL REFERENCES instances(id),
  photo_id         uuid NOT NULL REFERENCES event_photos(id),
  tagged_member_id uuid NOT NULL REFERENCES members(id),
  tagger_id        uuid NOT NULL REFERENCES members(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (photo_id, tagged_member_id)
);

-- One face engine (rail): reference embeddings (self-search keys) and photo
-- embeddings (what the search runs against). Deletion = delete rows (K3).
CREATE TABLE face_index (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  member_id   uuid NOT NULL REFERENCES members(id),   -- who this row belongs to
  kind        text NOT NULL CHECK (kind IN ('reference','photo')),
  media_id    uuid NOT NULL REFERENCES media(id),
  embedding   jsonb NOT NULL,                          -- provider-specific vector
  provider    text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, media_id, kind)
);

CREATE INDEX idx_photos_event ON event_photos(event_id, created_at DESC);
CREATE INDEX idx_face_member ON face_index(instance_id, member_id);
