import * as findFiles from "./find";
import * as readFiles from "./read";
import * as writeFiles from "./write";
import * as editFiles from "./edit";
import * as diffFiles from "./diff";
import * as moveFiles from "./move";

export const TOOL_LIST = [
  findFiles,
  readFiles,
  writeFiles,
  editFiles,
  diffFiles,
  moveFiles,
];

export { findFiles, readFiles, writeFiles, editFiles, diffFiles, moveFiles };
