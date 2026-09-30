-- 0010_structured_giving.sql — Phase 4 batch 3 (phases.md session 4.4).
--
-- P2P fundraisers (approval gate, §P-consistent), pledge tracking (private
-- nudges — K5), reimbursements (treasurer-approved), sponsorships (tiered
-- recognition), scholarship administration (endow → apply → screen →
-- disburse), ledger publishing (period snapshots), and tribute metadata on
-- donations. All flows write to the one ledger (rail 5).

ALTER TABLE ledger_entries
  ADD COLUMN tribute_name text,
  ADD COLUMN tribute_kind text CHECK (tribute_kind IN ('memory','honor','birthday'));

CREATE TABLE p2p_fundraisers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id  uuid NOT NULL REFERENCES instances(id),
  creator_id   uuid NOT NULL REFERENCES members(id),
  title        text NOT NULL,
  story        text,
  goal_minor   bigint NOT NULL,
  currency     text NOT NULL,
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','approved','rejected','closed')),
  decided_by   uuid REFERENCES members(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pledges (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id  uuid NOT NULL REFERENCES instances(id),
  member_id    uuid NOT NULL REFERENCES members(id),
  campaign_id  uuid REFERENCES campaigns(id),
  amount_minor bigint NOT NULL,
  currency     text NOT NULL,
  status       text NOT NULL DEFAULT 'promised'
               CHECK (status IN ('promised','fulfilled','written_off')),
  promised_at  timestamptz NOT NULL DEFAULT now(),
  due_date     date,
  fulfilled_entry uuid REFERENCES ledger_entries(id)
);

CREATE TABLE reimbursements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id   uuid NOT NULL REFERENCES instances(id),
  submitted_by  uuid NOT NULL REFERENCES members(id),
  amount_minor  bigint NOT NULL,
  currency      text NOT NULL,
  memo          text NOT NULL,
  receipt_media uuid REFERENCES media(id),
  status        text NOT NULL DEFAULT 'submitted'
                CHECK (status IN ('submitted','approved','rejected','paid')),
  decided_by    uuid REFERENCES members(id),
  decided_at    timestamptz,
  paid_entry    uuid,                       -- set after ledger_entries exists (below)
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sponsorships (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id  uuid NOT NULL REFERENCES instances(id),
  sponsor_name text NOT NULL,
  contact      text,
  tier         text NOT NULL DEFAULT 'bronze'
               CHECK (tier IN ('bronze','silver','gold')),
  amount_minor bigint NOT NULL,
  currency     text NOT NULL,
  recognition  text,                       -- where the sponsor is celebrated
  status       text NOT NULL DEFAULT 'pledged'
               CHECK (status IN ('pledged','received')),
  ledger_entry uuid,
  recorded_by  uuid NOT NULL REFERENCES members(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE scholarships (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id   uuid NOT NULL REFERENCES instances(id),
  name          text NOT NULL,
  description   text,
  endowed_minor bigint NOT NULL DEFAULT 0,
  currency      text NOT NULL,
  status        text NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','screening','closed')),
  created_by    uuid NOT NULL REFERENCES members(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE scholarship_applications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id   uuid NOT NULL REFERENCES instances(id),
  scholarship_id uuid NOT NULL REFERENCES scholarships(id),
  student_name  text NOT NULL,
  student_class text,
  statement     text NOT NULL,
  submitted_by  uuid NOT NULL REFERENCES members(id),
  status        text NOT NULL DEFAULT 'submitted'
                CHECK (status IN ('submitted','screening','selected','rejected','disbursed')),
  disbursed_minor bigint,
  decided_by    uuid REFERENCES members(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scholarship_id, student_name)
);

-- Published ledger snapshots (mvp §7: downloadable financial reports).
CREATE TABLE money_publications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  period      text NOT NULL,
  totals      jsonb NOT NULL,
  row_count   integer NOT NULL,
  published_by uuid NOT NULL REFERENCES members(id),
  published_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ledger_entries ADD COLUMN p2p_id uuid REFERENCES p2p_fundraisers(id);

CREATE INDEX idx_p2p_instance ON p2p_fundraisers(instance_id, status);
CREATE INDEX idx_pledges_member ON pledges(instance_id, member_id);
CREATE INDEX idx_reimbursements_status ON reimbursements(instance_id, status);
CREATE INDEX idx_scholarships_instance ON scholarships(instance_id);
