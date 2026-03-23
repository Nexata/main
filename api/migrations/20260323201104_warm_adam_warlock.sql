CREATE EXTENSION IF NOT EXISTS "vector";

CREATE TYPE "public"."bill_source" AS ENUM('periodic', 'plan_change', 'refill');
CREATE TYPE "public"."billable_event_type" AS ENUM('embed', 'storage', 'message', 'refill');
CREATE TYPE "public"."oauth_provider" AS ENUM('google', 'microsoft', 'dropbox', 'notion');
CREATE TYPE "public"."oauth_scope" AS ENUM('gmail', 'drive', 'calendar', 'outlook', 'microsoft_calendar', 'onedrive', 'dropbox');
CREATE TYPE "public"."feedback_status" AS ENUM('pending', 'in_review', 'wontfix', 'solved');
CREATE TYPE "public"."feedback_type" AS ENUM('bug_report', 'feature_request', 'question', 'other');
CREATE TYPE "public"."file_host" AS ENUM('nexata', 'drive', 'one_drive', 'dropbox');
CREATE TYPE "public"."finish_reason" AS ENUM('complete', 'stopped', 'error', 'length', 'tool_calls');
CREATE TYPE "public"."message_role" AS ENUM('system', 'user', 'assistant', 'tool');
CREATE TYPE "public"."plan" AS ENUM('free', 'personal', 'business', 'pay_as_you_go');
CREATE TYPE "public"."trace_type" AS ENUM('file_ingested', 'file_deleted', 'credential_added', 'credential_removed', 'ingest_failed', 'limit_warning', 'user_deleted');
CREATE TYPE "public"."language" AS ENUM('en', 'es');
CREATE TABLE "bill" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(32) NOT NULL,
	"created_at" date DEFAULT now() NOT NULL,
	"paid" boolean DEFAULT false NOT NULL,
	"amount" numeric NOT NULL,
	"plan" "plan" NOT NULL,
	"source" "bill_source" DEFAULT 'periodic' NOT NULL,
	"months" integer DEFAULT 1 NOT NULL,
	"details" json NOT NULL
);

CREATE TABLE "billable_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "billable_event_type" NOT NULL,
	"consumption" numeric NOT NULL,
	"bill_id" uuid,
	"user_id" uuid,
	"slug" varchar(32),
	"created_at" date DEFAULT now() NOT NULL,
	CONSTRAINT "bill_event_identifiers" CHECK (("billable_event"."user_id" is not null or "billable_event"."slug" is not null))
);

CREATE TABLE "chunk" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"order" integer DEFAULT 1 NOT NULL,
	"text" varchar(768) NOT NULL,
	"embedding" vector(1024) NOT NULL,
	"metadata" jsonb
);

CREATE TABLE "credential" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"email" varchar(320) NOT NULL,
	"provider" "oauth_provider" NOT NULL,
	"scope" "oauth_scope" NOT NULL,
	"is_global" boolean DEFAULT false NOT NULL,
	"access_token" varchar(4096) NOT NULL,
	"access_token_expires_at" timestamp NOT NULL,
	"refresh_token" varchar(4096) NOT NULL,
	"refresh_token_expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "credential_permission" (
	"credential_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	CONSTRAINT "credential_permission_credential_id_user_id_pk" PRIMARY KEY("credential_id","user_id")
);

CREATE TABLE "device" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fingerprint" varchar(36) NOT NULL,
	"user_agent" varchar,
	"user_id" uuid NOT NULL,
	"access_token" varchar(4096) NOT NULL,
	"refresh_token" varchar(4096) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "external_dir" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" varchar NOT NULL,
	"credential_id" uuid NOT NULL,
	"name" varchar(512) NOT NULL,
	"provider" "file_host" NOT NULL,
	"url" varchar,
	"auto_sync" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"modified_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

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

CREATE TABLE "file" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "file_host" DEFAULT 'nexata' NOT NULL,
	"message_id" uuid,
	"external_dir_id" uuid,
	"external_id" varchar,
	"credential_id" uuid,
	"auto_sync" boolean DEFAULT false NOT NULL,
	"url" varchar,
	"name" varchar(96) NOT NULL,
	"type" varchar(256),
	"metadata" jsonb,
	"modified_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "file_permission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"user_id" uuid,
	"email" varchar(320),
	"inferred" boolean DEFAULT false NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	CONSTRAINT "file_permission_user_or_email_exists" CHECK (("file_permission"."user_id" is not null or "file_permission"."email" is not null))
);

CREATE TABLE "message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" "message_role" DEFAULT 'user' NOT NULL,
	"content" jsonb NOT NULL,
	"extra_reason" boolean DEFAULT false NOT NULL,
	"finish_reason" "finish_reason",
	"thread_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "tenant" (
	"slug" varchar(16) PRIMARY KEY NOT NULL,
	"display_name" varchar(64),
	"logo_url" varchar,
	"plan" "plan" DEFAULT 'free' NOT NULL,
	"billing_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_slug_regex" CHECK ("tenant"."slug" ~ '^[a-z0-9]{2,16}$')
);

