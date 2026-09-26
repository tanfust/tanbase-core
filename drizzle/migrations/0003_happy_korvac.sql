CREATE TABLE `ai_usage` (
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `day`),
	CONSTRAINT "ai_usage_count_check" CHECK("ai_usage"."count" >= 0)
);
