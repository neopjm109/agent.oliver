import OpenAI from "openai";
import type {
  ChatCompletionMessage,
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionToolChoiceOption,
} from "openai/resources/chat/completions";
import type { Config } from "./config.js";

/**
 * OpenAI 호환 채팅 완성 클라이언트 래퍼.
 * Ollama / LM Studio / vLLM / OpenAI 등 어떤 호환 엔드포인트든 baseURL 로 지정.
 */
export class LLM {
  private client: OpenAI;
  constructor(private config: Config) {
    this.client = new OpenAI({
      baseURL: config.baseURL,
      apiKey: config.apiKey,
      timeout: config.timeoutMs,
      maxRetries: config.maxRetries,
      // Node 네이티브 fetch(undici) 사용. 기본 node-fetch 는 일부 로컬 서버(LM Studio 등)의
      // SSE 스트림에서 "Premature close" 를 던지므로 교체한다.
      fetch: globalThis.fetch,
    });
  }

  /**
   * 도구를 붙여 한 번의 채팅 완성을 요청한다 (비스트리밍).
   * toolChoice 를 주면 도구 선택 방식을 강제한다(기본 "auto"). 특정 도구 강제 호출에 사용.
   */
  async complete(
    messages: ChatCompletionMessageParam[],
    tools: ChatCompletionTool[],
    toolChoice?: ChatCompletionToolChoiceOption,
  ): Promise<ChatCompletionMessage> {
    const res = await this.client.chat.completions.create({
      model: this.config.model,
      messages,
      tools: tools.length ? tools : undefined,
      tool_choice: tools.length ? (toolChoice ?? "auto") : undefined,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
    });
    return res.choices[0].message;
  }

  /**
   * 스트리밍 채팅 완성. 텍스트 토큰은 onToken 으로 흘려보내고,
   * tool_call 델타는 누적한 뒤, 완성된 assistant 메시지를 반환한다.
   */
  async completeStream(
    messages: ChatCompletionMessageParam[],
    tools: ChatCompletionTool[],
    onToken: (delta: string) => void,
  ): Promise<ChatCompletionMessage> {
    const stream = await this.client.chat.completions.create({
      model: this.config.model,
      messages,
      tools: tools.length ? tools : undefined,
      tool_choice: tools.length ? "auto" : undefined,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      stream: true,
    });

    let content = "";
    // index 로 식별되는 tool_call 조각들을 누적
    const toolCalls: {
      id: string;
      name: string;
      args: string;
    }[] = [];

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;
      if (delta.content) {
        content += delta.content;
        onToken(delta.content);
      }
      for (const tc of delta.tool_calls ?? []) {
        const i = tc.index;
        toolCalls[i] ??= { id: "", name: "", args: "" };
        if (tc.id) toolCalls[i].id = tc.id;
        if (tc.function?.name) toolCalls[i].name = tc.function.name;
        if (tc.function?.arguments) toolCalls[i].args += tc.function.arguments;
      }
    }

    const assembled: ChatCompletionMessage = {
      role: "assistant",
      content: content || null,
      refusal: null,
    } as ChatCompletionMessage;

    const built = toolCalls.filter((t) => t.name);
    if (built.length) {
      assembled.tool_calls = built.map((t) => ({
        id: t.id,
        type: "function" as const,
        function: { name: t.name, arguments: t.args },
      }));
    }
    return assembled;
  }
}

export type { ChatCompletionMessageParam, ChatCompletionTool, ChatCompletionToolChoiceOption };
