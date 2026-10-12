-- migrate:up
INSERT INTO "MODULE_T" (mod_code, mod_name, mod_programme) VALUES
    ('CT046-3-M', 'Software Engineering Practice', 'BSc (Hons) Software Engineering'),
    ('CT038-3-2', 'Software Project Management', 'BSc (Hons) Software Engineering'),
    ('CT076-3-2', 'Web Application Development', 'BSc (Hons) Software Engineering'),
    ('CT071-3-2', 'Requirements Engineering', 'BSc (Hons) Software Engineering'),
    ('CT044-3-2', 'Algorithms and Data Structures', 'BSc (Hons) Computer Science'),
    ('CT050-3-2', 'Operating Systems', 'BSc (Hons) Computer Science'),
    ('CT060-3-2', 'Computer Networks', 'BSc (Hons) Computer Science'),
    ('CT030-3-2', 'Database Systems', 'BSc (Hons) Computer Science'),
    ('CT058-3-2', 'Artificial Intelligence', 'BSc (Hons) Computer Science'),
    ('CT018-3-1', 'Introduction to Information Systems', 'BSc (Hons) Information Technology'),
    ('CT055-3-2', 'Network Security', 'BSc (Hons) Information Technology'),
    ('CT069-3-2', 'IT Project Management', 'BSc (Hons) Information Technology');

-- migrate:down
DELETE FROM "MODULE_T"
WHERE mod_code IN ('CT046-3-M', 'CT038-3-2', 'CT076-3-2', 'CT071-3-2', 'CT044-3-2', 'CT050-3-2',
                   'CT060-3-2', 'CT030-3-2', 'CT058-3-2', 'CT018-3-1', 'CT055-3-2', 'CT069-3-2');
