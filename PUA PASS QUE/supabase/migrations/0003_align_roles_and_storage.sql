-- Align deployed projects to the Admin/User role model and fix document access.

-- First, make sure the role column exists (add it if missing)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'role'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
    END IF;
END $$;

-- Only update existing lecturer profiles if there are any and the role exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'role'
    ) THEN
        IF EXISTS (SELECT 1 FROM public.profiles WHERE role = 'lecturer') THEN
            UPDATE public.profiles
            SET role = 'user'
            WHERE role = 'lecturer';
        END IF;
    END IF;
END $$;

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('admin', 'user'));

CREATE OR REPLACE FUNCTION public.sanitize_profile_role()
RETURNS trigger
SET search_path = ''
AS $$
BEGIN
    IF NEW.role IS NULL OR NEW.role NOT IN ('admin', 'user') THEN
        NEW.role := 'user';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "Staff can upload documents" ON public.documents;
DROP POLICY IF EXISTS "Admins can upload documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON public.documents;
DROP POLICY IF EXISTS "Admins can update documents" ON public.documents;
DROP POLICY IF EXISTS "Admins can delete documents" ON public.documents;

CREATE POLICY "Admins can upload documents"
    ON public.documents FOR INSERT
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can update documents"
    ON public.documents FOR UPDATE
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can delete documents"
    ON public.documents FOR DELETE
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Insert or update the documents storage bucket safely
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Clean up and recreate storage policies safely
DROP POLICY IF EXISTS "Public can read document files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload document files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update document files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete document files" ON storage.objects;

CREATE POLICY "Public can read document files"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'documents');

CREATE POLICY "Admins can upload document files"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'documents'
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can update document files"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'documents'
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    )
    WITH CHECK (
        bucket_id = 'documents'
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can delete document files"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'documents'
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );
