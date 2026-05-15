import fs from "fs/promises";
import path from "path";

import { Tool, ToolCategory, ToolExecutionContext, ToolResult } from "../types";

export interface EmbeddingDocument {
  id: string;
  content: string;
  metadata?: Record<string, any>;
  embedding?: number[];
}

export interface EmbeddingRetrievalInput {
  query: string;
  documents?: EmbeddingDocument[];
  topK?: number;
}

export interface EmbeddingRetrievalItem {
  id: string;
  score: number;
  content: string;
  metadata?: Record<string, any>;
}

export interface EmbeddingRetrievalOutput {
  results: EmbeddingRetrievalItem[];
  total: number;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-zA-Z0-9_]+/)
    .filter(Boolean);
}

function buildVector(text: string): Map<string, number> {
  const vector = new Map<string, number>();

  for (const token of tokenize(text)) {
    vector.set(token, (vector.get(token) || 0) + 1);
  }

  return vector;
}

function cosineSimilarity(
  a: Map<string, number>,
  b: Map<string, number>,
): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  const keys = new Set([...a.keys(), ...b.keys()]);

  for (const key of keys) {
    const valueA = a.get(key) || 0;
    const valueB = b.get(key) || 0;

    dot += valueA * valueB;
    normA += valueA * valueA;
    normB += valueB * valueB;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

const embeddingRetrievalTool: Tool<EmbeddingRetrievalOutput> = {
  definition: {
    name: "embeddingRetrieval",

    description:
      "Retrieve semantically similar documents using vector similarity.",

    category: ToolCategory.RETRIEVAL,

    capabilities: [
      "embedding_search",
      "semantic_retrieval",
      "vector_similarity",
    ],

    sideEffects: [],

    retryable: true,

    timeoutMs: 60_000,

    version: "1.0.0",

    tags: ["retrieval", "embedding", "vector"],
  },

  execute: async (
    context: ToolExecutionContext,
  ): Promise<ToolResult<EmbeddingRetrievalOutput>> => {
    try {
      const input = context.node.input as EmbeddingRetrievalInput;

      if (!input?.query) {
        return {
          success: false,
          error: "query is required.",
        };
      }

      if (!input.documents || input.documents.length === 0) {
        return {
          success: false,
          error: "documents is required.",
        };
      }

      const topK = input.topK ?? 5;

      const queryVector = buildVector(input.query);

      const scored: EmbeddingRetrievalItem[] = [];

      for (const document of input.documents) {
        const documentVector = buildVector(document.content);

        const score = cosineSimilarity(queryVector, documentVector);

        scored.push({
          id: document.id,
          score,
          content: document.content,
          metadata: document.metadata,
        });
      }

      scored.sort((a, b) => b.score - a.score);

      const results = scored.slice(0, topK);

      return {
        success: true,
        data: {
          results,
          total: results.length,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Failed to retrieve embeddings.",
      };
    }
  },
};

export default embeddingRetrievalTool;
