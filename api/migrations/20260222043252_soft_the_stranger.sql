CREATE TYPE "public"."finish_reason" AS ENUM('complete', 'stopped', 'error', 'length');
ALTER TABLE "message" ADD COLUMN "finish_reason" "finish_reason";