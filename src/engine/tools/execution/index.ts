import { Tool } from "../types";
import formatTool from "./formatTool";
import lintTool from "./lintTool";
import runCommandTool from "./runCommand";
import runTestTool from "./runTest";
import typeCheckTool from "./typeCheckTool";

export const TOOL_LIST: Tool[] = [
  formatTool,
  lintTool,
  runCommandTool,
  runTestTool,
  typeCheckTool,
];

export { formatTool, lintTool, runCommandTool, runTestTool, typeCheckTool };
