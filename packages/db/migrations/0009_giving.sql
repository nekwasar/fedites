-- 0009_giving.sql — Phase 4 batch 2 (phases.md session 4.3).
--
-- Giving: donations (one-time via intents + recurring schedules), campaigns
-- with goals/deadlines/progress. The donor wall reads the one ledger
-- (rail 5) — named by default, anonymous per payment (§P). Confetti is
-- earned at exactly two moments (F6): payment success and goal completion.

CREATE TABLE campaigns (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id  uuid NOT NULL REFERENCES instances(id),
  title        text NOT NULL,
  description  text,
  goal_minor   bigint NOT NULL,
  currency     text NOT NULL,
  deadline     date,
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','archived')),
  goal_reached_at timestamptz,               -- F6: confetti moment marker
  created_by   uuid NOT NULL REFERENCES members(id),
  archived_at  timestamptz,                  -- N1
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Recurring giving: schedules produce polite confirmation intents each
-- period (manual gateway consistent) — never auto-charges (no dark patterns).
CREATE TABLE donation_schedules (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id  uuid NOT NULL REFERENCES instances(id),
  member_id    uuid NOT NULL REFERENCES members(id),
  amount_minor bigint NOT NULL,
  currency     text NOT NULL,
  frequency    text NOT NULL CHECK (frequency IN ('monthly','quarterly','annually')),
  campaign_id  uuid REFERENCES campaigns(id),
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled')),
  next_date    date NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payment_intents
  ADD COLUMN campaign_id uuid REFERENCES campaigns(id),
  ADD COLUMN meta jsonb NOT NULL DEFAULT '{}';

CREATE INDEX idx_campaigns_instance ON campaigns(instance_id, status);
CREATE INDEX idx_schedules_member ON donation_schedules(instance_id, member_id);
