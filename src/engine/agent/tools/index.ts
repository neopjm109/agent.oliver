import { analyzeTool } from "./common/analyze";
import simpleResponseTool from "./common/simple_response";
import { summarizeTool } from "./common/summarize";
import { translateTool } from "./common/translate";
import { listFilesTool } from "./file/list";
import { moveFileTool } from "./file/move";
import { patchFileTool } from "./file/patch";
import { readFileTool } from "./file/read";
import { writeFileTool } from "./file/write";

export const ToolList = [
  simpleResponseTool,
  listFilesTool,
  readFileTool,
  writeFileTool,
  moveFileTool,
  patchFileTool,
  analyzeTool,
  summarizeTool,
  translateTool,
];
