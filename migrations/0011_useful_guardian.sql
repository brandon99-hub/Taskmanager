ALTER TABLE "marketing_expected_orders" ADD COLUMN "contact_person" varchar(200);--> statement-breakpoint
ALTER TABLE "marketing_expected_orders" ADD COLUMN "contact_number" varchar(20);--> statement-breakpoint
ALTER TABLE "marketing_expected_orders" ADD COLUMN "contact_email" varchar(255);--> statement-breakpoint
ALTER TABLE "marketing_sales_won" ADD COLUMN "contact_person" varchar(200);--> statement-breakpoint
ALTER TABLE "marketing_sales_won" ADD COLUMN "contact_number" varchar(20);--> statement-breakpoint
ALTER TABLE "marketing_sales_won" ADD COLUMN "contact_email" varchar(255);