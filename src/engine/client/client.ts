import OpenAI from "openai";
import { ChatFormat, ChatParam } from "./types";

export const MODEL = "gemma4:e2b";

const client = new OpenAI({
  baseURL: process.env.AGENT_HOST || "http://localhost:1234/v1",
  apiKey: "lm-studio",
});

export const chat = async ({
  model = MODEL,
  messages = [],
  temperature = 0.1,
  effort = "medium",
  format,
}: ChatParam) => {
  return await client.chat.completions.create({
    model,
    messages,
    temperature,
    reasoning_effort: effort,
    response_format: format,
  });
};

export const chatInput = async (input: string, format?: ChatFormat) => {
  return await chat({
    messages: [{ role: "user", content: input }],
    format: format || { type: "json_object" },
  });
};
