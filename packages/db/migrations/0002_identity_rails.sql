-- 0002_identity_rails.sql — Phase 1 rails (phases.md sessions 1.1–1.4).
--
-- Auth: passwords (scrypt), optional TOTP 2FA, server-side sessions.
-- Verification: trust-based onboarding state machine on members.verification:
--   pending -> limited (admin activates signup) -> verified (3 setmate vouches
--   or admin override) ; honorary for teachers/staff ; rejected is archived.
-- Vouching leaves no public trace (§P): voucher identity never exposed to members.
-- Privacy (K1): contact details + birthday private by default; visibility JSON.
-- Legacy family links: private by default.
-- All tables carry instance_id (white-label law).

ALTER TABLE members
  ADD COLUMN password_hash  text,
  ADD COLUMN totp_secret    text,
  ADD COLUMN totp_enabled   boolean NOT NULL DEFAULT false,
  ADD COLUMN birthday       date,
  ADD COLUMN photo_url      text,
  ADD COLUMN favorite_memory text,
  ADD COLUMN approved_by    uuid REFERENCES members(id),
  ADD COLUMN approved_at    timestamptz,
  ADD COLUMN rejected_at    timestamptz;

-- Verification status gains 'rejected' (kept, never deleted — N1).
ALTER TABLE members DROP CONSTRAINT members_verification_check;
ALTER TABLE members ADD CONSTRAINT members_verification_check
  CHECK (verification IN ('pending','limited','verified','honorary','rejected'));

CREATE TABLE sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id   uuid NOT NULL REFERENCES instances(id),
  member_id     uuid NOT NULL REFERENCES members(id),
  token_hash    text NOT NULL,
  user_agent    text,
  expires_at    timestamptz NOT NULL,
  revoked_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (token_hash)
);

-- Private legacy family linking (mvp §1: private by default).
CREATE TABLE family_links (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id   uuid NOT NULL REFERENCES instances(id),
  member_id     uuid NOT NULL REFERENCES members(id),
  related_id    uuid NOT NULL REFERENCES members(id),
  relation      text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_id, member_id, related_id)
);

CREATE INDEX idx_sessions_member ON sessions(instance_id, member_id);
CREATE INDEX idx_sessions_token ON sessions(token_hash);
CREATE INDEX idx_family_member ON family_links(instance_id, member_id);
CREATE INDEX idx_members_verification ON members(instance_id, verification);
