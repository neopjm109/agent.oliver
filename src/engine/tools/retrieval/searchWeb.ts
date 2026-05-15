import {
  SideEffect,
  Tool,
  ToolCategory,
  ToolExecutionContext,
  ToolResult,
} from "../types";

export interface SearchWebInput {
  query: string;
  limit?: number;
  provider?: string;
}

export interface SearchWebItem {
  title: string;
  url: string;
  snippet?: string;
}

export interface SearchWebOutput {
  results: SearchWebItem[];
  total: number;
}

async function searchWithProvider(
  provider: string,
  query: string,
  limit: number,
): Promise<SearchWebItem[]> {
  /**
   * --------------------------------------------------
   * Implement Provider Logic
   * --------------------------------------------------
   *
   * Examples:
   * - Tavily
   * - Serper
   * - Brave Search
   * - Exa
   * - Custom Search API
   */

  console.log(`[searchWeb] provider=${provider} query=${query}`);

  return [];
}

const searchWebTool: Tool<SearchWebOutput> = {
  definition: {
    name: "searchWeb",
    description: "Search the web using external providers.",

    category: ToolCategory.WEB,

    capabilities: ["web_search", "internet_access", "external_retrieval"],

    sideEffects: [SideEffect.NETWORK_CALL],

    retryable: true,

    timeoutMs: 60_000,

    version: "1.0.0",

    tags: ["web", "search"],
  },

  execute: async (
    context: ToolExecutionContext,
  ): Promise<ToolResult<SearchWebOutput>> => {
    try {
      const input = context.node.input as SearchWebInput;

      if (!input?.query) {
        return {
          success: false,
          error: "query is required.",
        };
      }

      const provider = input.provider || "default";

      const limit = input.limit ?? 10;

      const results = await searchWithProvider(provider, input.query, limit);

      return {
        success: true,
        data: {
          results,
          total: results.length,
        },
        metadata: {
          provider,
          query: input.query,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Failed to search web.",
      };
    }
  },
};

export default searchWebTool;
