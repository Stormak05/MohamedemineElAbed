CREATE TABLE "score" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"run_id" text NOT NULL,
	"points" integer NOT NULL,
	"seconds" real NOT NULL,
	"hints" integer NOT NULL,
	"errors" integer NOT NULL,
	"pills" integer NOT NULL,
	"sanity" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "score_user_run_idx" ON "score" ("user_id","run_id");--> statement-breakpoint
CREATE INDEX "score_user_points_idx" ON "score" ("user_id","points");--> statement-breakpoint
ALTER TABLE "score" ADD CONSTRAINT "score_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;