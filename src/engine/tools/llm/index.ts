import simpleResponse from "./simpleResponse";
import generateCode from "./generateCode";
import generateContent from "./generateContent";
import summarize from "./summarize";
import verify from "./verify";
import translate from "./translate";
import { Tool } from "../types";

export const TOOL_LIST: Tool[] = [
  simpleResponse,
  generateCode,
  generateContent,
  summarize,
  verify,
  translate,
];

export {
  simpleResponse,
  generateCode,
  generateContent,
  summarize,
  verify,
  translate,
};
