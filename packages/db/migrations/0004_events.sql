-- 0004_events.sql — Phase 3 batch 1 (phases.md sessions 3.1 + 3.2).
--
-- Events are created by admins and group admins only (§P, enforced in API).
-- RSVP is free (ticketing & payments deferred per mvp.md). QR tickets carry a
-- random secret stored hashed; door check-in validates + records (N1: rows
-- kept, N2: organizer actions reversible). Virtual attendance = external
-- meeting/livestream link (v6.1: no native WebRTC).

ALTER TABLE events
  ADD COLUMN description    text,
  ADD COLUMN venue          text,
  ADD COLUMN city           text,
  ADD COLUMN cover_media_id uuid REFERENCES media(id),
  ADD COLUMN virtual_link   text,
  ADD COLUMN check_in_open  boolean NOT NULL DEFAULT false,
  ADD COLUMN anniversary    boolean NOT NULL DEFAULT false,
  ADD COLUMN edited_at      timestamptz;

ALTER TABLE event_rsvps ADD COLUMN responded_at timestamptz;

-- My QR ticket (spec §4.5): one per member per event, secret stored hashed.
CREATE TABLE event_tickets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  event_id    uuid NOT NULL REFERENCES events(id),
  member_id   uuid NOT NULL REFERENCES members(id),
  secret_hash text NOT NULL,
  issued_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, member_id)
);

-- QR door check-in (mvp §5): who scanned, when — live counts derive from here.
CREATE TABLE event_checkins (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  event_id    uuid NOT NULL REFERENCES events(id),
  member_id   uuid NOT NULL REFERENCES members(id),
  checked_by  uuid NOT NULL REFERENCES members(id),
  checked_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, member_id)
);

-- Reunion planning suite (spec §7 Manage→Events): tasks + budgets.
CREATE TABLE event_tasks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  event_id   uuid NOT NULL REFERENCES events(id),
  title      text NOT NULL,
  assignee   uuid REFERENCES members(id),
  due_at     timestamptz,
  done       boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES members(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE event_budget_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id  uuid NOT NULL REFERENCES instances(id),
  event_id     uuid NOT NULL REFERENCES events(id),
  label        text NOT NULL,
  amount_minor bigint NOT NULL,
  currency     text NOT NULL,
  kind         text NOT NULL DEFAULT 'planned' CHECK (kind IN ('planned','actual')),
  created_by   uuid NOT NULL REFERENCES members(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tickets_event ON event_tickets(event_id);
CREATE INDEX idx_checkins_event ON event_checkins(event_id);
CREATE INDEX idx_tasks_event ON event_tasks(event_id);
CREATE INDEX idx_budget_event ON event_budget_items(event_id);
