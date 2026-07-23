-- Support multiple file types in forum (images + documents)
ALTER TABLE discussion_threads
    ADD COLUMN IF NOT EXISTS file_type TEXT;

ALTER TABLE discussion_posts
    ADD COLUMN IF NOT EXISTS file_type TEXT;
