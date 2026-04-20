import OpenAI from "openai";
import { ChatParam } from "./types";

export const MODEL = "gemma4:e2b";

class Client {
  client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      baseURL: process.env.AGENT_HOST,
      apiKey: "lm-studio",
    });
  }

  async chat({
    model = MODEL,
    messages = [],
    temperature = 0.1,
    effort = "medium",
    format,
  }: ChatParam) {
    return await this.client.chat.completions.create({
      model,
      messages,
      temperature,
      reasoning_effort: effort,
      response_format: format,
    });
  }
}

export default Client;
