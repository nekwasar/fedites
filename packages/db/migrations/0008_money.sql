-- 0008_money.sql — Phase 4 batch 1 (phases.md sessions 4.1 + 4.2).
--
-- One wallet/ledger (rail 5): dues, donations, campaigns, P2P, tribute,
-- pledges, scholarships, reimbursements, sponsorships, expenses all write
-- here; the transparent ledger is a filtered view. §P: dues are private —
-- member-only + admin-only views; no public dues badge anywhere. Every
-- payment is receipted (per-instance receipt sequence). Payment gateway is
-- pluggable: manual "mark as paid" ships first (§P), real gateways swap in.
-- Tiers are admin-settable configuration with real perks (§8).

CREATE TABLE membership_tiers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id  uuid NOT NULL REFERENCES instances(id),
  name         text NOT NULL,
  amount_minor bigint NOT NULL,
  currency     text NOT NULL,
  cycle        text NOT NULL DEFAULT 'annual'
               CHECK (cycle IN ('annual','semiannual','quarterly','monthly','one-time')),
  perks        jsonb NOT NULL DEFAULT '{}',   -- e.g. {"voting":true,"eventPriority":true,"idMarking":true}
  archived_at  timestamptz,                   -- N1
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_id, name)
);

ALTER TABLE members ADD COLUMN tier_id uuid REFERENCES membership_tiers(id);

ALTER TABLE ledger_entries
  ADD COLUMN status      text NOT NULL DEFAULT 'confirmed'
                         CHECK (status IN ('pending','confirmed','voided')),
  ADD COLUMN reference   text,
  ADD COLUMN receipt_no  text,
  ADD COLUMN anonymous   boolean NOT NULL DEFAULT false,  -- per-payment toggle (batch 2)
  ADD COLUMN campaign_id uuid,                            -- batch 2 (campaigns)
  ADD COLUMN entered_by  uuid REFERENCES members(id),     -- who marked a manual payment
  ADD COLUMN edited_at   timestamptz;

-- Per-instance, per-year receipt sequence (every payment receipted, §P).
CREATE TABLE receipt_counters (
  instance_id uuid NOT NULL REFERENCES instances(id),
  year        integer NOT NULL,
  last        integer NOT NULL DEFAULT 0,
  PRIMARY KEY (instance_id, year)
);

-- Gateway abstraction rows: an intent is created before money moves and is
-- confirmed into a ledger entry (manual mark-as-paid or a real gateway).
CREATE TABLE payment_intents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id    uuid NOT NULL REFERENCES instances(id),
  member_id      uuid NOT NULL REFERENCES members(id),
  amount_minor   bigint NOT NULL,
  currency       text NOT NULL,
  purpose        text NOT NULL
                 CHECK (purpose IN ('dues','donation','campaign','p2p','tribute','sponsorship','scholarship')),
  assessment_id  uuid,
  provider       text NOT NULL,
  provider_ref   text,
  status         text NOT NULL DEFAULT 'awaiting_confirmation'
                 CHECK (status IN ('initiated','awaiting_confirmation','confirmed','failed','cancelled')),
  ledger_entry_id uuid REFERENCES ledger_entries(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  confirmed_at   timestamptz
);

-- Dues cycle: treasurer runs the cycle → one assessment per verified member
-- per period. Status derives from payment + due_date (overdue computed).
CREATE TABLE dues_assessments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id  uuid NOT NULL REFERENCES instances(id),
  member_id    uuid NOT NULL REFERENCES members(id),
  tier_id      uuid REFERENCES membership_tiers(id),
  period       text NOT NULL,
  amount_minor bigint NOT NULL,
  currency     text NOT NULL,
  due_date     date NOT NULL,
  status       text NOT NULL DEFAULT 'due'
               CHECK (status IN ('due','paid','overdue','waived')),
  waived_by    uuid REFERENCES members(id),
  waived_at    timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_id, member_id, period)
);

ALTER TABLE ledger_entries ADD COLUMN assessment_id uuid REFERENCES dues_assessments(id);

CREATE INDEX idx_ledger_member ON ledger_entries(instance_id, member_id, created_at DESC);
CREATE INDEX idx_ledger_status ON ledger_entries(instance_id, status);
CREATE INDEX idx_intents_member ON payment_intents(instance_id, member_id);
CREATE INDEX idx_assessments_member ON dues_assessments(instance_id, member_id);
CREATE INDEX idx_assessments_status ON dues_assessments(instance_id, status);