CREATE TABLE "thread" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "trace" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"type" "trace_type" NOT NULL,
	"metadata" json NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(32) NOT NULL,
	"email" varchar(320) NOT NULL,
	"display_name" varchar(64),
	"pfp_url" varchar,
	"api_key" varchar(255),
	"is_admin" boolean DEFAULT false NOT NULL,
	"language" "language" DEFAULT 'en' NOT NULL
);

ALTER TABLE "bill" ADD CONSTRAINT "bill_slug_tenant_slug_fk" FOREIGN KEY ("slug") REFERENCES "public"."tenant"("slug") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "billable_event" ADD CONSTRAINT "billable_event_bill_id_bill_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bill"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "billable_event" ADD CONSTRAINT "billable_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "billable_event" ADD CONSTRAINT "billable_event_slug_tenant_slug_fk" FOREIGN KEY ("slug") REFERENCES "public"."tenant"("slug") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "chunk" ADD CONSTRAINT "chunk_file_id_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."file"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "credential" ADD CONSTRAINT "credential_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "credential_permission" ADD CONSTRAINT "credential_permission_credential_id_credential_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."credential"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "credential_permission" ADD CONSTRAINT "credential_permission_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "device" ADD CONSTRAINT "device_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "external_dir" ADD CONSTRAINT "external_dir_credential_id_credential_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."credential"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "file" ADD CONSTRAINT "file_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "file" ADD CONSTRAINT "file_message_id_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."message"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "file" ADD CONSTRAINT "file_external_dir_id_external_dir_id_fk" FOREIGN KEY ("external_dir_id") REFERENCES "public"."external_dir"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "file" ADD CONSTRAINT "file_credential_id_credential_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."credential"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "file_permission" ADD CONSTRAINT "file_permission_file_id_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."file"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "file_permission" ADD CONSTRAINT "file_permission_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "message" ADD CONSTRAINT "message_thread_id_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."thread"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "thread" ADD CONSTRAINT "thread_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "trace" ADD CONSTRAINT "trace_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "user" ADD CONSTRAINT "user_slug_tenant_slug_fk" FOREIGN KEY ("slug") REFERENCES "public"."tenant"("slug") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "bill_created_at_desc" ON "bill" USING btree ("created_at" desc);
CREATE INDEX "billable_event_created_at_desc" ON "billable_event" USING btree ("created_at" desc);
CREATE INDEX "chunk_order" ON "chunk" USING btree ("file_id","order");
CREATE INDEX "chunk_embedding" ON "chunk" USING hnsw ("embedding" vector_cosine_ops);
CREATE UNIQUE INDEX "credential_unicity" ON "credential" USING btree ("email","provider","scope");
CREATE UNIQUE INDEX "device_user_fingerprint" ON "device" USING btree ("user_id","fingerprint");
CREATE UNIQUE INDEX "external_dir_provider_external_id" ON "external_dir" USING btree ("provider","external_id");
CREATE INDEX "feedback_cursor_desc" ON "feedback" USING btree (coalesce("modified_at", "created_at") desc);
CREATE UNIQUE INDEX "file_provider_external_id_unique" ON "file" USING btree ("provider","external_id") WHERE "file"."external_id" is not null;
CREATE INDEX "message_created_at_asc" ON "message" USING btree ("created_at" asc);
CREATE INDEX "thread_created_at_desc" ON "thread" USING btree ("created_at" desc);
CREATE INDEX "trace_created_at_desc" ON "trace" USING btree ("created_at" desc);
CREATE INDEX "user_email_lower" ON "user" USING btree (lower("email"));
CREATE UNIQUE INDEX "user_email_slug" ON "user" USING btree ("email","slug");
CREATE INDEX "user_api_key" ON "user" USING btree ("api_key");
CREATE VIEW "public"."credential_access" AS (select "credential"."id", "user"."id" as "user_id", case when "user"."is_admin" = true then 'tenant-admin' when ("credential"."user_id" = "user"."id" or "credential_permission"."is_admin" = true) then 'admin' when "credential_permission"."is_admin" = false then 'read' else 'global' end as "access_level", "owner"."id" as "owner_id", "owner"."email" as "owner_email", "credential"."provider", "credential"."scope", "credential"."email", "credential"."is_global", "credential"."access_token", "credential"."refresh_token", "credential"."access_token_expires_at", "credential"."created_at" from "credential" inner join "user" "owner" on "owner"."id" = "credential"."user_id" inner join "user" on "user"."slug" = "owner"."slug" left join "credential_permission" on ("credential_permission"."credential_id" = "credential"."id" and "credential_permission"."user_id" = "user"."id") where ("user"."is_admin" = true or "credential"."user_id" = "user"."id" or "credential_permission"."user_id" is not null or "credential"."is_global" = true));
