export type AiProvider = "lovable" | "openai-compatible";

export interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

const AI_PROVIDER = (process.env.AI_PROVIDER ?? "lovable").toLowerCase() as AiProvider;

function normalizeAiGatewayUrl(url?: string) {
  if (!url) return url;
  if (url.startsWith("https://openrouter.ai/v1/chat/completions")) {
    return url.replace("https://openrouter.ai/v1/chat/completions", "https://openrouter.ai/api/v1/chat/completions");
  }
  return url;
}

export const AI_URL =
  normalizeAiGatewayUrl(process.env.AI_GATEWAY_URL) ||
  (AI_PROVIDER === "lovable"
    ? "https://ai.gateway.lovable.dev/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions");

export const DEFAULT_MODEL =
  process.env.AI_MODEL ||
  (AI_PROVIDER === "lovable" ? "google/gemini-2.5-flash" : "gpt-4o-mini");

export const AI_KEY = process.env.AI_API_KEY || process.env.LOVABLE_API_KEY;

export function getToolRequestPayload(tool: ToolDefinition) {
  return {
    tools: [{ type: "function", function: tool }],
    tool_choice: { type: "function", function: { name: tool.name } },
  };
}

export function parseToolArguments(response: any) {
  const message = response?.choices?.[0]?.message;
  if (!message) return null;

  const lovableCall = message?.tool_calls?.[0]?.function?.arguments;
  if (typeof lovableCall === "string") return lovableCall;

  const openAiCall = message?.function_call?.arguments;
  if (typeof openAiCall === "string") return openAiCall;

  return null;
}
