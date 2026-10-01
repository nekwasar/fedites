-- 0013_nostalgia.sql — Phase 5 batch 3 (phases.md session 5.3).
--
-- The nostalgia bundle: remember-when threads (weekly prompts + stories),
-- recipe exchange, nostalgia radio (collaborative era playlists), time
-- capsules (sealed until the milestone reunion), letters to future self
-- (future-delivery gate), anthem player + school bell (instance media/config
-- slots), crest stickers/frames (inventory assigned per instance), birthday
-- reminders (memorial-aware — §P), and achievement awards (admin-awarded).
-- K5: birthday notices are private and gentle; D1: no emojis anywhere.

CREATE TABLE remember_when_threads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  prompt      text NOT NULL,
  week        text NOT NULL,                    -- ISO year-week key
  created_by  uuid NOT NULL REFERENCES members(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_id, week)
);

CREATE TABLE remember_when_posts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  thread_id  uuid NOT NULL REFERENCES remember_when_threads(id),
  author_id  uuid NOT NULL REFERENCES members(id),
  story      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE recipes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  title       text NOT NULL,
  ingredients text NOT NULL,
  steps       text NOT NULL,
  story       text,                             -- the tuck-shop memory behind it
  media_id    uuid REFERENCES media(id),
  submitted_by uuid NOT NULL REFERENCES members(id),
  archived_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE radio_tracks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  title       text NOT NULL,
  artist      text,
  year        integer,
  media_id    uuid REFERENCES media(id),          -- uploaded recording
  external_url text,                              -- or a streaming link
  added_by    uuid NOT NULL REFERENCES members(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE time_capsules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  member_id   uuid NOT NULL REFERENCES members(id),
  title       text NOT NULL,
  body        text NOT NULL,
  media_ids   jsonb NOT NULL DEFAULT '[]',
  open_at     date NOT NULL,                      -- milestone reunion date
  opened_at   timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE future_letters (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  member_id   uuid NOT NULL REFERENCES members(id),
  body        text NOT NULL,
  deliver_on  date NOT NULL,                      -- future milestone date
  delivered_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Instance media/config slots for the anthem player and school bell chime.
-- Admin uploads once; every member's player/chime reads these.
CREATE TABLE nostalgia_config (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  anthem_media_id uuid REFERENCES media(id),
  bell_media_id   uuid REFERENCES media(id),
  UNIQUE (instance_id)
);

-- Crest stickers/frames inventory (instance-scoped asset pack).
CREATE TABLE sticker_inventory (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  name        text NOT NULL,
  media_id    uuid NOT NULL REFERENCES media(id),
  kind        text NOT NULL CHECK (kind IN ('sticker','frame')),
  created_by  uuid NOT NULL REFERENCES members(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE member_stickers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  member_id  uuid NOT NULL REFERENCES members(id),
  sticker_id uuid NOT NULL REFERENCES sticker_inventory(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, sticker_id)
);

CREATE TABLE achievement_awards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  member_id   uuid NOT NULL REFERENCES members(id),
  title       text NOT NULL,
  citation    text,
  awarded_at  timestamptz NOT NULL DEFAULT now(),
  awarded_by  uuid NOT NULL REFERENCES members(id),
  UNIQUE (member_id, title)
);

CREATE INDEX idx_rw_threads_instance ON remember_when_threads(instance_id, week DESC);
CREATE INDEX idx_rw_posts_thread ON remember_when_posts(thread_id, created_at);
CREATE INDEX idx_recipes_instance ON recipes(instance_id, created_at DESC);
CREATE INDEX idx_capsules_member ON time_capsules(instance_id, member_id);
CREATE INDEX idx_letters_member ON future_letters(instance_id, member_id);
