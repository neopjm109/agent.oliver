import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: process.env.AGENT_HOST,
  apiKey: "lm-studio",
});
