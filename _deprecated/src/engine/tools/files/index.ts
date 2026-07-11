import findFiles from "./find";
import readFiles from "./read";
import writeFiles from "./write";
import editFiles from "./edit";
import diffFiles from "./diff";
import moveFiles from "./move";
import { Tool } from "../types";

export const TOOL_LIST: Tool[] = [
  findFiles,
  readFiles,
  writeFiles,
  editFiles,
  diffFiles,
  moveFiles,
];

export { findFiles, readFiles, writeFiles, editFiles, diffFiles, moveFiles };
