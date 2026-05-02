import { zodResponseFormat } from "openai/helpers/zod.js";
import { AgentState, Summarizer } from "../types";
import { SummarizerSchema } from "../schemas";
import Client from "../../client/client";

const summarizerNode = async (
  client: Client,
  state: AgentState,
): Promise<Summarizer> => {
  const now = new Date();
  const response = await client.chat({
    messages: [
      { role: "system", content: "" },
      { role: "user", content: "" },
    ],
    format: zodResponseFormat(SummarizerSchema, "summarizer_schema"),
  });

  console.log("----------");
  console.log(response.choices[0].message?.content);
  console.log("----------");

  const summarize: any = JSON.parse(response.choices[0].message?.content!!);
  const usage = response.usage;

  return {
    answer: summarize.answer,
    thought: summarize.thought,
    tokenUsage: {
      promptTokens: usage?.prompt_tokens || 0,
      completionTokens: usage?.completion_tokens || 0,
      totalTokens: usage?.total_tokens || 0,
    },
    duration: now.getTime() - new Date().getTime(),
    completedAt: new Date(),
  };
};

export default summarizerNode;
