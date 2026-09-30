-- 0007_tenant_join_tables.sql — close a tenant-insurance gap the schema test
-- caught in CI: join tables created in 0003 carried no instance_id, violating
-- the "instance_id on EVERY table" law (rules.md §P). Backfilled from the
-- parent activity_posts rows, then made NOT NULL with FKs.

ALTER TABLE post_media ADD COLUMN instance_id uuid;
UPDATE post_media SET instance_id = (SELECT p.instance_id FROM activity_posts p WHERE p.id = post_media.post_id);
ALTER TABLE post_media ALTER COLUMN instance_id SET NOT NULL;
ALTER TABLE post_media ADD CONSTRAINT post_media_instance_fk FOREIGN KEY (instance_id) REFERENCES instances(id);

ALTER TABLE poll_options ADD COLUMN instance_id uuid;
UPDATE poll_options SET instance_id = (SELECT p.instance_id FROM activity_posts p WHERE p.id = poll_options.post_id);
ALTER TABLE poll_options ALTER COLUMN instance_id SET NOT NULL;
ALTER TABLE poll_options ADD CONSTRAINT poll_options_instance_fk FOREIGN KEY (instance_id) REFERENCES instances(id);

ALTER TABLE poll_votes ADD COLUMN instance_id uuid;
UPDATE poll_votes SET instance_id = (SELECT p.instance_id FROM activity_posts p WHERE p.id = poll_votes.post_id);
ALTER TABLE poll_votes ALTER COLUMN instance_id SET NOT NULL;
ALTER TABLE poll_votes ADD CONSTRAINT poll_votes_instance_fk FOREIGN KEY (instance_id) REFERENCES instances(id);
