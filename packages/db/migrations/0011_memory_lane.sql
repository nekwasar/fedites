-- 0011_memory_lane.sql — Phase 5 batch 1 (phases.md session 5.1).
--
-- Memory Lane: throwback archive (era-organized), yearbook digitization with
-- searchable name entries, on-this-day (computed, no table), hall of fame,
-- memorial pages with condolence book + funeral coordination.
--
-- §P: members upload, admins approve into the official archive. Enterprise
-- bulk path: admins multi-file upload + CSV imports — "every datum in this
-- phase must be admin-uploadable smoothly" (white-label content seeding,
-- configuration.md §7). N1: archived/declined rows persist.
-- Memorial state (§P): approved memorials set members.memorial — no logins,
-- no birthday pushes; content preserved read-only.

CREATE TABLE memory_eras (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  name       text NOT NULL,
  year_from  integer,
  year_to    integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_id, name)
);

-- One table for every Memory Lane artifact: throwback photos, scanned
-- yearbook pages, documents. Kind + era + year make the archive browsable.
CREATE TABLE memory_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  kind        text NOT NULL CHECK (kind IN ('throwback','yearbook_page','document')),
  media_id    uuid NOT NULL REFERENCES media(id),
  era_id      uuid REFERENCES memory_eras(id),
  year        integer,
  caption     text,
  uploaded_by uuid NOT NULL REFERENCES members(id),
  status      text NOT NULL DEFAULT 'approved'
              CHECK (status IN ('pending','approved','declined')),
  decided_by  uuid REFERENCES members(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE yearbooks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  year        integer NOT NULL,
  title       text,
  media_id    uuid REFERENCES media(id),   -- scanned cover/first page
  created_by  uuid NOT NULL REFERENCES members(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_id, year)
);

-- Searchable name entries imported from CSV (one row per alumnus in the book).
CREATE TABLE yearbook_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  yearbook_id uuid NOT NULL REFERENCES yearbooks(id),
  full_name   text NOT NULL,
  section     text,                         -- e.g. house, class, club
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE hall_of_fame (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  member_id   uuid REFERENCES members(id),  -- nullable: honourees may predate the platform
  display_name text NOT NULL,
  citation    text NOT NULL,
  year        integer,
  media_id    uuid REFERENCES media(id),
  created_by  uuid NOT NULL REFERENCES members(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Member request → admin approval (family confirmed by admins, §P).
CREATE TABLE memorial_pages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  member_id   uuid NOT NULL REFERENCES members(id),   -- the deceased member
  requested_by uuid NOT NULL REFERENCES members(id),
  tribute     text,
  status      text NOT NULL DEFAULT 'requested'
              CHECK (status IN ('requested','approved','declined')),
  decided_by  uuid REFERENCES members(id),
  funeral_date date,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memorial_condolences (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  memorial_id uuid NOT NULL REFERENCES memorial_pages(id),
  member_id   uuid NOT NULL REFERENCES members(id),
  message     text NOT NULL,
  attending   boolean NOT NULL DEFAULT false,  -- funeral coordination
  archived_at timestamptz,                     -- moderation (N1)
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_memory_items_instance ON memory_items(instance_id, kind, created_at DESC);
CREATE INDEX idx_yearbook_entries_name ON yearbook_entries(instance_id, full_name);
CREATE INDEX idx_yearbook_entries_book ON yearbook_entries(yearbook_id);
CREATE INDEX idx_memorials_instance ON memorial_pages(instance_id, status);
