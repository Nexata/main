ALTER TABLE "bill" ALTER COLUMN "created_at" SET DATA TYPE timestamp;
ALTER TABLE "bill" ALTER COLUMN "created_at" SET DEFAULT now();