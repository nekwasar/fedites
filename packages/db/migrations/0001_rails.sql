-- 0001_rails.sql — the rails data model (phases.md session 0.2).
--
-- Law of this schema:
--   * instance_id on EVERY table (white-label tenant insurance, rules.md §P).
--   * archive, never delete (N1): no hard-delete paths; archived_at timestamps.
--   * admin destructive actions reversible 30 days (N2): audit + soft-delete window.
--   * no public popularity metrics (K2): no follower/like league-table columns.
--   * every row carries created_at; identity is one member record (rail 1).

-- ---------------- instances & config ----------------

CREATE TABLE instances (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name  text NOT NULL,
  short_name    text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Config lives in the DB as a typed, versioned document per instance
-- (configuration.md §8). Draft → preview → publish with versioning & rollback.
CREATE TABLE config_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id   uuid NOT NULL REFERENCES instances(id),
  version       integer NOT NULL,
  status        text NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','preview','published','superseded')),
  document      jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  published_at  timestamptz,
  UNIQUE (instance_id, version)
);

-- ---------------- identity & verification (mvp §1) ----------------

CREATE TABLE sets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id   uuid NOT NULL REFERENCES instances(id),
  year          integer NOT NULL,
  label         text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_id, year)
);

CREATE TABLE sports_houses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id   uuid NOT NULL REFERENCES instances(id),
  name          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_id, name)
);

CREATE TABLE members (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id      uuid NOT NULL REFERENCES instances(id),
  set_id           uuid REFERENCES sets(id),
  house_id         uuid REFERENCES sports_houses(id),
  display_name     text NOT NULL,
  email            text NOT NULL,
  phone            text,
  city             text,
  country          text,
  profession       text,
  bio              text,
  -- K1: contact details private by default; visibility JSON is member-controlled.
  visibility       jsonb NOT NULL DEFAULT '{"contact":"private","birthday":"private"}',
  -- Trust-based onboarding: limited accounts until 3 setmates vouch (§P).
  verification     text NOT NULL DEFAULT 'limited'
                   CHECK (verification IN ('pending','limited','verified','honorary')),
  vouch_count      integer NOT NULL DEFAULT 0,
  -- Memorial state (§P): content preserved read-only, no logins, no birthday pushes.
  memorial         boolean NOT NULL DEFAULT false,
  memorial_at      timestamptz,
  archived_at      timestamptz,          -- N1: archive, never delete
  deleted_at       timestamptz,          -- N2: reversible 30 days
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_id, email)
);

CREATE TABLE invite_codes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id   uuid NOT NULL REFERENCES instances(id),
  code          text NOT NULL,
  created_by    uuid NOT NULL REFERENCES members(id),
  used_by       uuid REFERENCES members(id),
  expires_at    timestamptz,
  used_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_id, code)
);

-- Vouching is invisible after verification: no public counts, no names displayed.
CREATE TABLE vouches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id   uuid NOT NULL REFERENCES instances(id),
  member_id     uuid NOT NULL REFERENCES members(id),
  voucher_id    uuid NOT NULL REFERENCES members(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_id, member_id, voucher_id)
);

CREATE TABLE roles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id   uuid NOT NULL REFERENCES instances(id),
  key           text NOT NULL,  -- president, treasurer, secretary, moderator, editor, member...
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_id, key)
);

CREATE TABLE member_roles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id   uuid NOT NULL REFERENCES instances(id),
  member_id     uuid NOT NULL REFERENCES members(id),
  role_id       uuid NOT NULL REFERENCES roles(id),
  assigned_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_id, member_id, role_id)
);

-- ---------------- groups (one engine, six flavors — spec §6) ----------------

CREATE TABLE groups (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id   uuid NOT NULL REFERENCES instances(id),
  type          text NOT NULL
                CHECK (type IN ('set','chapter','interest','guild','house','committee')),
  name          text NOT NULL,
  description   text,
  -- Lifecycle: archived (read-only), never deleted (N1).
  archived_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE group_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id   uuid NOT NULL REFERENCES instances(id),
  group_id      uuid NOT NULL REFERENCES groups(id),
  member_id     uuid NOT NULL REFERENCES members(id),
  is_admin      boolean NOT NULL DEFAULT false,
  pinned        boolean NOT NULL DEFAULT false,
  joined_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_id, group_id, member_id)
);

-- ---------------- activity & chat (three content layers — spec §2) ----------------

