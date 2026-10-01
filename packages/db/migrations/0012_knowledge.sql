-- 0012_knowledge.sql — Phase 5 batch 2 (phases.md session 5.2).
--
-- School wiki (collaboratively edited, full revision history — N1 preserved),
-- slang dictionary (crowd-sourced, admin-approved), school history timeline
-- (admin-curated milestones), alumni spotlights (admin-published), and
-- long-form articles (member-written, admin-screened).
-- §P: archive never delete; M5: moderation enforced at the API.

CREATE TABLE wiki_pages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  slug        text NOT NULL,
  title       text NOT NULL,
  created_by  uuid NOT NULL REFERENCES members(id),
  locked      boolean NOT NULL DEFAULT false,   -- admin lock protects the page
  archived_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_id, slug)
);

-- Every edit is a revision; reverting creates a new revision (nothing lost).
CREATE TABLE wiki_revisions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  page_id    uuid NOT NULL REFERENCES wiki_pages(id),
  author_id  uuid NOT NULL REFERENCES members(id),
  body       text NOT NULL,
  note       text,                               -- edit summary
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE slang_terms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  term        text NOT NULL,
  meaning     text NOT NULL,
  example     text,
  submitted_by uuid NOT NULL REFERENCES members(id),
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','approved','declined')),
  decided_by  uuid REFERENCES members(id),
  archived_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_id, term)
);

CREATE TABLE timeline_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  year        integer NOT NULL,
  title       text NOT NULL,
  story       text,
  media_id    uuid REFERENCES media(id),
  created_by  uuid NOT NULL REFERENCES members(id),
  archived_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE spotlights (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  member_id   uuid NOT NULL REFERENCES members(id),   -- honoured alumnus
  interview   text NOT NULL,                          -- Q&A / story body
  status      text NOT NULL DEFAULT 'draft'
              CHECK (status IN ('draft','published','archived')),
  published_at timestamptz,
  created_by  uuid NOT NULL REFERENCES members(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE articles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES instances(id),
  author_id   uuid NOT NULL REFERENCES members(id),
  title       text NOT NULL,
  body        text NOT NULL,
  status      text NOT NULL DEFAULT 'submitted'
              CHECK (status IN ('draft','submitted','published','declined','archived')),
  decided_by  uuid REFERENCES members(id),
  published_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wiki_pages_instance ON wiki_pages(instance_id, slug);
CREATE INDEX idx_wiki_revisions_page ON wiki_revisions(page_id, created_at DESC);
CREATE INDEX idx_slang_instance ON slang_terms(instance_id, status);
CREATE INDEX idx_timeline_instance ON timeline_events(instance_id, year);
CREATE INDEX idx_articles_instance ON articles(instance_id, status);
