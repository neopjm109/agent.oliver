import { analyzeTool } from "./common/analyze";
import { searchWebTool } from "./common/search_web";
import simpleResponseTool from "./common/simple_response";
import { summarizeTool } from "./common/summarize";
import { translateTool } from "./common/translate";
import { verifyOutputTool } from "./common/verify";
import { listFilesTool } from "./file/list";
import { moveFileTool } from "./file/move";
import { patchFileTool } from "./file/patch";
import { readFileTool } from "./file/read";
import { writeFileTool } from "./file/write";
import { databaseQueryTool } from "./work/database_query";
import { executeCodeTool } from "./work/execute_code";
import { formatMarkdownTool } from "./work/format_markdown";
import { generateCodeTool } from "./work/generate_code";
import { generateContentTool } from "./work/generate_content";
import { runCommandTool } from "./work/run_command";

export const ToolList = [
  simpleResponseTool,
  verifyOutputTool,
  listFilesTool,
  readFileTool,
  writeFileTool,
  moveFileTool,
  patchFileTool,
  analyzeTool,
  summarizeTool,
  translateTool,
  searchWebTool,
  generateContentTool,
  generateCodeTool,
  formatMarkdownTool,
  databaseQueryTool,
  executeCodeTool,
  runCommandTool,
];
