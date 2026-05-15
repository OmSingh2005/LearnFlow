import { createFileRoute, Link } from "@tanstack/react-router";
import { Brain, Map, MessageSquare, Sparkles, BarChart3, ArrowRight } from "lucide-react";
import { GlassCard } from "@/components/glass-card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LearnFlow — AI-Powered Adaptive Learning Workspace" },
      { name: "description", content: "Personalized roadmaps, contextual study sessions, isolated doubt resolution, and AI-generated quizzes — your modern AI learning workspace." },
      { property: "og:title", content: "LearnFlow — AI Learning Workspace" },
      { property: "og:description", content: "An adaptive learning workspace powered by AI." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const features = [
    { icon: Map, title: "Personalized roadmaps", desc: "Phased curriculum tuned to your topic, role, and difficulty level." },
    { icon: MessageSquare, title: "Contextual study sessions", desc: "An AI tutor that stays aligned with your roadmap progression." },
    { icon: Sparkles, title: "Isolated doubt tab", desc: "Ask anything without polluting your main learning thread." },
    { icon: BarChart3, title: "Adaptive analytics", desc: "Quizzes, weakness analysis, and continuous progress tracking." },
  ];
  return (
    <main className="relative min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 font-semibold">
          <div className="grid h-9 w-9 place-items-center rounded-xl gradient-brand shadow-glow">
            <Brain className="h-5 w-5 text-primary-foreground" />
          </div>
          <span>LearnFlow</span>
        </div>
        <Link to="/login" className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Sign in</Link>
      </header>

      <section className="mx-auto max-w-4xl px-6 pt-16 pb-10 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border glass px-3 py-1 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" /> AI Learning Workspace
        </div>
        <h1 className="mt-6 text-5xl font-semibold tracking-tight md:text-6xl">
          Learn anything, <span className="text-gradient">adaptively.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          A modern AI-powered workspace for technical learning — personalized roadmaps,
          contextual study sessions, isolated doubt resolution, and quizzes with weakness analysis.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/login" className="inline-flex items-center gap-2 rounded-lg gradient-brand px-6 py-3 font-medium text-primary-foreground shadow-glow">
            Get started <ArrowRight className="h-4 w-4" />
          </Link>
          <a href="#features" className="rounded-lg border border-border px-6 py-3 hover:bg-accent">See features</a>
        </div>
      </section>

      <section id="features" className="mx-auto grid max-w-6xl gap-4 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <GlassCard key={f.title} className="p-6">
            <div className="grid h-10 w-10 place-items-center rounded-lg gradient-brand-soft">
              <f.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
          </GlassCard>
        ))}
      </section>
    </main>
  );
}
