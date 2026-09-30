-- 0003_daily_loop.sql — Phase 2 (phases.md sessions 2.1–2.6).
--
-- Group engine: one group object, lifecycle (proposed → active → archived,
-- never deleted — N1). One unread source of truth: thread_reads (I5 — badges
-- never disagree between Groups home and Chat). Media library (rail 4).
-- Polls with per-member votes (K2: counts visible within the group only).
-- Reports + escalation for moderation v1 (2.6).

ALTER TABLE groups
  ADD COLUMN status      text NOT NULL DEFAULT 'active'
                         CHECK (status IN ('proposed','active','archived')),
  ADD COLUMN created_by  uuid REFERENCES members(id);
-- description already exists from 0001_rails.sql

ALTER TABLE activity_posts
  ADD COLUMN pinned_at            timestamptz,
  ADD COLUMN comments_enabled     boolean NOT NULL DEFAULT true,
  ADD COLUMN promoted_from_post   uuid REFERENCES activity_posts(id),
  ADD COLUMN promoted_by          uuid REFERENCES members(id),
  ADD COLUMN pinned_from_message  uuid REFERENCES messages(id);

ALTER TABLE group_members
  ADD COLUMN feed_muted  boolean NOT NULL DEFAULT false,
  ADD COLUMN notify_level text NOT NULL DEFAULT 'all'
                          CHECK (notify_level IN ('all','mentions','off'));

ALTER TABLE members ADD COLUMN prefs jsonb NOT NULL DEFAULT '{}';

-- Media library (rail 4: feed photos, galleries, event walls, yearbook all
-- draw from this one organized store).
CREATE TABLE media (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id  uuid NOT NULL REFERENCES instances(id),
  uploader_id  uuid NOT NULL REFERENCES members(id),
  kind         text NOT NULL CHECK (kind IN ('image','video','audio','file')),
  mime         text NOT NULL,
  size_bytes   bigint NOT NULL,
  storage_path text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE messages
  ADD COLUMN kind     text NOT NULL DEFAULT 'text'
                      CHECK (kind IN ('text','voice','photo','video','file')),
  ADD COLUMN media_id uuid REFERENCES media(id),
  ADD COLUMN reply_to uuid REFERENCES messages(id);

CREATE TABLE post_media (
  post_id  uuid NOT NULL REFERENCES activity_posts(id),
  media_id uuid NOT NULL REFERENCES media(id),
  position integer NOT NULL DEFAULT 0,
  PRIMARY KEY (post_id, media_id)
);

-- Polls: one post, options, one vote per member (K2-safe: counts only).
CREATE TABLE poll_options (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id  uuid NOT NULL REFERENCES activity_posts(id),
  label    text NOT NULL,
  position integer NOT NULL DEFAULT 0
);

CREATE TABLE poll_votes (
  post_id   uuid NOT NULL REFERENCES activity_posts(id),
  option_id uuid NOT NULL REFERENCES poll_options(id),
  member_id uuid NOT NULL REFERENCES members(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, member_id)
);

-- One unread source of truth (I5): chat watermarks and activity-seen marks
-- for every thread (group or DM), shared by Groups home, Chat tab, badges.
CREATE TABLE thread_reads (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id      uuid NOT NULL REFERENCES instances(id),
  member_id        uuid NOT NULL REFERENCES members(id),
  thread_type      text NOT NULL CHECK (thread_type IN ('group','dm')),
  thread_id        uuid NOT NULL,
  last_read_at     timestamptz,
  activity_seen_at timestamptz,
  pinned           boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, thread_type, thread_id)
);

-- Join requests (guild: request to join; interest: open join but proposals
-- for creation). Committee is invite-only: group admins add members directly.
CREATE TABLE group_join_requests (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  group_id   uuid NOT NULL REFERENCES groups(id),
  member_id  uuid NOT NULL REFERENCES members(id),
  status     text NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending','approved','rejected')),
  decided_by uuid REFERENCES members(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, member_id)
);

-- Moderation v1 (2.6): members report; group admins and school moderators
-- act; escalation goes to school moderators. All actions audit-logged.
CREATE TABLE reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  reporter_id uuid NOT NULL REFERENCES members(id),
  post_id     uuid REFERENCES activity_posts(id),
  message_id  uuid REFERENCES messages(id),
  reason      text NOT NULL,
  status      text NOT NULL DEFAULT 'open'
              CHECK (status IN ('open','escalated','resolved','dismissed')),
  handled_by  uuid REFERENCES members(id),
  resolution  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(post_id, message_id) = 1)
);

CREATE INDEX idx_thread_reads_member ON thread_reads(instance_id, member_id);
CREATE INDEX idx_messages_thread ON messages(instance_id, group_id, created_at DESC);
CREATE INDEX idx_activity_group ON activity_posts(group_id, created_at DESC);
CREATE INDEX idx_reports_instance ON reports(instance_id, status);
CREATE INDEX idx_media_instance ON media(instance_id, created_at DESC);
