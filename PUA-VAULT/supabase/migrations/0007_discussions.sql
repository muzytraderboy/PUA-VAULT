-- Anonymous discussion forum for students

CREATE TABLE discussion_threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
    course_code TEXT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author_identity TEXT NOT NULL,
    author_name TEXT DEFAULT 'Anonymous',
    reply_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE discussion_threads ENABLE ROW LEVEL SECURITY;

CREATE TABLE discussion_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID REFERENCES discussion_threads(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    author_identity TEXT NOT NULL,
    author_name TEXT DEFAULT 'Anonymous',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE discussion_posts ENABLE ROW LEVEL SECURITY;

CREATE TABLE banned_identities (
    identity TEXT PRIMARY KEY,
    reason TEXT,
    banned_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    banned_by UUID REFERENCES profiles(id)
);

ALTER TABLE banned_identities ENABLE ROW LEVEL SECURITY;

-- Function for frontend to check ban status
CREATE OR REPLACE FUNCTION public.is_identity_banned(check_identity TEXT)
RETURNS BOOLEAN
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM banned_identities WHERE identity = check_identity);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for discussion_threads
CREATE POLICY "Anyone can view threads"
    ON discussion_threads FOR SELECT
    USING (true);

CREATE POLICY "Anonymous users can create threads"
    ON discussion_threads FOR INSERT
    WITH CHECK (
        NOT EXISTS (SELECT 1 FROM banned_identities WHERE identity = author_identity)
    );

CREATE POLICY "Admins can manage threads"
    ON discussion_threads FOR ALL
    USING (public.is_admin(auth.uid()));

-- RLS Policies for discussion_posts
CREATE POLICY "Anyone can view posts"
    ON discussion_posts FOR SELECT
    USING (true);

CREATE POLICY "Anonymous users can reply"
    ON discussion_posts FOR INSERT
    WITH CHECK (
        NOT EXISTS (SELECT 1 FROM banned_identities WHERE identity = author_identity)
    );

CREATE POLICY "Admins can manage posts"
    ON discussion_posts FOR ALL
    USING (public.is_admin(auth.uid()));

-- RLS Policies for banned_identities
CREATE POLICY "Admins can view banned identities"
    ON banned_identities FOR SELECT
    USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage banned identities"
    ON banned_identities FOR ALL
    USING (public.is_admin(auth.uid()));

-- Auto-update reply count on threads
CREATE OR REPLACE FUNCTION public.update_thread_reply_count()
RETURNS TRIGGER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE discussion_threads SET reply_count = reply_count + 1 WHERE id = NEW.thread_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE discussion_threads SET reply_count = reply_count - 1 WHERE id = OLD.thread_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_post_insert ON discussion_posts;
CREATE TRIGGER on_post_insert
    AFTER INSERT ON discussion_posts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_thread_reply_count();

DROP TRIGGER IF EXISTS on_post_delete ON discussion_posts;
CREATE TRIGGER on_post_delete
    AFTER DELETE ON discussion_posts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_thread_reply_count();
