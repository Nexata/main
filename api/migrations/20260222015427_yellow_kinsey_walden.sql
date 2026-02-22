ALTER TYPE "public"."trace_type" ADD VALUE 'limit_warning';
ALTER TYPE "public"."trace_type" ADD VALUE 'user_deleted';
ALTER TABLE "billable_event" DROP CONSTRAINT "billable_event_bill_id_bill_id_fk";

ALTER TABLE "billable_event" DROP CONSTRAINT "billable_event_user_id_user_id_fk";

ALTER TABLE "billable_event" DROP CONSTRAINT "billable_event_slug_tenant_slug_fk";

ALTER TABLE "file_permission" DROP CONSTRAINT "file_permission_user_id_user_id_fk";

ALTER TABLE "billable_event" ADD CONSTRAINT "billable_event_bill_id_bill_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bill"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "billable_event" ADD CONSTRAINT "billable_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "billable_event" ADD CONSTRAINT "billable_event_slug_tenant_slug_fk" FOREIGN KEY ("slug") REFERENCES "public"."tenant"("slug") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "file_permission" ADD CONSTRAINT "file_permission_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;