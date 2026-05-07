import {
  ReasoningEffort,
  ResponseFormatJSONObject,
  ResponseFormatJSONSchema,
  ResponseFormatText,
} from "openai/resources";

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export type ChatFormat =
  | ResponseFormatText
  | ResponseFormatJSONSchema
  | ResponseFormatJSONObject;

export interface ChatParam {
  model?: string;
  messages: Message[];
  temperature?: number;
  effort?: ReasoningEffort;
  format: ChatFormat;
}
