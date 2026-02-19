CREATE TYPE "public"."bill_source" AS ENUM('periodic', 'plan_change');
ALTER TABLE "bill" ADD COLUMN "source" "bill_source" DEFAULT 'periodic' NOT NULL;