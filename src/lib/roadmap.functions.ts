import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiTool } from "./ai.server";

export type RoadmapTopic = { key: string; title: string; summary: string };
export type RoadmapPhase = {
  key: string;
  title: string;
  goal: string;
  prerequisites: string[];
  topics: RoadmapTopic[];
  milestone: string;
};
export type RoadmapStructure = { overview: string; phases: RoadmapPhase[] };

export const getRoadmap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ session_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const [{ data: rm }, { data: progress }] = await Promise.all([
      context.supabase.from("roadmaps").select("structure, created_at").eq("session_id", data.session_id).maybeSingle(),
      context.supabase.from("roadmap_progress").select("topic_key, status, completed_at").eq("session_id", data.session_id),
    ]);
    return {
      structure: (rm?.structure as RoadmapStructure | null) ?? null,
      progress: progress ?? [],
    };
  });

export const generateRoadmap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ session_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: session, error } = await context.supabase
      .from("learning_sessions").select("*").eq("id", data.session_id).single();
    if (error || !session) throw new Error("Session not found");

    const sys = `You are a senior curriculum designer creating personalized, industry-relevant learning roadmaps. Output structured JSON only via the provided tool. Keep titles concise. 4-6 phases, 3-6 topics per phase. Topic keys must be unique short slugs (kebab-case).`;
    const user = `Create a learning roadmap for:
Topic: ${session.topic}
Target role: ${session.target_role ?? "—"}
Domain: ${session.domain ?? "—"}
Objective: ${session.objective ?? "—"}
Difficulty: ${session.difficulty}

Each phase must have a goal, prerequisites, ordered topics with a 1-sentence summary, and a milestone. Start with an overview paragraph.`;

    const structure = await aiTool<RoadmapStructure>(
      [{ role: "system", content: sys }, { role: "user", content: user }],
      {
        name: "build_roadmap",
        description: "Return a structured learning roadmap.",
        parameters: {
          type: "object",
          properties: {
            overview: { type: "string" },
            phases: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  key: { type: "string" },
                  title: { type: "string" },
                  goal: { type: "string" },
                  prerequisites: { type: "array", items: { type: "string" } },
                  milestone: { type: "string" },
                  topics: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        key: { type: "string" },
                        title: { type: "string" },
                        summary: { type: "string" },
                      },
                      required: ["key", "title", "summary"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["key", "title", "goal", "prerequisites", "milestone", "topics"],
                additionalProperties: false,
              },
            },
          },
          required: ["overview", "phases"],
          additionalProperties: false,
        },
      },
    );

    // upsert
    await context.supabase.from("roadmaps").delete().eq("session_id", data.session_id);
    const { error: insErr } = await context.supabase
      .from("roadmaps").insert({ session_id: data.session_id, structure: structure as any });
    if (insErr) throw new Error(insErr.message);

    // set first topic as current if not set
    const firstTopic = structure.phases[0]?.topics[0]?.key;
    if (firstTopic && !session.current_topic_key) {
      await context.supabase.from("learning_sessions").update({ current_topic_key: firstTopic }).eq("id", data.session_id);
    }
    return { structure };
  });

export const setTopicStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    session_id: z.string().uuid(),
    topic_key: z.string(),
    status: z.enum(["not_started", "in_progress", "completed"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("roadmap_progress").upsert({
      session_id: data.session_id,
      topic_key: data.topic_key,
      status: data.status,
      completed_at: data.status === "completed" ? new Date().toISOString() : null,
    }, { onConflict: "session_id,topic_key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
