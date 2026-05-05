import { chatMessages } from "../../../client/client";
import { Tool } from "../types";

export const generateContentTool: Tool = {
  definition: {
    name: "generate_content",
    description:
      "Generates various types of written content such as documents, reports, articles, and novels based on a given topic and options.",

    intents: ["generate"],

    tags: ["content", "writing", "text-generation"],

    parameters: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["document", "report", "article", "novel"],
        },
        topic: {
          type: "string",
          description: "Main topic or subject of the content.",
        },
        tone: {
          type: "string",
          enum: ["neutral", "formal", "casual", "storytelling"],
        },
        audience: {
          type: "string",
          description: "Target audience (optional).",
        },
        length: {
          type: "string",
          enum: ["short", "medium", "long"],
        },
        language: {
          type: "string",
          description: "Output language.",
        },
        constraints: {
          type: "array",
          items: { type: "string" },
          description: "Optional constraints or requirements.",
        },
      },
      required: ["type", "topic"],
    },
  },

  execute: async (args: any) => {
    const {
      type,
      topic,
      tone = "neutral",
      audience,
      length = "medium",
      language = "English",
      constraints = [],
    } = args;

    // 🔹 1. type별 Prompt 분기
    const typeInstructionMap: Record<string, string> = {
      document: "Write a well-structured document with clear sections.",
      report:
        "Write a formal report including summary, analysis, and conclusion.",
      article:
        "Write an engaging and readable article suitable for a blog or publication.",
      novel:
        "Write a creative and immersive narrative with storytelling elements.",
    };

    const typeInstruction =
      typeInstructionMap[type] || "Write high-quality structured content.";

    // 🔹 2. length 가이드
    const lengthGuideMap: Record<string, string> = {
      short: "Keep it concise.",
      medium: "Provide moderate detail.",
      long: "Provide detailed and comprehensive content.",
    };

    const lengthGuide = lengthGuideMap[length] || "";

    // 🔹 3. constraints 문자열화
    const constraintText =
      constraints.length > 0
        ? `Constraints:\n- ${constraints.join("\n- ")}`
        : "";

    // 🔹 4. Prompt 구성
    const prompt = `
You are a professional writer.

Task:
${typeInstruction}

Topic:
${topic}

Tone:
${tone}

Audience:
${audience || "General audience"}

Language:
${language}

Length:
${lengthGuide}

${constraintText}

---

Output format (strict JSON):

{
  "title": "string",
  "content": "string",
  "outline": ["string"]
}
`;

    try {
      // 🔹 5. LLM 호출
      const response = await chatMessages([
        {
          role: "system",
          content:
            "You are a highly skilled content generator. Always respond in valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ]);

      const text = response.choices[0]?.message?.content || "{}";

      // 🔹 6. JSON 파싱
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        // fallback
        parsed = {
          title: "",
          content: text,
          outline: [],
        };
      }

      return {
        title: parsed.title || "",
        content: parsed.content || "",
        outline: parsed.outline || [],
        confidence: 0.85,
      };
    } catch (error: any) {
      return {
        title: "",
        content: "",
        outline: [],
        confidence: 0,
        error: error.message,
      };
    }
  },
};
