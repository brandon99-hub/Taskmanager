ALTER TYPE "public"."prospect_stage" ADD VALUE 'lost';--> statement-breakpoint
CREATE TABLE "marketing_lost_projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_name" varchar(255) NOT NULL,
	"sector" varchar(100) DEFAULT 'Unknown' NOT NULL,
	"product" varchar(100) DEFAULT 'Service' NOT NULL,
	"revenue" numeric(12, 2),
	"expected_quarter" varchar(10) DEFAULT 'Q1' NOT NULL,
	"comments" text,
	"marketer_id" varchar NOT NULL,
	"contact_person" varchar(200),
	"contact_number" varchar(20),
	"contact_email" varchar(255),
	"lost_reason" text NOT NULL,
	"lost_date" timestamp DEFAULT now() NOT NULL,
	"can_revive" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "marketing_lost_projects_marketer_id_idx" ON "marketing_lost_projects" USING btree ("marketer_id");--> statement-breakpoint
CREATE INDEX "marketing_lost_projects_lost_date_idx" ON "marketing_lost_projects" USING btree ("lost_date");