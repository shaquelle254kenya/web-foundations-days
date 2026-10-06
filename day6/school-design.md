# School Database Design

## Tables

### students
Stores one row for each student.
- `id`: primary key, a unique number for each student
- `name`: the student's full name (required)
- `email`: the student's email (required and UNIQUE, so two students cannot share one)

### courses
Stores one row for each course on offer.
- `id`: primary key
- `title`: the course name (required)
- `credits`: how many credits the course is worth (required)

### enrolments
Stores one row each time a student joins a course. This is the join table.
- `id`: primary key
- `student_id`: foreign key pointing to `students(id)`
- `course_id`: foreign key pointing to `courses(id)`
- `grade`: the student's grade on that course (can be empty until marked)
- `UNIQUE (student_id, course_id)`: stops the same student enrolling on the same course twice

## Relationships

- **One-to-many:** one student can have many enrolments, and one course can have many enrolments. Each enrolment belongs to exactly one student and one course.
- **Many-to-many:** students and courses. A student takes many courses, and a course has many students.
- **Why a join table is needed:** a relational database cannot store a many-to-many link directly in either table. Putting a list of courses inside a student row would break the one-value-per-cell rule, and repeating student rows for every course would duplicate data. The `enrolments` table solves this by storing one row per student-course pair. It is also the natural place to keep the `grade`, because a grade belongs to the pair, not to the student or the course alone.

## Index

I would add an index on `enrolments.student_id`:

```sql
CREATE INDEX idx_enrolments_student_id ON enrolments(student_id);
```

**Reason:** queries such as "all courses for one student" filter by `student_id`. With an index, the database can jump straight to that student's rows instead of scanning the whole enrolments table, which matters as the school grows.

## SQL or NoSQL?

I would choose SQL for this system. School data is highly structured and full of relationships between students, courses and enrolments, and SQL handles these with foreign keys and JOINs. It also protects data accuracy: the UNIQUE email and the rule against double enrolment are enforced by the database itself, and foreign keys stop an enrolment from pointing to a student or course that does not exist. Reports like "number of students per course" are simple with GROUP BY. NoSQL would be a better fit for very large, flexible or rapidly changing data, but a school's records are predictable, so the strict structure of SQL is an advantage here.
