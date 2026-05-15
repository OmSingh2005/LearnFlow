import { AI_KEY, AI_URL, DEFAULT_MODEL, getToolRequestPayload, parseToolArguments } from "./ai.provider";

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export async function aiChat(messages: ChatMsg[], opts?: { model?: string }) {
  const key = AI_KEY;
  if (!key) throw new Error("AI gateway key missing (set AI_API_KEY)");
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: opts?.model ?? DEFAULT_MODEL, messages }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("AI is rate-limited. Please try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage.");
    throw new Error(`AI error (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data?.choices?.[0]?.message?.content as string) ?? "";
}

export async function aiTool<T>(messages: ChatMsg[], tool: {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}, opts?: { model?: string }): Promise<T> {
  const key = AI_KEY;
  if (!key) throw new Error("AI gateway key missing (set AI_API_KEY)");
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts?.model ?? DEFAULT_MODEL,
      messages,
      ...getToolRequestPayload(tool),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("AI is rate-limited. Please try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage.");
    throw new Error(`AI error (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const args = parseToolArguments(data);
  if (!args) throw new Error("AI did not return structured output");
  return JSON.parse(args) as T;
}
