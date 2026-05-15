import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiChat, type ChatMsg } from "./ai.server";

const MAX_DOUBT_HISTORY = 10;
const STUDY_CONTEXT_LIMIT = 6;

export const listDoubtMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ session_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("doubt_messages").select("id, role, content, topic_key, created_at")
      .eq("session_id", data.session_id).order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const clearDoubts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ session_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("doubt_messages").delete().eq("session_id", data.session_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendDoubtMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    session_id: z.string().uuid(),
    content: z.string().min(1).max(2000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: session } = await context.supabase
      .from("learning_sessions").select("*").eq("id", data.session_id).single();
    if (!session) throw new Error("Session not found");
    const { data: rm } = await context.supabase
      .from("roadmaps").select("structure").eq("session_id", data.session_id).maybeSingle();
    const structure = rm?.structure as any;

    let topicTitle: string | null = null;
    if (structure && session.current_topic_key) {
      for (const p of structure.phases ?? [])
        for (const t of p.topics ?? []) if (t.key === session.current_topic_key) topicTitle = t.title;
    }

    // READ-ONLY snapshot of recent study messages — provides context, not modified
    const { data: studyCtx } = await context.supabase
      .from("study_messages").select("role, content")
      .eq("session_id", data.session_id).order("created_at", { ascending: false }).limit(STUDY_CONTEXT_LIMIT);
    const studyDigest = (studyCtx ?? []).reverse()
      .map((m) => `${m.role === "user" ? "Learner" : "Tutor"}: ${m.content.slice(0, 400)}`)
      .join("\n---\n") || "No prior study messages.";

    // store the user's doubt
    await context.supabase.from("doubt_messages").insert({
      session_id: data.session_id, role: "user", content: data.content, topic_key: session.current_topic_key,
    });

    const { data: doubtHist } = await context.supabase
      .from("doubt_messages").select("role, content")
      .eq("session_id", data.session_id).order("created_at", { ascending: false }).limit(MAX_DOUBT_HISTORY);

    const sys: ChatMsg = {
      role: "system",
      content: `You are answering an isolated learner doubt. You inherit the study context below as READ-ONLY background — answer ONLY the asked question, concisely and surgically. Do NOT continue the lecture, do NOT advance the roadmap, do NOT introduce new topics unless directly required to clear the doubt.

Topic: ${session.topic} | Focus: ${topicTitle ?? "general"} | Level: ${session.difficulty}

--- READ-ONLY STUDY CONTEXT ---
${studyDigest}
--- END CONTEXT ---`,
    };

    const reply = await aiChat([sys, ...((doubtHist ?? []).reverse() as ChatMsg[])]);
    const { data: row, error } = await context.supabase.from("doubt_messages").insert({
      session_id: data.session_id, role: "assistant", content: reply, topic_key: session.current_topic_key,
    }).select("id, role, content, topic_key, created_at").single();
    if (error) throw new Error(error.message);
    return row;
  });
