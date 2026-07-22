-- Fix infinite recursion in profiles RLS policies by creating a SECURITY DEFINER function
-- This function bypasses RLS to safely check if a user is an admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_id AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old policies on profiles table
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

-- Create new, safe policies for profiles table
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR public.is_admin(auth.uid()));

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Admins can manage all profiles"
    ON public.profiles FOR ALL
    USING (public.is_admin(auth.uid()));

-- Update all policies on documents table to use the new function
DROP POLICY IF EXISTS "Public can read all documents" ON public.documents;
DROP POLICY IF EXISTS "Admins can upload documents" ON public.documents;
DROP POLICY IF EXISTS "Admins can update documents" ON public.documents;
DROP POLICY IF EXISTS "Admins can delete documents" ON public.documents;
DROP POLICY IF EXISTS "Admins can manage all documents" ON public.documents;

CREATE POLICY "Public can read all documents"
    ON public.documents FOR SELECT
    USING (true);

CREATE POLICY "Admins can upload documents"
    ON public.documents FOR INSERT
    WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update documents"
    ON public.documents FOR UPDATE
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete documents"
    ON public.documents FOR DELETE
    USING (public.is_admin(auth.uid()));

-- Update storage policies too
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
        AND public.is_admin(auth.uid())
    );

CREATE POLICY "Admins can update document files"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'documents'
        AND public.is_admin(auth.uid())
    )
    WITH CHECK (
        bucket_id = 'documents'
        AND public.is_admin(auth.uid())
    );

CREATE POLICY "Admins can delete document files"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'documents'
        AND public.is_admin(auth.uid())
    );
