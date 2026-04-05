import { ENV } from "./env.ts";

type Role = "system" | "user" | "assistant";

type Message = {
  role: Role;
  content: string;
};

type InvokeParams = {
  messages: Message[];
};

type InvokeResult = {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
};

export async function invokeLLM({ messages }: InvokeParams): Promise<InvokeResult> {
  if (!ENV.geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${ENV.geminiApiKey}`,
      },
      body: JSON.stringify({
        model: "gemini-2.0-flash",
        messages,
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `LLM request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
    );
  }

  return (await response.json()) as InvokeResult;
}
