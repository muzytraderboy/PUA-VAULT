-- Seed data for Phoenix University Agwada

INSERT INTO universities (id, name, country) 
VALUES ('11111111-1111-1111-1111-111111111111', 'Phoenix University Agwada', 'Nigeria')
ON CONFLICT (id) DO NOTHING;

INSERT INTO departments (id, university_id, name, code) VALUES 
('22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111111', 'Arts, Social and Management Sciences', 'ASM'),
('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Computing and Technology', 'CMP'),
('22222222-2222-2222-2222-222222222223', '11111111-1111-1111-1111-111111111111', 'Natural, Applied Sciences and Agriculture', 'NSA'),
('22222222-2222-2222-2222-222222222224', '11111111-1111-1111-1111-111111111111', 'Law', 'LAW')
ON CONFLICT (code) DO NOTHING;

-- Arts, Social and Management Sciences
INSERT INTO courses (department_id, code, title, level) VALUES
('22222222-2222-2222-2222-222222222221', 'ACC', 'Accounting', 100),
('22222222-2222-2222-2222-222222222221', 'BNK', 'Banking and Finance', 100),
('22222222-2222-2222-2222-222222222221', 'BUS', 'Business Administration', 100),
('22222222-2222-2222-2222-222222222221', 'PUB', 'Public Administration', 100),
('22222222-2222-2222-2222-222222222221', 'ENT', 'Entrepreneurship and Innovation', 100),
('22222222-2222-2222-2222-222222222221', 'PMT', 'Project Management', 100),
('22222222-2222-2222-2222-222222222221', 'ECO', 'Economics', 100),
('22222222-2222-2222-2222-222222222221', 'POL', 'Political Science', 100),
('22222222-2222-2222-2222-222222222221', 'IRD', 'International Relations and Diplomacy', 100)
ON CONFLICT (code) DO NOTHING;

-- Computing and Technology
INSERT INTO courses (department_id, code, title, level) VALUES
('22222222-2222-2222-2222-222222222222', 'CSC', 'Computer Science', 100),
('22222222-2222-2222-2222-222222222222', 'IFS', 'Information System', 100),
('22222222-2222-2222-2222-222222222222', 'CYS', 'Cyber Security', 100),
('22222222-2222-2222-2222-222222222222', 'ICT', 'Information and Communication Technology', 100),
('22222222-2222-2222-2222-222222222222', 'SEN', 'Software Engineering', 100),
('22222222-2222-2222-2222-222222222222', 'AIN', 'Artificial Intelligence', 100),
('22222222-2222-2222-2222-222222222222', 'DSC', 'Data Science', 100),
('22222222-2222-2222-2222-222222222222', 'MTH', 'Mathematics', 100),
('22222222-2222-2222-2222-222222222222', 'STA', 'Statistics', 100)
ON CONFLICT (code) DO NOTHING;

-- Natural, Applied Sciences and Agriculture
INSERT INTO courses (department_id, code, title, level) VALUES
('22222222-2222-2222-2222-222222222223', 'MCB', 'Microbiology', 100),
('22222222-2222-2222-2222-222222222223', 'BCH', 'Biochemistry', 100),
('22222222-2222-2222-2222-222222222223', 'PHY', 'Physics with Electronics', 100),
('22222222-2222-2222-2222-222222222223', 'FSC', 'Forensic Science', 100),
('22222222-2222-2222-2222-222222222223', 'AGR', 'Agriculture', 100),
('22222222-2222-2222-2222-222222222223', 'AGB', 'Agribusiness', 100),
('22222222-2222-2222-2222-222222222223', 'AGE', 'Agricultural Economics', 100)
ON CONFLICT (code) DO NOTHING;

-- Law
INSERT INTO courses (department_id, code, title, level) VALUES
('22222222-2222-2222-2222-222222222224', 'LAW', 'LLB. Law', 100)
ON CONFLICT (code) DO NOTHING;
