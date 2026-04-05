CREATE TABLE `heritage_sites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`originalId` int NOT NULL,
	`categoryId` varchar(32),
	`name` varchar(255) NOT NULL,
	`era` varchar(255),
	`address` text,
	`type` varchar(128),
	`batch` varchar(32),
	`longitude` double NOT NULL,
	`latitude` double NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `heritage_sites_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `site_introductions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`siteId` int NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `site_introductions_id` PRIMARY KEY(`id`),
	CONSTRAINT `site_introductions_siteId_unique` UNIQUE(`siteId`)
);
--> statement-breakpoint
CREATE INDEX `idx_name` ON `heritage_sites` (`name`);--> statement-breakpoint
CREATE INDEX `idx_batch` ON `heritage_sites` (`batch`);--> statement-breakpoint
CREATE INDEX `idx_type` ON `heritage_sites` (`type`);--> statement-breakpoint
CREATE INDEX `idx_coords` ON `heritage_sites` (`latitude`,`longitude`);