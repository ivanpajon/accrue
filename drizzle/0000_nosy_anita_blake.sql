CREATE TABLE `account_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`theme` text DEFAULT 'system' NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`view` text DEFAULT 'growth' NOT NULL,
	`visible` text DEFAULT '{"total":true,"contributed":true,"gains":true}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `configurations` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`configuration` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `configurations_user_name` ON `configurations` (`user_id`,`normalized_name`);