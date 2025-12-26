CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE "public"."billable_event_type" AS ENUM('embed', 'storage', 'refill');
CREATE TYPE "public"."oauth_provider" AS ENUM('google', 'microsoft', 'dropbox', 'notion');
CREATE TYPE "public"."oauth_scope" AS ENUM('gmail', 'drive', 'calendar', 'outlook', 'outlook_calendar', 'onedrive', 'dropbox');
CREATE TYPE "public"."file_host" AS ENUM('nexata', 'drive', 'one_drive', 'dropbox');
CREATE TYPE "public"."message_role" AS ENUM('system', 'user', 'assistant', 'tool');
CREATE TABLE "bill" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(32) NOT NULL,
	"created_at" date DEFAULT now() NOT NULL,
	"paid" boolean DEFAULT false NOT NULL
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
	"file_id" uuid,
	"order" integer DEFAULT 1 NOT NULL,
	"text" varchar(768) NOT NULL,
	"embedding" vector(1536),
	CONSTRAINT "chunk_file_id_order_pk" PRIMARY KEY("file_id","order")
);

CREATE TABLE "credential_permission" (
	"credential_id" uuid NOT NULL,
	"user_id" uuid,
	"is_admin" boolean DEFAULT false NOT NULL,
	CONSTRAINT "credential_permission_credential_id_user_id_pk" PRIMARY KEY("credential_id","user_id")
);

CREATE TABLE "credential" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"is_global" boolean DEFAULT false NOT NULL,
	"provider" "oauth_provider" NOT NULL,
	"scope" "oauth_scope"[] DEFAULT ARRAY[]::oauth_scope[] NOT NULL,
	"access_token" varchar(4096) NOT NULL,
	"access_token_expires_at" timestamp NOT NULL,
	"refresh_token" varchar(4096) NOT NULL,
	"refresh_token_expires_at" timestamp NOT NULL,
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

CREATE TABLE "file" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "file_host" DEFAULT 'nexata' NOT NULL,
	"thread_id" uuid,
	"external_id" varchar(256),
	"credential_id" uuid,
	"auto_sync" boolean DEFAULT true NOT NULL,
	"url" varchar,
	"name" varchar(96) NOT NULL,
	"extension" varchar(8),
	"metadata" jsonb,
	"modified_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" "message_role" DEFAULT 'user' NOT NULL,
	"content" jsonb NOT NULL,
	"extra_reason" boolean DEFAULT false NOT NULL,
	"thread_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "tenant" (
	"slug" varchar(16) PRIMARY KEY NOT NULL,
	"display_name" varchar(64),
	"logo_url" varchar,
	"base_bill" integer DEFAULT 20 NOT NULL,
	"message_limit" integer DEFAULT 100 NOT NULL,
	"default_message_limit" integer DEFAULT 100 NOT NULL,
	"used_messages" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "slug_regex" CHECK ("tenant"."slug" ~ '^[a-z0-9]{2,16}$'),
	CONSTRAINT "message_limit" CHECK ("tenant"."message_limit" >= "tenant"."used_messages")
);

CREATE TABLE "thread" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(32) NOT NULL,
	"email" varchar(320) NOT NULL,
	"display_name" varchar(64),
	"pfp_url" varchar,
	"is_admin" boolean DEFAULT false NOT NULL
);

ALTER TABLE "bill" ADD CONSTRAINT "bill_slug_tenant_slug_fk" FOREIGN KEY ("slug") REFERENCES "public"."tenant"("slug") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "billable_event" ADD CONSTRAINT "billable_event_bill_id_bill_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bill"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "billable_event" ADD CONSTRAINT "billable_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "billable_event" ADD CONSTRAINT "billable_event_slug_tenant_slug_fk" FOREIGN KEY ("slug") REFERENCES "public"."tenant"("slug") ON DELETE no action ON UPDATE no action;
ALTER TABLE "chunk" ADD CONSTRAINT "chunk_file_id_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."file"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "credential_permission" ADD CONSTRAINT "credential_permission_credential_id_credential_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."credential"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "credential_permission" ADD CONSTRAINT "credential_permission_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "credential" ADD CONSTRAINT "credential_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "file_permission" ADD CONSTRAINT "file_permission_file_id_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."file"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "file_permission" ADD CONSTRAINT "file_permission_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "file" ADD CONSTRAINT "file_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "file" ADD CONSTRAINT "file_thread_id_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."thread"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "file" ADD CONSTRAINT "file_credential_id_credential_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."credential"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "message" ADD CONSTRAINT "message_thread_id_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."thread"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "thread" ADD CONSTRAINT "thread_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user" ADD CONSTRAINT "user_slug_tenant_slug_fk" FOREIGN KEY ("slug") REFERENCES "public"."tenant"("slug") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "bill_created_at_desc" ON "bill" USING btree ("created_at" desc);
CREATE INDEX "billable_event_created_at_desc" ON "billable_event" USING btree ("created_at" desc);
CREATE INDEX "embeddingIndex" ON "chunk" USING hnsw ("embedding" vector_cosine_ops);
CREATE UNIQUE INDEX "credential_unicity" ON "credential" USING btree ("user_id","provider","scope");
CREATE INDEX "message_created_at_asc" ON "message" USING btree ("created_at" asc);
CREATE INDEX "thread_created_at_desc" ON "thread" USING btree ("created_at" desc);
CREATE INDEX "user_email_lower" ON "user" USING btree (lower("email"));
CREATE UNIQUE INDEX "email_slug" ON "user" USING btree ("email","slug");
