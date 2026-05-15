import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, TrendingUp, CheckCircle2, Brain, Target, ArrowRight } from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import {
  listGuestSessions, listGuestProgress, listGuestResults, type GuestSession,
} from "@/lib/guest-store";

export const Route = createFileRoute("/guest/dashboard")({
  head: () => ({ meta: [{ title: "Guest dashboard — LearnFlow" }] }),
  component: GuestDashboard,
});

function GuestDashboard() {
  const [sessions, setSessions] = useState<GuestSession[]>([]);
  const [stats, setStats] = useState({ totalSessions: 0, completedTopics: 0, inProgress: 0, avgScore: 0 });
  const [weakTop, setWeakTop] = useState<{ concept: string; count: number }[]>([]);

  useEffect(() => {
    const all = listGuestSessions();
    setSessions(all);
    let completed = 0, inProgress = 0;
    const scores: number[] = [];
    const weakCounts = new Map<string, number>();
    for (const s of all) {
      for (const p of listGuestProgress(s.id)) {
        if (p.status === "completed") completed++;
        else if (p.status === "in_progress") inProgress++;
      }
      for (const r of listGuestResults(s.id)) {
        scores.push(r.score);
        for (const c of r.weak_concepts) weakCounts.set(c, (weakCounts.get(c) ?? 0) + 1);
      }
    }
    setStats({
      totalSessions: all.length,
      completedTopics: completed,
      inProgress,
      avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    });
    setWeakTop(Array.from(weakCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([concept, count]) => ({ concept, count })));
  }, []);

  const cards = [
    { label: "Active sessions", value: stats.totalSessions, icon: Brain },
    { label: "Topics completed", value: stats.completedTopics, icon: CheckCircle2 },
    { label: "In progress", value: stats.inProgress, icon: Target },
    { label: "Avg quiz score", value: `${stats.avgScore}%`, icon: TrendingUp },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Welcome, guest</h1>
          <p className="mt-1 text-sm text-muted-foreground">All progress lives in this browser. Sign in anytime to save it.</p>
        </div>
        <Link to="/guest/sessions/new" className="inline-flex items-center gap-2 rounded-lg gradient-brand px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow">
          <Plus className="h-4 w-4" /> New session
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((s) => (
          <GlassCard key={s.label} className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</span>
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-3 text-3xl font-semibold">{s.value}</div>
          </GlassCard>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <GlassCard className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Continue learning</h2>
            <Link to="/guest/sessions/new" className="text-xs text-muted-foreground hover:text-foreground">+ New</Link>
          </div>
          <div className="mt-4 space-y-2">
            {sessions.length === 0 && (
              <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
                No sessions yet. Start your first learning track to see it here.
              </div>
            )}
            {sessions.slice(0, 6).map((s) => (
              <Link
                key={s.id}
                to="/guest/sessions/$id"
                params={{ id: s.id }}
                className="flex items-center justify-between rounded-xl border border-border bg-card/50 px-4 py-3 hover:border-primary/40"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{s.title}</div>
                  <div className="truncate text-xs text-muted-foreground">{s.topic}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <h2 className="text-lg font-semibold">Weak concepts</h2>
          <p className="text-xs text-muted-foreground">Aggregated from your quiz results.</p>
          <div className="mt-4 space-y-2">
            {weakTop.length === 0 && <div className="text-xs text-muted-foreground">Take a quiz to surface insights.</div>}
            {weakTop.map((w) => (
              <div key={w.concept} className="flex items-center justify-between rounded-lg bg-card/40 px-3 py-2 text-sm">
                <span className="truncate">{w.concept}</span>
                <span className="rounded-full gradient-brand-soft px-2 py-0.5 text-xs">{w.count}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
