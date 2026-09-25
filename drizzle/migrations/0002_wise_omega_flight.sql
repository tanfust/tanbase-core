CREATE TABLE `attachment` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`project_id` text NOT NULL,
	`user_id` text NOT NULL,
	`r2_key` text NOT NULL,
	`filename` text NOT NULL,
	`size` integer NOT NULL,
	`content_type` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`task_id`,`project_id`,`user_id`) REFERENCES `task`(`id`,`project_id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "attachment_size_check" CHECK("attachment"."size" > 0 and "attachment"."size" <= 10485760)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attachment_r2_key_unique` ON `attachment` (`r2_key`);--> statement-breakpoint
CREATE INDEX `attachment_user_task_created_idx` ON `attachment` (`user_id`,`task_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `attachment_user_project_idx` ON `attachment` (`user_id`,`project_id`);