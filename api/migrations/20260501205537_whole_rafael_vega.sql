DROP INDEX "chunk_embedding";
ALTER TABLE "chunk" ALTER COLUMN "embedding" SET DATA TYPE vector(2048);
CREATE INDEX "chunk_embedding" ON "chunk" USING hnsw (("embedding"::halfvec(2048)) halfvec_cosine_ops);