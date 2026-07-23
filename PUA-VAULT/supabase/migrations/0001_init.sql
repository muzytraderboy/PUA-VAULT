-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- PROFILES TABLE (admin & user only)
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by authenticated users"
    ON profiles FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert their own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Admins can manage all profiles"
    ON profiles FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- UNIVERSITIES TABLE (Prepared for scaling)
CREATE TABLE universities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    country TEXT DEFAULT 'Nigeria',
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE universities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Universities are viewable by everyone" ON universities FOR SELECT USING (true);

-- DEPARTMENTS TABLE
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id UUID REFERENCES universities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Departments are viewable by everyone" ON departments FOR SELECT USING (true);

-- COURSES TABLE
CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    level INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Courses are viewable by everyone" ON courses FOR SELECT USING (true);

-- DOCUMENTS TABLE (no moderation — auto-approved)
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    type TEXT CHECK (type IN ('exam', 'project', 'material')),
    title TEXT NOT NULL,
    year TEXT,
    semester TEXT,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    downloads_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Everyone can read all documents (public access)
CREATE POLICY "Public can read all documents"
    ON documents FOR SELECT
    USING (true);

-- Only admins can upload
CREATE POLICY "Admins can upload documents"
    ON documents FOR INSERT
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Only admins can update documents
CREATE POLICY "Admins can update documents"
    ON documents FOR UPDATE
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Only admins can delete documents
CREATE POLICY "Admins can delete documents"
    ON documents FOR DELETE
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Admins can manage any document
CREATE POLICY "Admins can manage all documents"
    ON documents FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Storage bucket and policies (bucket name: 'documents')
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

CREATE POLICY "Public can read document files"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'documents');

CREATE POLICY "Admins can upload document files"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'documents'
        AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can update document files"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'documents'
        AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
    WITH CHECK (
        bucket_id = 'documents'
        AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can delete document files"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'documents'
        AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
