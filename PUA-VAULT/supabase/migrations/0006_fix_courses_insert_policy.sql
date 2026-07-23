-- Add INSERT policy for courses table so admins can create new courses during upload
DROP POLICY IF EXISTS "Admins can insert courses" ON public.courses;

CREATE POLICY "Admins can insert courses"
    ON public.courses FOR INSERT
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );
