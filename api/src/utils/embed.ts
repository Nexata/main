import { openai } from '@ai-sdk/openai';
import type { EmbeddingModelV2 } from '@ai-sdk/provider';

export const EMBEDDING_DIMENSIONS = 1536;
export const EMBEDDING_SIZE = 768;
export const EMBEDDING_OVERLAP = 94;
export const EMBEDDING_MODEL: EmbeddingModelV2<string> =
	openai.textEmbeddingModel('text-embedding-3-small');
// deepinfra.textEmbeddingModel('BAAI/bge-m3');
