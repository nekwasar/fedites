-- 0006_recognition.sql — Phase 3 batch 3 (phases.md session 3.4).
--
-- One recognition engine (rail 6): badges, streaks, and founding status all
-- read the same activity points ledger. K2: points and badges are member
-- attributes, never public league tables. K5: streaks are private to the
-- member — no streak-shaming, no push nagging. Personalization: join-intent
-- capture, per-group tune-more affinity, notification prefs.

CREATE TABLE recognition_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  member_id   uuid NOT NULL REFERENCES members(id),
  kind        text NOT NULL,
  points      integer NOT NULL,
  ref_type    text,
  ref_id      uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE member_badges (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  member_id  uuid NOT NULL REFERENCES members(id),
  badge      text NOT NULL,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  awarded_by uuid REFERENCES members(id),
  UNIQUE (member_id, badge)
);

-- Weekly activity streak: private to the member (K5).
CREATE TABLE member_streaks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id   uuid NOT NULL REFERENCES instances(id),
  member_id     uuid NOT NULL REFERENCES members(id),
  current_weeks integer NOT NULL DEFAULT 0,
  longest_weeks integer NOT NULL DEFAULT 0,
  last_week     integer,                     -- ISO year*100 + week
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id)
);

ALTER TABLE members ADD COLUMN notify_prefs jsonb NOT NULL DEFAULT '{}';

ALTER TABLE group_members ADD COLUMN affinity smallint NOT NULL DEFAULT 0;

CREATE INDEX idx_recognition_member ON recognition_events(instance_id, member_id);
CREATE INDEX idx_badges_member ON member_badges(member_id);
