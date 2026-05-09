import * as z from "zod";
import {
  Tool,
  ToolCategory,
  ToolExecutionContext,
  ToolResult,
  SideEffect,
} from "../types";

/**
 * ------------------------------------------------------
 * Schema
 * ------------------------------------------------------
 */

export const DatabaseQuerySchema = z.object({
  query: z
    .string()
    .describe("Database query string to execute"),
  database: z
    .string()
    .optional()
    .describe(
      "Database identifier such as mysql, mariadb, postgres, mongodb, redis",
    ),
});

export type DatabaseQueryInput = z.infer<
  typeof DatabaseQuerySchema
>;

/**
 * ------------------------------------------------------
 * Types
 * ------------------------------------------------------
 */

export interface DatabaseQueryResult {
  database: string;
  query: string;
  rows: any[];
  rowCount: number;
  executionTimeMs?: number;
}

/**
 * ------------------------------------------------------
 * Constants
 * ------------------------------------------------------
 */

export const databaseQueryName = "databaseQueryTool";

/**
 * ------------------------------------------------------
 * Tool
 * ------------------------------------------------------
 */

export const databaseQueryTool: Tool<DatabaseQueryResult> = {
  definition: {
    name: databaseQueryName,
    description:
      "Executes a query against a configured database and returns structured results.",
    category: ToolCategory.DATABASE,
    capabilities: [
      "database_query",
      "sql_execution",
      "nosql_query",
      "data_retrieval",
    ],
    sideEffects: [
      SideEffect.DATABASE_WRITE,
      SideEffect.NETWORK_CALL,
    ],
    retryable: true,
    timeoutMs: 30_000,
    version: "1.0.0",
    tags: [
      "database",
      "query",
      "sql",
      "mongodb",
      "data",
    ],
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Database query string to execute.",
        },
        database: {
          type: "string",
          description:
            "Target database engine or connection identifier.",
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
  ): Promise<ToolResult<DatabaseQueryResult>> {
    const startedAt = Date.now();

    try {
      /**
       * ------------------------------------------------------
       * Extract Input
       * ------------------------------------------------------
       */

      const nodeInput = context.node.input || {};
      const query = nodeInput.query;
      const database = nodeInput.database || "default";

      if (!query) {
        return {
          success: false,
          error: "Missing required input: query",
          metadata: {
            tool: databaseQueryName,
          },
        };
      }

      /**
       * ------------------------------------------------------
       * Database Execution
       * ------------------------------------------------------
       *
       * Replace this section with:
       *
       * - Prisma
       * - TypeORM
       * - Knex
       * - Native MySQL Driver
       * - MongoDB Driver
       * - Redis Client
       *
       */

      let rows: any[] = [];

      /**
       * Example:
       *
       * const [result] = await pool.query(query);
       * rows = result;
       */

      /**
       * ------------------------------------------------------
       * Return Structured Result
       * ------------------------------------------------------
       */

      return {
        success: true,
        data: {
          database,
          query,
          rows,
          rowCount: rows.length,
          executionTimeMs: Date.now() - startedAt,
        },
        metadata: {
          tool: databaseQueryName,
          database,
          rowCount: rows.length,
          executionId: context.runtime.executionId,
          durationMs: Date.now() - startedAt,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error:
          error?.message || "Unknown database execution error",
        metadata: {
          tool: databaseQueryName,
          executionId: context.runtime.executionId,
          durationMs: Date.now() - startedAt,
        },
      };
    }
  },
};