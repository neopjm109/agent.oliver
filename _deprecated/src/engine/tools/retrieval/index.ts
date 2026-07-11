import { Tool } from "../types";
import chunkFiles from "./chunkFiles";
import embeddingRetrieval from "./embeddingRetrieval";
import grepTool from "./grepTool";
import relevantFiles from "./relevantFiles";
import searchWeb from "./searchWeb";
import summarizeFolder from "./summarizeFolder";

export const TOOL_LIST: Tool[] = [
  chunkFiles,
  embeddingRetrieval,
  grepTool,
  relevantFiles,
  searchWeb,
  summarizeFolder,
];

export {
  chunkFiles,
  embeddingRetrieval,
  grepTool,
  relevantFiles,
  searchWeb,
  summarizeFolder,
};
