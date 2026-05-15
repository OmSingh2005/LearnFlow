import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GlassCard } from "@/components/glass-card";
import { createSession } from "@/lib/sessions.functions";
import { generateRoadmap } from "@/lib/roadmap.functions";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sessions/new")({
  head: () => ({ meta: [{ title: "New session — LearnFlow" }] }),
  component: NewSession,
});

function NewSession() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const create = useServerFn(createSession);
  const genRoadmap = useServerFn(generateRoadmap);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "", topic: "", target_role: "", domain: "", objective: "",
    difficulty: "intermediate" as "beginner" | "intermediate" | "advanced",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.topic) return toast.error("Title and topic are required");
    setLoading(true);
    try {
      const session = await create({ data: form });
      toast.success("Session created — generating roadmap…");
      try {
        await genRoadmap({ data: { session_id: session.id } });
      } catch (err: any) {
        toast.error(`Roadmap generation: ${err.message}`);
      }
      qc.invalidateQueries({ queryKey: ["sessions"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      navigate({ to: "/sessions/$id", params: { id: session.id } });
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  };

  const input = "w-full rounded-lg border border-border bg-card/40 px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary";

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Start a new learning session</h1>
      <p className="mt-1 text-sm text-muted-foreground">Tell us what you're learning. We'll generate a personalized roadmap.</p>

      <GlassCard className="mt-8 p-7">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">Session title</label>
            <input className={input} placeholder="e.g. ML Interview Prep" value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">Topic</label>
            <input className={input} placeholder="e.g. Transformers and attention mechanisms" value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">Target role</label>
              <input className={input} placeholder="ML Engineer" value={form.target_role}
                onChange={(e) => setForm({ ...form, target_role: e.target.value })} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">Domain</label>
              <input className={input} placeholder="Healthcare" value={form.domain}
                onChange={(e) => setForm({ ...form, domain: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">Learning objective</label>
            <textarea rows={3} className={input} placeholder="What do you want to be able to do at the end?"
              value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">Difficulty</label>
            <div className="flex gap-2">
              {(["beginner", "intermediate", "advanced"] as const).map((d) => (
                <button key={d} type="button" onClick={() => setForm({ ...form, difficulty: d })}
                  className={`rounded-lg border px-4 py-2 text-sm capitalize ${form.difficulty === d ? "border-primary gradient-brand-soft" : "border-border hover:bg-accent"}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <button disabled={loading}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg gradient-brand px-5 py-3 font-medium text-primary-foreground shadow-glow disabled:opacity-60">
            <Sparkles className="h-4 w-4" />
            {loading ? "Creating…" : "Create session & generate roadmap"}
          </button>
        </form>
      </GlassCard>
    </div>
  );
}
