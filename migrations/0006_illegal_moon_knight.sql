CREATE TABLE "api_request_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"method" varchar(10) NOT NULL,
	"endpoint" varchar(500) NOT NULL,
	"status_code" integer NOT NULL,
	"response_time_ms" integer,
	"request_size_bytes" integer,
	"response_size_bytes" integer,
	"ip_address" varchar(45),
	"user_agent" text,
	"query_params" jsonb,
	"request_body_size" integer,
	"session_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_activity_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"action_type" varchar(50) NOT NULL,
	"resource_type" varchar(50) NOT NULL,
	"resource_id" varchar,
	"resource_name" varchar(255),
	"old_values" jsonb,
	"new_values" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"session_id" varchar(255),
	"request_id" varchar(255),
	"success" boolean DEFAULT true,
	"error_message" text,
	"additional_context" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_events_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"event_category" varchar(50) NOT NULL,
	"description" text NOT NULL,
	"severity" varchar(20) DEFAULT 'info',
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "marketing_users" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "api_request_logs" ADD CONSTRAINT "api_request_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_activity_logs" ADD CONSTRAINT "system_activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_api_logs_user_id" ON "api_request_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_api_logs_method" ON "api_request_logs" USING btree ("method");--> statement-breakpoint
CREATE INDEX "idx_api_logs_endpoint" ON "api_request_logs" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "idx_api_logs_status_code" ON "api_request_logs" USING btree ("status_code");--> statement-breakpoint
CREATE INDEX "idx_api_logs_created_at" ON "api_request_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_activity_logs_user_id" ON "system_activity_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_activity_logs_resource_type" ON "system_activity_logs" USING btree ("resource_type");--> statement-breakpoint
CREATE INDEX "idx_activity_logs_action_type" ON "system_activity_logs" USING btree ("action_type");--> statement-breakpoint
CREATE INDEX "idx_activity_logs_created_at" ON "system_activity_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_activity_logs_resource_id" ON "system_activity_logs" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "idx_activity_logs_success" ON "system_activity_logs" USING btree ("success");--> statement-breakpoint
CREATE INDEX "idx_system_events_type" ON "system_events_logs" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_system_events_category" ON "system_events_logs" USING btree ("event_category");--> statement-breakpoint
CREATE INDEX "idx_system_events_severity" ON "system_events_logs" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "idx_system_events_created_at" ON "system_events_logs" USING btree ("created_at");