CREATE TABLE activity_posts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id   uuid NOT NULL REFERENCES instances(id),
  group_id      uuid REFERENCES groups(id),
  author_id     uuid REFERENCES members(id),
  -- 'news' rows have group_id NULL and are admin-only (News bulletin layer).
  kind          text NOT NULL DEFAULT 'post'
                CHECK (kind IN ('post','photo','poll','event','file','news')),
  body          text,
  archived_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE comments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id   uuid NOT NULL REFERENCES instances(id),
  post_id       uuid NOT NULL REFERENCES activity_posts(id),
  author_id     uuid NOT NULL REFERENCES members(id),
  parent_id     uuid REFERENCES comments(id),   -- threaded comments
  body          text NOT NULL,
  archived_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id   uuid NOT NULL REFERENCES instances(id),
  post_id       uuid NOT NULL REFERENCES activity_posts(id),
  member_id     uuid NOT NULL REFERENCES members(id),
  emoji         text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_id, post_id, member_id, emoji)
);

-- Chat messages: ephemeral stream; delete-own-anytime, edit within window (§P).
CREATE TABLE messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id   uuid NOT NULL REFERENCES instances(id),
  group_id      uuid REFERENCES groups(id),     -- group chat
  dm_a          uuid REFERENCES members(id),    -- DM pair (exactly one of
  dm_b          uuid REFERENCES members(id),    --  group_id / dm pair is set)
  author_id     uuid NOT NULL REFERENCES members(id),
  body          text,
  edited_at     timestamptz,
  deleted_at    timestamptz,                    -- tombstone; content dropped
  pinned_to_post uuid REFERENCES activity_posts(id), -- pin-to-feed bridge
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(group_id, dm_a) <= 1)
);

-- ---------------- events (mvp §5) ----------------

CREATE TABLE events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id   uuid NOT NULL REFERENCES instances(id),
  group_id      uuid REFERENCES groups(id),     -- group-owned events badged with crest
  created_by    uuid REFERENCES members(id),
  title         text NOT NULL,
  starts_at     timestamptz NOT NULL,
  ends_at       timestamptz,
  location      text,
  archived_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE event_rsvps (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id   uuid NOT NULL REFERENCES instances(id),
  event_id      uuid NOT NULL REFERENCES events(id),
  member_id     uuid NOT NULL REFERENCES members(id),
  response      text NOT NULL CHECK (response IN ('going','maybe','no')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_id, event_id, member_id)
);

-- ---------------- money (one wallet/ledger — rail 5, mvp §7) ----------------

CREATE TABLE ledger_entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id   uuid NOT NULL REFERENCES instances(id),
  member_id     uuid REFERENCES members(id),
  kind          text NOT NULL
                CHECK (kind IN ('dues','donation','campaign','p2p','tribute','pledge_fulfilled','scholarship','reimbursement','sponsorship','expense')),
  amount_minor  bigint NOT NULL,               -- integer minor units; tabular rendering
  currency      text NOT NULL,
  memo          text,
  -- K1: dues status private; the transparent ledger is a filtered view of this table.
  private_ledger boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------- notifications & audit (rails 2 & moderation) ----------------

CREATE TABLE notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id   uuid NOT NULL REFERENCES instances(id),
  member_id     uuid NOT NULL REFERENCES members(id),
  kind          text NOT NULL,
  payload       jsonb NOT NULL DEFAULT '{}',
  read_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id   uuid NOT NULL REFERENCES instances(id),
  actor_id      uuid REFERENCES members(id),
  action        text NOT NULL,
  target        text NOT NULL,
  reversible_until timestamptz,                 -- N2: 30-day window
  details       jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------- indexes (performance budget L1 from day one) ----------------

CREATE INDEX idx_members_instance ON members(instance_id);
CREATE INDEX idx_groups_instance ON groups(instance_id);
CREATE INDEX idx_group_members_member ON group_members(instance_id, member_id);
CREATE INDEX idx_activity_instance_time ON activity_posts(instance_id, created_at DESC);
CREATE INDEX idx_activity_group_time ON activity_posts(group_id, created_at DESC);
CREATE INDEX idx_messages_group_time ON messages(instance_id, group_id, created_at DESC);
CREATE INDEX idx_messages_dm_time ON messages(instance_id, dm_a, dm_b, created_at DESC);
CREATE INDEX idx_events_instance_time ON events(instance_id, starts_at);
CREATE INDEX idx_ledger_instance_time ON ledger_entries(instance_id, created_at DESC);
CREATE INDEX idx_notifications_member ON notifications(instance_id, member_id, created_at DESC);
CREATE INDEX idx_config_published ON config_documents(instance_id, status, version DESC);
