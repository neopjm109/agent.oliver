import * as excution from "./execution";
import * as files from "./files";
import * as llm from "./llm";
import * as retrieval from "./retrieval";
import { Tool } from "./types";

export const TOOL_LIST: Tool[] = [
  ...excution.TOOL_LIST,
  ...files.TOOL_LIST,
  ...llm.TOOL_LIST,
  ...retrieval.TOOL_LIST,
];

export { excution, files, llm, retrieval };
