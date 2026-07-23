-- Forum image uploads with OCR-based course code detection

-- Create storage bucket for forum images (public for direct image embedding)
INSERT INTO storage.buckets (id, name, public)
VALUES ('forum-images', 'forum-images', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- RLS for forum-images bucket
CREATE POLICY "Anyone can view forum image files"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'forum-images');

CREATE POLICY "Anonymous users can upload forum images"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'forum-images');

CREATE POLICY "Admins can manage forum image files"
    ON storage.objects FOR ALL
    USING (
        bucket_id = 'forum-images'
        AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Add image & OCR columns to discussion tables
ALTER TABLE discussion_threads
    ADD COLUMN IF NOT EXISTS image_url TEXT,
    ADD COLUMN IF NOT EXISTS image_width INTEGER,
    ADD COLUMN IF NOT EXISTS image_height INTEGER,
    ADD COLUMN IF NOT EXISTS detected_course_code TEXT;

ALTER TABLE discussion_posts
    ADD COLUMN IF NOT EXISTS image_url TEXT,
    ADD COLUMN IF NOT EXISTS image_width INTEGER,
    ADD COLUMN IF NOT EXISTS image_height INTEGER,
    ADD COLUMN IF NOT EXISTS detected_course_code TEXT;
