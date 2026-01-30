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

ALTER TABLE "file" ADD COLUMN "external_dir_id" uuid;
ALTER TABLE "external_dir" ADD CONSTRAINT "external_dir_credential_id_credential_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."credential"("id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "external_dir_provider_external_id" ON "external_dir" USING btree ("provider","external_id");
ALTER TABLE "file" ADD CONSTRAINT "file_external_dir_id_external_dir_id_fk" FOREIGN KEY ("external_dir_id") REFERENCES "public"."external_dir"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "file" DROP COLUMN "external_parent_id";