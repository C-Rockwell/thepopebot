CREATE TABLE `action_log` (
	`id` text PRIMARY KEY NOT NULL,
	`action_type` text NOT NULL,
	`action_name` text,
	`source` text NOT NULL,
	`trust_level` text,
	`input` text,
	`result` text,
	`status` text DEFAULT 'success' NOT NULL,
	`error` text,
	`duration_ms` integer,
	`metadata` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `anomaly_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`alert_type` text NOT NULL,
	`severity` text NOT NULL,
	`message` text NOT NULL,
	`details` text,
	`acknowledged` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
