CREATE TABLE "ranked_run" (
	"id" text PRIMARY KEY,
	"user_id" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"stats" jsonb,
	"published_id" text
);
--> statement-breakpoint
ALTER TABLE "ranked_run" ADD CONSTRAINT "ranked_run_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;