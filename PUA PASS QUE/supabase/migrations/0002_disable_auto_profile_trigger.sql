-- Auto-fix invalid roles during profile insert
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

DROP TRIGGER IF EXISTS before_insert_profiles ON public.profiles;
CREATE TRIGGER before_insert_profiles
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sanitize_profile_role();
