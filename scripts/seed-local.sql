BEGIN TRANSACTION;

INSERT INTO schedule_versions (effective_from, effective_until, anchor_monday, upper_on_anchor)
SELECT '2026-09-14', '2026-12-31', '2026-09-14', 1
WHERE NOT EXISTS (
  SELECT 1 FROM schedule_versions WHERE effective_from = '2026-09-14' AND anchor_monday = '2026-09-14'
);

INSERT OR IGNORE INTO lesson_templates
  (schedule_version_id, week_type, weekday, period, starts_at, ends_at, subject, lesson_type, teacher, location)
SELECT id, 'upper', 1, 1, '08:30', '09:50', 'Математика', 'лекція', 'Олена Коваль', '201'
FROM schedule_versions WHERE effective_from = '2026-09-14' AND anchor_monday = '2026-09-14';

INSERT OR IGNORE INTO lesson_templates
  (schedule_version_id, week_type, weekday, period, starts_at, ends_at, subject, lesson_type, teacher, location)
SELECT id, 'upper', 1, 2, '10:10', '11:30', 'Українська мова', 'практика', 'Ірина Мельник', '305'
FROM schedule_versions WHERE effective_from = '2026-09-14' AND anchor_monday = '2026-09-14';

INSERT OR IGNORE INTO lesson_templates
  (schedule_version_id, week_type, weekday, period, starts_at, ends_at, subject, lesson_type, teacher, location)
SELECT id, 'upper', 2, 1, '08:30', '09:50', 'Програмування', 'лабораторна', 'Андрій Бондар', 'комп’ютерний клас'
FROM schedule_versions WHERE effective_from = '2026-09-14' AND anchor_monday = '2026-09-14';

INSERT OR IGNORE INTO lesson_templates
  (schedule_version_id, week_type, weekday, period, starts_at, ends_at, subject, lesson_type, teacher, location)
SELECT id, 'upper', 3, 3, '12:00', '13:20', 'Англійська мова', 'практика', 'Марія Шевченко', '114'
FROM schedule_versions WHERE effective_from = '2026-09-14' AND anchor_monday = '2026-09-14';

INSERT OR IGNORE INTO lesson_templates
  (schedule_version_id, week_type, weekday, period, starts_at, ends_at, subject, lesson_type, teacher, location)
SELECT id, 'upper', 4, 2, '10:10', '11:30', 'Історія України', 'семінар', 'Сергій Литвин', '210'
FROM schedule_versions WHERE effective_from = '2026-09-14' AND anchor_monday = '2026-09-14';

INSERT OR IGNORE INTO lesson_templates
  (schedule_version_id, week_type, weekday, period, starts_at, ends_at, subject, lesson_type, teacher, location)
SELECT id, 'upper', 5, 1, '08:30', '09:50', 'Фізика', 'лекція', 'Наталія Романюк', '102'
FROM schedule_versions WHERE effective_from = '2026-09-14' AND anchor_monday = '2026-09-14';

INSERT OR IGNORE INTO lesson_templates
  (schedule_version_id, week_type, weekday, period, starts_at, ends_at, subject, lesson_type, teacher, location)
SELECT id, 'lower', 1, 1, '08:30', '09:50', 'Економіка', 'лекція', 'Вікторія Савчук', '201'
FROM schedule_versions WHERE effective_from = '2026-09-14' AND anchor_monday = '2026-09-14';

INSERT OR IGNORE INTO lesson_templates
  (schedule_version_id, week_type, weekday, period, starts_at, ends_at, subject, lesson_type, teacher, location)
SELECT id, 'lower', 1, 3, '12:00', '13:20', 'Дизайн', 'практика', 'Тарас Гнатюк', 'студія 2'
FROM schedule_versions WHERE effective_from = '2026-09-14' AND anchor_monday = '2026-09-14';

INSERT OR IGNORE INTO lesson_templates
  (schedule_version_id, week_type, weekday, period, starts_at, ends_at, subject, lesson_type, teacher, location)
SELECT id, 'lower', 2, 2, '10:10', '11:30', 'Програмування', 'лабораторна', 'Андрій Бондар', 'комп’ютерний клас'
FROM schedule_versions WHERE effective_from = '2026-09-14' AND anchor_monday = '2026-09-14';

INSERT OR IGNORE INTO lesson_templates
  (schedule_version_id, week_type, weekday, period, starts_at, ends_at, subject, lesson_type, teacher, location)
SELECT id, 'lower', 3, 1, '08:30', '09:50', 'Фізкультура', '', 'Олег Ткаченко', 'спортзал'
FROM schedule_versions WHERE effective_from = '2026-09-14' AND anchor_monday = '2026-09-14';

INSERT OR IGNORE INTO lesson_templates
  (schedule_version_id, week_type, weekday, period, starts_at, ends_at, subject, lesson_type, teacher, location)
SELECT id, 'lower', 4, 3, '12:00', '13:20', 'Правознавство', 'семінар', 'Леся Кравець', '210'
FROM schedule_versions WHERE effective_from = '2026-09-14' AND anchor_monday = '2026-09-14';

INSERT OR IGNORE INTO lesson_templates
  (schedule_version_id, week_type, weekday, period, starts_at, ends_at, subject, lesson_type, teacher, location)
SELECT id, 'lower', 5, 2, '10:10', '11:30', 'Мистецтво', 'практика', 'Роман Дяченко', 'актовий зал'
FROM schedule_versions WHERE effective_from = '2026-09-14' AND anchor_monday = '2026-09-14';

INSERT OR IGNORE INTO homework (lesson_template_id, lesson_date, content)
SELECT id, '2026-09-14', 'Повторити формули квадратного рівняння; вправи 4–6.'
FROM lesson_templates
WHERE subject = 'Математика' AND week_type = 'upper' AND weekday = 1 AND period = 1;

COMMIT;
