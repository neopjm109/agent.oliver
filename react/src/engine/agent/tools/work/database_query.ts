import { Tool } from "../types";

export const databaseQueryTool: Tool = {
  definition: {
    name: "database_query",
    description: "Executes a query on a database and returns the result.",

    intents: ["execute"],

    tags: ["database", "query", "data"],

    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        database: {
          type: "string",
          description: "Database identifier (e.g., mysql, mongodb).",
        },
      },
      required: ["query"],
    },
  },

  execute: async ({ query }) => {
    try {
      //   const [rows] = await pool.query(query);
      const rows: any = [];

      return {
        rows,
        success: true,
        confidence: 0.9,
      };
    } catch (error: any) {
      return {
        rows: [],
        error: error.message,
        success: false,
        confidence: 0,
      };
    }
  },
};
