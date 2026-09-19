PRAGMA foreign_keys = ON;

CREATE TABLE schedule_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  effective_from TEXT NOT NULL,
  anchor_monday TEXT NOT NULL,
  upper_on_anchor INTEGER NOT NULL DEFAULT 1 CHECK (upper_on_anchor IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_schedule_versions_effective
  ON schedule_versions(effective_from DESC);

CREATE TABLE lesson_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_version_id INTEGER NOT NULL REFERENCES schedule_versions(id) ON DELETE CASCADE,
  week_type TEXT NOT NULL CHECK (week_type IN ('upper', 'lower')),
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  period INTEGER NOT NULL CHECK (period BETWEEN 1 AND 20),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  subject TEXT NOT NULL,
  lesson_type TEXT NOT NULL DEFAULT '',
  teacher TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  UNIQUE(schedule_version_id, week_type, weekday, period)
);

CREATE INDEX idx_lessons_lookup
  ON lesson_templates(schedule_version_id, week_type, weekday, period);

CREATE TABLE homework (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_template_id INTEGER NOT NULL REFERENCES lesson_templates(id),
  lesson_date TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(lesson_template_id, lesson_date)
);

CREATE INDEX idx_homework_week
  ON homework(lesson_date, lesson_template_id);

CREATE TABLE homework_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  homework_id INTEGER NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_homework_revisions
  ON homework_revisions(homework_id, created_at DESC);

