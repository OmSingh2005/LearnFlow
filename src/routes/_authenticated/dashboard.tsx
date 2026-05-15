import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, TrendingUp, CheckCircle2, Brain, Target, ArrowRight } from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import { getDashboardAnalytics } from "@/lib/analytics.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — LearnFlow" }] }),
  component: Dashboard,
});

function Dashboard() {
  const fetchAnalytics = useServerFn(getDashboardAnalytics);
  const { data, isLoading } = useQuery({ queryKey: ["analytics"], queryFn: () => fetchAnalytics() });

  const stats = [
    { label: "Active sessions", value: data?.totalSessions ?? 0, icon: Brain },
    { label: "Topics completed", value: data?.completedTopics ?? 0, icon: CheckCircle2 },
    { label: "In progress", value: data?.inProgress ?? 0, icon: Target },
    { label: "Avg quiz score", value: `${data?.avgScore ?? 0}%`, icon: TrendingUp },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Continue learning, or start a new track.</p>
        </div>
        <Link to="/sessions/new" className="inline-flex items-center gap-2 rounded-lg gradient-brand px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow">
          <Plus className="h-4 w-4" /> New session
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <GlassCard key={s.label} className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</span>
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-3 text-3xl font-semibold">{isLoading ? "—" : s.value}</div>
          </GlassCard>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <GlassCard className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Continue learning</h2>
            <Link to="/sessions/new" className="text-xs text-muted-foreground hover:text-foreground">+ New</Link>
          </div>
          <div className="mt-4 space-y-2">
            {(data?.recentSessions ?? []).length === 0 && (
              <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
                No sessions yet. Start your first learning track to see it here.
              </div>
            )}
            {(data?.recentSessions ?? []).map((s) => (
              <Link
                key={s.id}
                to="/sessions/$id"
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
            {(data?.weakTop ?? []).length === 0 && (
              <div className="text-xs text-muted-foreground">Take a quiz to surface insights.</div>
            )}
            {(data?.weakTop ?? []).map((w) => (
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
