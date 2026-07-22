-- Ensure all public lookup tables have proper RLS policies (allow read for everyone, admins can manage)
DROP POLICY IF EXISTS "Universities are viewable by everyone" ON public.universities;
DROP POLICY IF EXISTS "Departments are viewable by everyone" ON public.departments;
DROP POLICY IF EXISTS "Courses are viewable by everyone" ON public.courses;

-- Read policies (everyone can read)
CREATE POLICY "Universities are viewable by everyone" ON public.universities FOR SELECT USING (true);
CREATE POLICY "Departments are viewable by everyone" ON public.departments FOR SELECT USING (true);
CREATE POLICY "Courses are viewable by everyone" ON public.courses FOR SELECT USING (true);

-- Admin management policies
DROP POLICY IF EXISTS "Admins can manage universities" ON public.universities;
DROP POLICY IF EXISTS "Admins can manage departments" ON public.departments;
DROP POLICY IF EXISTS "Admins can manage courses" ON public.courses;

CREATE POLICY "Admins can manage universities" ON public.universities FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can manage departments" ON public.departments FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can manage courses" ON public.courses FOR ALL USING (public.is_admin(auth.uid()));
