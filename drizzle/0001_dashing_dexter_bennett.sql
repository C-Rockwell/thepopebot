CREATE TABLE `memories` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`summary` text,
	`trust_level` text DEFAULT 'user-direct' NOT NULL,
	`salience_score` real DEFAULT 1 NOT NULL,
	`source_type` text DEFAULT 'manual' NOT NULL,
	`source_id` text,
	`tags` text,
	`embedding` blob,
	`created_at` integer NOT NULL,
	`last_accessed_at` integer NOT NULL,
	`decay_at` integer
);
--> statement-breakpoint
CREATE TABLE `memory_audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`memory_id` text NOT NULL,
	`action` text NOT NULL,
	`actor` text NOT NULL,
	`details` text,
	`created_at` integer NOT NULL
);
