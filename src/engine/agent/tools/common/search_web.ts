import { Tool } from "../types";

export const searchWebTool: Tool = {
  definition: {
    name: "search_web",
    description: "Searches the web for relevant information based on a query.",

    intents: ["search"],

    tags: ["search", "external", "information"],

    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query.",
        },
      },
      required: ["query"],
    },
  },

  execute: async ({ query }) => {
    try {
      // 🔹 실제로는 Google / SerpAPI / Tavily 연결
      const response = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`,
      );

      return {
        results: (await response.json()).data?.RelatedTopics || [],
        success: true,
        confidence: 0.7,
      };
    } catch (error: any) {
      return {
        results: [],
        error: error.message,
        success: false,
        confidence: 0,
      };
    }
  },
};
