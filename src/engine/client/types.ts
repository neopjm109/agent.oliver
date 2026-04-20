import {
  ReasoningEffort,
  ResponseFormatJSONObject,
  ResponseFormatJSONSchema,
  ResponseFormatText
} from "openai/resources";

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatParam {
  model: string;
  messages: Message[];
  temperature: number;
  effort: ReasoningEffort;
  format:
    | ResponseFormatText
    | ResponseFormatJSONSchema
    | ResponseFormatJSONObject;
}
