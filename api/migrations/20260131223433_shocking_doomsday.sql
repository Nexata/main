CREATE TYPE "public"."feedback_status" AS ENUM('pending', 'in_review', 'wontfix', 'solved');
CREATE TYPE "public"."feedback_type" AS ENUM('bug_report', 'feature_request', 'question', 'other');
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "feedback_type" NOT NULL,
	"status" "feedback_status" DEFAULT 'pending' NOT NULL,
	"comment" varchar(1000) NOT NULL,
	"response" text,
	"file_urls" text[] DEFAULT ARRAY[]::text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"modified_at" timestamp
);

ALTER TABLE "bill" ADD COLUMN "usage_based_billing" boolean DEFAULT false NOT NULL;
ALTER TABLE "tenant" ADD COLUMN "usage_based_billing" boolean DEFAULT false NOT NULL;
ALTER TABLE "tenant" ADD COLUMN "storage_limit" integer DEFAULT 5120 NOT NULL;
ALTER TABLE "tenant" ADD COLUMN "embed_limit" integer DEFAULT 512000000 NOT NULL;
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "feedback_cursor_desc" ON "feedback" USING btree (coalesce("modified_at", "created_at") desc);
