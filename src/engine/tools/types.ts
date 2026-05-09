// ======================================================
// Tool System (Graph Runtime OS Version)
// ======================================================

import { ActionGraph, ActionNode, RuntimeContext } from "../core/types";

/**
 * ------------------------------------------------------
 * Tool Categories
 * ------------------------------------------------------
 */

export enum ToolCategory {
  FILE_SYSTEM,
  DATABASE,
  WEB,
  LLM,
  EXECUTION,
  ANALYSIS,
  MEMORY,
  SYSTEM,
}

/**
 * ------------------------------------------------------
 * Side Effects
 * ------------------------------------------------------
 */

export enum SideEffect {
  FILE_WRITE = "file_write",
  FILE_DELETE = "file_delete",
  DATABASE_WRITE = "database_write",
  NETWORK_CALL = "network_call",
  PROCESS_EXECUTION = "process_execution",
  MEMORY_UPDATE = "memory_update",
}

/**
 * ------------------------------------------------------
 * Tool Execution Context
 * ------------------------------------------------------
 *
 * ReAct:
 *   execute(args)
 *
 * Graph Runtime:
 *   execute(context)
 *
 */

export interface ToolExecutionContext {
  node: ActionNode;
  graph: ActionGraph;
  runtime: RuntimeContext;
  memory?: {
    shortTerm?: any;
    longTerm?: any;
    retrieved?: any[];
  };
}

/**
 * ------------------------------------------------------
 * Tool Result
 * ------------------------------------------------------
 */

export interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * ------------------------------------------------------
 * Tool Definition
 * ------------------------------------------------------
 */

export interface ToolDefinition {
  name: string;
  description: string;
  category: ToolCategory;
  inputSchema?: any;
  outputSchema?: any;
  capabilities?: string[];
  sideEffects?: SideEffect[];
  retryable?: boolean;
  timeoutMs?: number;
  version?: string;
  tags?: string[];
}

/**
 * ------------------------------------------------------
 * Tool Function
 * ------------------------------------------------------
 */

export type ToolFunction<T = any> = (
  context: ToolExecutionContext
) => Promise<ToolResult<T>>;

/**
 * ------------------------------------------------------
 * Tool Interface
 * ------------------------------------------------------
 */

export interface Tool<T = any> {
  definition: ToolDefinition;
  execute: ToolFunction<T>;
}