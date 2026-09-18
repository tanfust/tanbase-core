CREATE TABLE `project` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_id_user_id_unique` ON `project` (`id`,`user_id`);--> statement-breakpoint
CREATE INDEX `project_user_created_idx` ON `project` (`user_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `task` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`user_id` text NOT NULL,
	`parent_id` text,
	`title` text NOT NULL,
	`notes` text,
	`status` text DEFAULT 'todo' NOT NULL,
	`position` real DEFAULT 0 NOT NULL,
	`due_at` integer,
	`reminder_sent_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`,`user_id`) REFERENCES `project`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`,`project_id`,`user_id`) REFERENCES `task`(`id`,`project_id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "task_status_check" CHECK("task"."status" in ('todo', 'doing', 'done'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_id_project_id_user_id_unique` ON `task` (`id`,`project_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `task_user_project_status_position_idx` ON `task` (`user_id`,`project_id`,`status`,`position`);--> statement-breakpoint
CREATE INDEX `task_due_reminder_idx` ON `task` (`due_at`,`reminder_sent_at`);