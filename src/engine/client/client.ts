import OpenAI from "openai";
import { ChatModel } from "./types";

class Client {
  client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      baseURL: process.env.AGENT_HOST,
      apiKey: "lm-studio",
    });
  }

  async chat({
    model = "",
    messages = [],
    temperature = 0.1,
    reasoning_effort = "medium",
  }: ChatModel) {
    return await this.client.chat.completions.create({
      model,
      messages,
      temperature,
      reasoning_effort,
    });
  }
}

export default Client;
