-- 0015_career.sql — Phase 5 batch 5 (phases.md session 5.4b).
--
-- Enterprise-grade career rails: job board (alumni-first), applications with
-- a real hiring pipeline, saved jobs, the alumni business directory with
-- reviews, mentor office hours with bookable slots, referral requests, and
-- skill endorsements. All tables carry instance_id; archived not deleted (N1).

CREATE TABLE jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id   uuid NOT NULL REFERENCES instances(id),
  posted_by     uuid NOT NULL REFERENCES members(id),
  title         text NOT NULL,
  company_name  text NOT NULL,
  industry      text,
  city          text,
  country       text,
  employment_type text NOT NULL DEFAULT 'full_time'
                CHECK (employment_type IN ('full_time','part_time','contract','internship','graduate_trainee')),
  work_mode     text NOT NULL DEFAULT 'onsite' CHECK (work_mode IN ('onsite','hybrid','remote')),
  description   text NOT NULL,
  requirements  text,
  salary_min_minor bigint,
  salary_max_minor bigint,
  salary_currency   text,
  salary_period     text CHECK (salary_period IN ('month','year')),
  apply_by      date,
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','archived')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  edited_at     timestamptz
);

CREATE TABLE job_applications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  job_id      uuid NOT NULL REFERENCES jobs(id),
  applicant_id uuid NOT NULL REFERENCES members(id),
  cover_note  text,
  status      text NOT NULL DEFAULT 'submitted'
              CHECK (status IN ('submitted','screening','interview','offer','hired','rejected','withdrawn')),
  decided_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, applicant_id)
);

CREATE TABLE job_saved (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  job_id     uuid NOT NULL REFERENCES jobs(id),
  member_id  uuid NOT NULL REFERENCES members(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, member_id)
);

CREATE TABLE businesses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  owner_id    uuid NOT NULL REFERENCES members(id),
  name        text NOT NULL,
  industry    text NOT NULL,
  description text,
  services    text,
  contact_phone text,
  contact_email text,
  website     text,
  opening_hours text,
  city        text,
  country     text,
  promo_offer text,
  archived_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_id, name)
);

CREATE TABLE business_reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  business_id uuid NOT NULL REFERENCES businesses(id),
  reviewer_id uuid NOT NULL REFERENCES members(id),
  rating      smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     text,
  archived_at timestamptz,                    -- moderation (N1)
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, reviewer_id)
);

CREATE TABLE mentor_profiles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  member_id  uuid NOT NULL REFERENCES members(id),
  expertise  text NOT NULL,
  bio        text,
  default_link text,                           -- standing Meet/Zoom room
  status     text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id)
);

CREATE TABLE mentor_slots (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  mentor_id  uuid NOT NULL REFERENCES members(id),
  starts_at  timestamptz NOT NULL,
  ends_at    timestamptz NOT NULL,
  status     text NOT NULL DEFAULT 'open' CHECK (status IN ('open','booked','completed','cancelled')),
  CHECK (ends_at > starts_at)
);

CREATE TABLE mentor_bookings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  slot_id    uuid NOT NULL REFERENCES mentor_slots(id),
  mentee_id  uuid NOT NULL REFERENCES members(id),
  note       text,
  meeting_url text,                             -- resolved at booking
  status     text NOT NULL DEFAULT 'booked'
             CHECK (status IN ('booked','confirmed','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slot_id)
);

CREATE TABLE referral_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id    uuid NOT NULL REFERENCES instances(id),
  requester_id   uuid NOT NULL REFERENCES members(id),
  target_member_id uuid NOT NULL REFERENCES members(id),
  company        text NOT NULL,
  role           text NOT NULL,
  note           text,
  status         text NOT NULL DEFAULT 'requested'
                 CHECK (status IN ('requested','accepted','declined','fulfilled')),
  responded_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE endorsements (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  member_id  uuid NOT NULL REFERENCES members(id),   -- endorsed
  endorser_id uuid NOT NULL REFERENCES members(id),
  skill      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, skill, endorser_id)
);

CREATE INDEX idx_jobs_board ON jobs(instance_id, status, created_at DESC);
CREATE INDEX idx_apps_job ON job_applications(job_id, status);
CREATE INDEX idx_apps_applicant ON job_applications(instance_id, applicant_id);
CREATE INDEX idx_businesses_dir ON businesses(instance_id, industry);
CREATE INDEX idx_slots_open ON mentor_slots(instance_id, status, starts_at);
CREATE INDEX idx_endorse_member ON endorsements(instance_id, member_id);
