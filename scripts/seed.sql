INSERT OR IGNORE INTO project (id, user_id, name, created_at)
VALUES ('local-project-inbox', 'local-user', 'Inbox', 0);

INSERT OR IGNORE INTO task (
  id,
  project_id,
  user_id,
  parent_id,
  title,
  notes,
  status,
  position,
  due_at,
  reminder_sent_at,
  created_at,
  updated_at
)
VALUES (
  'local-task-welcome',
  'local-project-inbox',
  'local-user',
  NULL,
  'Explore TanBase Core',
  'Local seed data is safe to recreate.',
  'todo',
  0,
  NULL,
  NULL,
  0,
  0
);
