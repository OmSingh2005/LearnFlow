import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getDashboardAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: sessions }, { data: progress }, { data: results }] = await Promise.all([
      context.supabase.from("learning_sessions").select("id, title, topic, updated_at, current_topic_key").order("updated_at", { ascending: false }),
      context.supabase.from("roadmap_progress").select("session_id, status"),
      context.supabase.from("quiz_results").select("score, total, weak_concepts, created_at, session_id").order("created_at", { ascending: false }).limit(50),
    ]);

    const completedTopics = (progress ?? []).filter((p) => p.status === "completed").length;
    const inProgress = (progress ?? []).filter((p) => p.status === "in_progress").length;
    const totalSessions = sessions?.length ?? 0;
    const avgScore = (results ?? []).length
      ? (results ?? []).reduce((s, r) => s + Number(r.score), 0) / (results ?? []).length
      : 0;

    const weakCounts = new Map<string, number>();
    for (const r of results ?? []) {
      for (const c of r.weak_concepts ?? []) weakCounts.set(c, (weakCounts.get(c) ?? 0) + 1);
    }
    const weakTop = Array.from(weakCounts.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 6).map(([concept, count]) => ({ concept, count }));

    return {
      totalSessions, completedTopics, inProgress,
      avgScore: Math.round(avgScore),
      recentSessions: (sessions ?? []).slice(0, 6),
      weakTop,
      recentResults: (results ?? []).slice(0, 8),
    };
  });
