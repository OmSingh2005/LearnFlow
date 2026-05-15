import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiChat, type ChatMsg } from "./ai.server";

const MAX_HISTORY = 12;

async function loadSessionContext(supabase: any, session_id: string) {
  const { data: session } = await supabase.from("learning_sessions").select("*").eq("id", session_id).single();
  if (!session) throw new Error("Session not found");
  const { data: rm } = await supabase.from("roadmaps").select("structure").eq("session_id", session_id).maybeSingle();
  return { session, structure: rm?.structure ?? null };
}

function findTopicTitle(structure: any, topic_key: string | null | undefined): string | null {
  if (!structure || !topic_key) return null;
  for (const phase of structure.phases ?? []) {
    for (const t of phase.topics ?? []) if (t.key === topic_key) return t.title;
  }
  return null;
}

export const listStudyMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ session_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("study_messages").select("id, role, content, topic_key, created_at")
      .eq("session_id", data.session_id).order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const sendStudyMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    session_id: z.string().uuid(),
    content: z.string().min(1).max(4000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { session, structure } = await loadSessionContext(context.supabase, data.session_id);
    const topicKey = session.current_topic_key;
    const topicTitle = findTopicTitle(structure, topicKey);

    // store user message
    await context.supabase.from("study_messages").insert({
      session_id: data.session_id, role: "user", content: data.content, topic_key: topicKey,
    });

    // load history
    const { data: history } = await context.supabase
      .from("study_messages").select("role, content")
      .eq("session_id", data.session_id).order("created_at", { ascending: false }).limit(MAX_HISTORY);
    const ordered = (history ?? []).reverse();

    const sys: ChatMsg = {
      role: "system",
      content: `You are an adaptive learning tutor in a structured study workspace.
Topic of study: ${session.topic}
Current focus: ${topicTitle ?? "general overview"}
Target role: ${session.target_role ?? "—"} | Domain: ${session.domain ?? "—"} | Level: ${session.difficulty}
Style: clear, concise, structured. Use markdown headings, bullet points, code blocks where helpful. Build on prior context, suggest next steps, and stay aligned with the roadmap.`,
    };

    const reply = await aiChat([sys, ...(ordered as ChatMsg[])]);
    const { data: assistantRow, error } = await context.supabase.from("study_messages").insert({
      session_id: data.session_id, role: "assistant", content: reply, topic_key: topicKey,
    }).select("id, role, content, topic_key, created_at").single();
    if (error) throw new Error(error.message);

    await context.supabase.from("learning_sessions").update({ updated_at: new Date().toISOString() }).eq("id", data.session_id);
    return assistantRow;
  });
