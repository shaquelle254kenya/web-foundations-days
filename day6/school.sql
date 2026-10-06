PRAGMA foreign_keys = ON;

-- ============ TABLES ============

CREATE TABLE students (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE
);

CREATE TABLE courses (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  title   TEXT NOT NULL,
  credits INTEGER NOT NULL
);

CREATE TABLE enrolments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  course_id  INTEGER NOT NULL,
  grade      INTEGER,
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (course_id) REFERENCES courses(id),
  UNIQUE (student_id, course_id)
);

-- ============ SAMPLE DATA ============

INSERT INTO students (name, email) VALUES
  ('Amina Wanjiru',  'amina@example.com'),
  ('Brian Otieno',   'brian@example.com'),
  ('Cynthia Achieng', 'cynthia@example.com'),
  ('David Kamau',    'david@example.com');

INSERT INTO courses (title, credits) VALUES
  ('Web Development',   4),
  ('Databases',         3),
  ('Introduction to AI', 3);

INSERT INTO enrolments (student_id, course_id, grade) VALUES
  (1, 1, 85),
  (1, 2, 78),
  (2, 1, 90),
  (2, 3, 70),
  (3, 2, 88),
  (3, 1, 72);

-- ============ QUERIES ============

-- 1. All courses for one student (by name)
SELECT c.title, e.grade
FROM students s
JOIN enrolments e ON e.student_id = s.id
JOIN courses c ON c.id = e.course_id
WHERE s.name = 'Amina Wanjiru';
-- Expected: Web Development (85), Databases (78)

-- 2. All students on one course
SELECT s.name, s.email
FROM courses c
JOIN enrolments e ON e.course_id = c.id
JOIN students s ON s.id = e.student_id
WHERE c.title = 'Web Development';
-- Expected: Amina Wanjiru, Brian Otieno, Cynthia Achieng

-- 3. Number of students per course
SELECT c.title, COUNT(e.id) AS student_count
FROM courses c
LEFT JOIN enrolments e ON e.course_id = c.id
GROUP BY c.id, c.title;
-- Expected: Web Development 3, Databases 2, Introduction to AI 1

-- 4. Students who have no enrolments
SELECT s.name
FROM students s
LEFT JOIN enrolments e ON e.student_id = s.id
WHERE e.id IS NULL;
-- Expected: David Kamau

-- 5. Update one enrolment's grade
UPDATE enrolments
SET grade = 95
WHERE student_id = (SELECT id FROM students WHERE name = 'Brian Otieno')
  AND course_id = (SELECT id FROM courses WHERE title = 'Introduction to AI');

-- Check the update worked
SELECT s.name, c.title, e.grade
FROM enrolments e
JOIN students s ON s.id = e.student_id
JOIN courses c ON c.id = e.course_id
WHERE s.name = 'Brian Otieno';
-- Expected: Web Development (90), Introduction to AI (95)
