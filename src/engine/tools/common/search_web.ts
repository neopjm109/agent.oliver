import {
  Tool,
  ToolCategory,
  ToolExecutionContext,
  ToolResult,
  SideEffect,
} from "../types";

/**
 * ------------------------------------------------------
 * Types
 * ------------------------------------------------------
 */

export interface SearchResultItem {
  text?: string;
  firstURL?: string;
  icon?: {
    URL?: string;
  };
  topic?: string;
}

export interface SearchWebResult {
  query: string;
  results: SearchResultItem[];
  totalResults: number;
}

/**
 * ------------------------------------------------------
 * Constants
 * ------------------------------------------------------
 */

export const searchToolName = "searchTool";

/**
 * ------------------------------------------------------
 * Search Web Tool
 * ------------------------------------------------------
 */

export const searchWebTool: Tool<SearchWebResult> = {
  definition: {
    name: searchToolName,
    description:
      "Searches the web for relevant information using external search providers.",
    category: ToolCategory.WEB,
    capabilities: [
      "web_search",
      "information_retrieval",
      "external_lookup",
    ],
    sideEffects: [SideEffect.NETWORK_CALL],
    retryable: true,
    timeoutMs: 15_000,
    version: "1.0.0",
    tags: ["search", "web", "external", "retrieval"],
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query string.",
        },
      },
      required: ["query"],
    },
    outputSchema: {
      type: "object",
    },
  },

  async execute(
    context: ToolExecutionContext,
  ): Promise<ToolResult<SearchWebResult>> {
    try {
      /**
       * ------------------------------------------------------
       * Extract Input
       * ------------------------------------------------------
       */

      const nodeInput = context.node.input || {};
      const query = nodeInput.query;
      if (!query) {
        return {
          success: false,
          error: "Missing required input: query",
          metadata: {
            tool: "search_web",
          },
        };
      }

      /**
       * ------------------------------------------------------
       * Execute Search
       * ------------------------------------------------------
       */

      // NOTE:
      // Replace with:
      // - Tavily
      // - SerpAPI
      // - Brave Search
      // - Custom Search Provider
      //
      // DuckDuckGo Instant Answer API is limited.

      const response = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`,
      );

      if (!response.ok) {
        return {
          success: false,
          error: `Search API failed with status ${response.status}`,
          metadata: {
            tool: "search_web",
            status: response.status,
          },
        };
      }

      const json = await response.json();
      const relatedTopics = json?.RelatedTopics || [];

      /**
       * ------------------------------------------------------
       * Normalize Results
       * ------------------------------------------------------
       */

      const results: SearchResultItem[] = relatedTopics.map((item: any) => ({
        text: item?.Text,
        firstURL: item?.FirstURL,
        icon: item?.Icon,
        topic: item?.Name,
      }));

      /**
       * ------------------------------------------------------
       * Return Structured Result
       * ------------------------------------------------------
       */

      return {
        success: true,
        data: {
          query,
          results,
          totalResults: results.length,
        },
        metadata: {
          tool: "search_web",
          provider: "duckduckgo",
          resultCount: results.length,
          executionId: context.runtime.executionId,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Unknown web search error",
        metadata: {
          tool: "search_web",
          executionId: context.runtime.executionId,
        },
      };
    }
  },
};