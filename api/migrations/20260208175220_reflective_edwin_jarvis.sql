CREATE TYPE "public"."language" AS ENUM('en', 'es');
ALTER TABLE "user" ADD COLUMN "language" "language" DEFAULT 'en' NOT NULL;