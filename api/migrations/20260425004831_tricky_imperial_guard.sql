DROP INDEX "credential_unicity";
ALTER TABLE "credential" ADD COLUMN "slug" varchar(16);
UPDATE "credential"
SET "slug" = "user"."slug"
FROM "user"
WHERE "credential"."user_id" = "user"."id";
ALTER TABLE "credential" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "credential" ADD CONSTRAINT "credential_slug_tenant_slug_fk" FOREIGN KEY ("slug") REFERENCES "public"."tenant"("slug") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "credential_unicity" ON "credential" USING btree ("slug","email","provider","scope");
