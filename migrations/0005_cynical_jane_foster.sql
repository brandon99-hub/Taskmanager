CREATE TYPE "public"."marketing_user_role" AS ENUM('admin', 'marketer');--> statement-breakpoint
CREATE TYPE "public"."quarter" AS ENUM('Q1', 'Q2', 'Q3', 'Q4');--> statement-breakpoint
CREATE TYPE "public"."sales_stage" AS ENUM('lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost');--> statement-breakpoint
CREATE TABLE "marketing_annual_summary" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer NOT NULL,
	"sales_executive" varchar(200) NOT NULL,
	"won" numeric(12, 2) DEFAULT '0' NOT NULL,
	"target" numeric(12, 2) NOT NULL,
	"target_achieved" numeric(5, 2) DEFAULT '0' NOT NULL,
	"expected_orders" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status_quo" numeric(12, 2) DEFAULT '0' NOT NULL,
	"deviation_from_target" numeric(12, 2) DEFAULT '0' NOT NULL,
	"sum_sales_expected" numeric(12, 2) DEFAULT '0' NOT NULL,
	"expected_target" numeric(12, 2) DEFAULT '0' NOT NULL,
	"marketer_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "marketing_expected_orders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_name" varchar(200) NOT NULL,
	"sector" varchar(100) NOT NULL,
	"product" varchar(200) NOT NULL,
	"revenue" numeric(12, 2) NOT NULL,
	"expected_quarter" "quarter" NOT NULL,
	"comments" text,
	"marketer_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "marketing_leads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" timestamp NOT NULL,
	"client" varchar(200) NOT NULL,
	"contact_details" text NOT NULL,
	"remarks" text,
	"budget" numeric(12, 2),
	"salesStage" "sales_stage" DEFAULT 'lead' NOT NULL,
	"facilitation_cost" numeric(12, 2),
	"marketer_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "marketing_prospects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_name" varchar(200) NOT NULL,
	"sector" varchar(100) NOT NULL,
	"product" varchar(200) NOT NULL,
	"revenue" numeric(12, 2) NOT NULL,
	"expected_quarter" "quarter" NOT NULL,
	"comments" text,
	"marketer_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "marketing_sales_won" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_name" varchar(200) NOT NULL,
	"sector" varchar(100) NOT NULL,
	"product" varchar(200) NOT NULL,
	"contract_amount" numeric(12, 2) NOT NULL,
	"expected_quarter" "quarter" NOT NULL,
	"comments" text,
	"marketer_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "marketing_users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL,
	"password" varchar NOT NULL,
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"phone_number" varchar,
	"role" "marketing_user_role" DEFAULT 'marketer' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp,
	"reset_token" text,
	"reset_token_expiry" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "unique_year_marketer" ON "marketing_annual_summary" USING btree ("year","marketer_id");--> statement-breakpoint
CREATE INDEX "marketing_users_email_unique" ON "marketing_users" USING btree ("email");