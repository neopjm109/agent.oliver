export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatModel {
  model: string;
  messages: Message[];
  temperature: number;
  reasoning_effort:
    | "none"
    | "minimal"
    | "low"
    | "medium"
    | "high"
    | "xhigh"
    | null;
}
