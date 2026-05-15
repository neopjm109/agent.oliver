import * as formatTool from "./formatTool";
import * as lintTool from "./lintTool";
import * as runCommandTool from "./runCommand";
import * as runTestTool from "./runTest";
import * as typeCheckTool from "./typeCheckTool";

export const TOOL_LIST = [
  formatTool,
  lintTool,
  runCommandTool,
  runTestTool,
  typeCheckTool,
];

export { formatTool, lintTool, runCommandTool, runTestTool, typeCheckTool };
