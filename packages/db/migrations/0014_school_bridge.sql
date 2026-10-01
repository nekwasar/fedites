-- 0014_school_bridge.sql — Phase 5 batch 4 (phases.md session 5.4a).
--
-- The School Bridge: the school posts needs; alumni fund or fulfil them.
-- Wishlist items (fund or physically fulfil), adopt-a-project (sets sponsor
-- renovations/labs/libraries), past questions bank (current-student access),
-- teacher tributes, facility booking (admin-approved rentals), and records
-- verification (employer requests, verified securely).
-- §P: archived not deleted; ledger stays the single money rail (campaign_id
-- reused as the outcome target for wishlist/project giving in batch 3's
-- giving flows).

CREATE TABLE wishlist_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  title       text NOT NULL,
  details     text,
  est_cost_minor bigint,
  currency    text,
  status      text NOT NULL DEFAULT 'open'
              CHECK (status IN ('open','funded','fulfilled','closed')),
  funded_by   uuid REFERENCES members(id),
  fulfil_note text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE adopt_a_projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  title       text NOT NULL,
  story       text,
  goal_minor  bigint NOT NULL,
  currency    text NOT NULL,
  sponsored_by text,                             -- e.g. "Set '98"
  status      text NOT NULL DEFAULT 'open'
              CHECK (status IN ('open','in_progress','completed','closed')),
  progress_notes text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE past_questions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  subject     text NOT NULL,
  year        integer,
  title       text,
  media_id    uuid NOT NULL REFERENCES media(id),
  uploaded_by uuid NOT NULL REFERENCES members(id),
  archived_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE teacher_tributes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  teacher_name text NOT NULL,
  story       text NOT NULL,
  media_id    uuid REFERENCES media(id),
  submitted_by uuid NOT NULL REFERENCES members(id),
  archived_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_id, teacher_name, submitted_by)
);

CREATE TABLE facility_bookings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  member_id   uuid NOT NULL REFERENCES members(id),
  facility    text NOT NULL,
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz NOT NULL,
  purpose     text,
  status      text NOT NULL DEFAULT 'requested'
              CHECK (status IN ('requested','approved','declined','cancelled')),
  decided_by  uuid REFERENCES members(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Employer-facing records verification: member-initiated, admin-verified.
CREATE TABLE records_verifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  member_id   uuid NOT NULL REFERENCES members(id),
  employer_name text NOT NULL,
  employer_email text NOT NULL,
  status      text NOT NULL DEFAULT 'requested'
              CHECK (status IN ('requested','verified','declined')),
  decided_by  uuid REFERENCES members(id),
  decided_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wishlist_instance ON wishlist_items(instance_id, status);
CREATE INDEX idx_projects_instance ON adopt_a_projects(instance_id, status);
CREATE INDEX idx_pq_instance ON past_questions(instance_id, subject);
CREATE INDEX idx_bookings_instance ON facility_bookings(instance_id, status);
