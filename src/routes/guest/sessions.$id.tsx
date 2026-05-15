import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Circle, Loader2, Sparkles, Map as MapIcon, MessageSquare, HelpCircle, ListChecks, BarChart3 } from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import { ChatPanel, type ChatMessage } from "@/components/chat-panel";
import { cn } from "@/lib/utils";
import {
  getGuestSession, updateGuestSession,
  getGuestRoadmap, setGuestRoadmap, listGuestProgress, setGuestProgress,
  listStudy, addStudy, listDoubt, addDoubt, clearDoubt,
  listGuestQuizzes, addGuestQuiz, listGuestResults, addGuestResult,
  type GuestSession, type GuestQuiz, type GuestProgress,
} from "@/lib/guest-store";
import { guestGenerateRoadmap, guestStudyChat, guestDoubtChat, guestGenerateQuiz } from "@/lib/guest.functions";
import type { RoadmapStructure } from "@/lib/roadmap.functions";
import type { QuizQuestion } from "@/lib/quiz.functions";

export const Route = createFileRoute("/guest/sessions/$id")({
  head: () => ({ meta: [{ title: "Guest learning session — LearnFlow" }] }),
  component: GuestSessionWorkspace,
});

type Tab = "roadmap" | "study" | "doubt" | "quiz" | "analytics";

function findTitle(structure: RoadmapStructure | null, key: string | null | undefined): string | null {
  if (!structure || !key) return null;
  for (const p of structure.phases ?? [])
    for (const t of p.topics ?? []) if (t.key === key) return t.title;
  return null;
}

function GuestSessionWorkspace() {
  const { id } = Route.useParams();
  const [tab, setTab] = useState<Tab>("roadmap");
  const [session, setSession] = useState<GuestSession | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapStructure | null>(null);
  const [progress, setProgress] = useState<GuestProgress[]>([]);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    setSession(getGuestSession(id));
    setRoadmap(getGuestRoadmap(id));
    setProgress(listGuestProgress(id));
  }, [id, tick]);

  const tabs: { key: Tab; label: string; icon: typeof MapIcon }[] = [
    { key: "roadmap", label: "Roadmap", icon: MapIcon },
    { key: "study", label: "Study", icon: MessageSquare },
    { key: "doubt", label: "Doubts", icon: HelpCircle },
    { key: "quiz", label: "Quiz", icon: ListChecks },
    { key: "analytics", label: "Analytics", icon: BarChart3 },
  ];

  if (!session) {
    return <div className="mx-auto max-w-3xl px-6 py-20 text-center text-sm text-muted-foreground">Session not found in this browser.</div>;
  }

  const topicTitle = findTitle(roadmap, session.current_topic_key);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{session.title}</h1>
          <p className="text-sm text-muted-foreground">{session.topic}</p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card/40 p-1">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm",
                tab === t.key ? "gradient-brand text-primary-foreground shadow-glow" : "text-muted-foreground hover:bg-accent",
              )}>
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {tab === "roadmap" && <RoadmapTab id={id} session={session} roadmap={roadmap} progress={progress} onChange={refresh} />}
        {tab === "study" && <StudyTab id={id} session={session} topicTitle={topicTitle} />}
        {tab === "doubt" && <DoubtTab id={id} session={session} topicTitle={topicTitle} />}
        {tab === "quiz" && <QuizTab id={id} session={session} roadmap={roadmap} />}
        {tab === "analytics" && <AnalyticsTab id={id} roadmap={roadmap} progress={progress} />}
      </div>
    </div>
  );
}

function RoadmapTab({ id, session, roadmap, progress, onChange }:
  { id: string; session: GuestSession; roadmap: RoadmapStructure | null; progress: GuestProgress[]; onChange: () => void }) {
  const gen = useServerFn(guestGenerateRoadmap);
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    setGenerating(true);
    try {
      const { structure } = await gen({ data: {
        topic: session.topic, target_role: session.target_role, domain: session.domain,
        objective: session.objective, difficulty: session.difficulty,
      } });
      setGuestRoadmap(id, structure);
      const first = structure.phases[0]?.topics[0]?.key ?? null;
      if (first && !session.current_topic_key) updateGuestSession(id, { current_topic_key: first });
      toast.success("Roadmap generated");
      onChange();
    } catch (e: any) { toast.error(e.message); }
    finally { setGenerating(false); }
  };

  if (!roadmap) {
    return (
      <GlassCard className="p-10 text-center">
        <h3 className="text-lg font-semibold">No roadmap yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">Generate one to start learning.</p>
        <button onClick={generate} disabled={generating}
          className="mt-6 inline-flex items-center gap-2 rounded-lg gradient-brand px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-glow disabled:opacity-60">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {generating ? "Generating…" : "Generate roadmap"}
        </button>
      </GlassCard>
    );
  }

  const progressMap = new Map(progress.map((p) => [p.topic_key, p.status]));
  const currentKey = session.current_topic_key;

  return (
    <div className="space-y-4">
      <GlassCard className="p-6">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Overview</div>
        <p className="mt-2 text-sm leading-relaxed">{roadmap.overview}</p>
      </GlassCard>
      {roadmap.phases.map((phase, i) => (
        <GlassCard key={phase.key} className="p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-lg gradient-brand-soft text-sm font-semibold">{i + 1}</div>
            <div>
              <h3 className="font-semibold">{phase.title}</h3>
              <p className="text-xs text-muted-foreground">{phase.goal}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {phase.topics.map((t) => {
              const status = progressMap.get(t.key) ?? "not_started";
              const isCurrent = currentKey === t.key;
              return (
                <div key={t.key} className={cn("rounded-xl border p-3", isCurrent ? "border-primary/60 gradient-brand-soft" : "border-border bg-card/40")}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{t.title}</div>
                      <div className="text-xs text-muted-foreground">{t.summary}</div>
                    </div>
                    <button title="Toggle complete" onClick={() => {
                      const next = status === "completed" ? "not_started" : "completed";
                      setGuestProgress(id, t.key, next); onChange();
                    }}>
                      {status === "completed"
                        ? <CheckCircle2 className="h-5 w-5 text-primary" />
                        : <Circle className="h-5 w-5 text-muted-foreground" />}
                    </button>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => {
                      updateGuestSession(id, { current_topic_key: t.key });
                      setGuestProgress(id, t.key, "in_progress");
                      onChange();
                    }} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent">
                      {isCurrent ? "Current focus" : "Set focus"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 text-xs text-muted-foreground">Milestone: {phase.milestone}</div>
        </GlassCard>
      ))}
      <button onClick={generate} disabled={generating} className="text-xs text-muted-foreground hover:text-foreground">
        Regenerate roadmap
      </button>
    </div>
  );
}

function StudyTab({ id, session, topicTitle }: { id: string; session: GuestSession; topicTitle: string | null }) {
  const send = useServerFn(guestStudyChat);
  const [messages, setMessages] = useState<ChatMessage[]>(() => listStudy(id));
  const [sending, setSending] = useState(false);

  return (
    <GlassCard className="p-5">
      <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Studying: {topicTitle ?? "general"}</div>
      <ChatPanel
        messages={messages}
        sending={sending}
        placeholder="Ask the tutor anything about this topic…"
        emptyTitle="Start a study conversation"
        emptySubtitle="Ask for explanations, examples, or breakdowns of the current topic."
        onSend={async (content) => {
          setSending(true);
          const userRow = addStudy(id, "user", content, session.current_topic_key);
          const next = [...messages, userRow]; setMessages(next);
          try {
            const history = next.slice(-12).map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
            const { content: reply } = await send({ data: {
              meta: { topic: session.topic, target_role: session.target_role, domain: session.domain, objective: session.objective, difficulty: session.difficulty },
              topic_title: topicTitle, history,
            } });
            const aRow = addStudy(id, "assistant", reply, session.current_topic_key);
            setMessages((curr) => [...curr, aRow]);
            updateGuestSession(id, {});
          } catch (e: any) { toast.error(e.message); }
          finally { setSending(false); }
        }}
      />
    </GlassCard>
  );
}

function DoubtTab({ id, session, topicTitle }: { id: string; session: GuestSession; topicTitle: string | null }) {
  const send = useServerFn(guestDoubtChat);
  const [messages, setMessages] = useState<ChatMessage[]>(() => listDoubt(id));
  const [sending, setSending] = useState(false);

  return (
    <GlassCard className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Isolated doubt thread · context: {topicTitle ?? "general"}
        </div>
        <button onClick={() => { clearDoubt(id); setMessages([]); }}
          className="text-xs text-muted-foreground hover:text-foreground">Clear thread</button>
      </div>
      <ChatPanel
        messages={messages}
        sending={sending}
        placeholder="Ask a quick doubt — won't affect the study thread"
        emptyTitle="Ask anything, isolated"
        emptySubtitle="Doubts inherit your study context but never modify the main learning flow."
        onSend={async (content) => {
          setSending(true);
          const userRow = addDoubt(id, "user", content, session.current_topic_key);
          const next = [...messages, userRow]; setMessages(next);
          try {
            const history = next.slice(-10).map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
            const study_context = listStudy(id).slice(-6).map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
            const { content: reply } = await send({ data: {
              meta: { topic: session.topic, target_role: session.target_role, domain: session.domain, objective: session.objective, difficulty: session.difficulty },
              topic_title: topicTitle, study_context, history,
            } });
            const aRow = addDoubt(id, "assistant", reply, session.current_topic_key);
            setMessages((curr) => [...curr, aRow]);
          } catch (e: any) { toast.error(e.message); }
          finally { setSending(false); }
        }}
      />
    </GlassCard>
  );
}

function QuizTab({ id, session, roadmap }: { id: string; session: GuestSession; roadmap: RoadmapStructure | null }) {
  const gen = useServerFn(guestGenerateQuiz);
  const [quizzes, setQuizzes] = useState<GuestQuiz[]>(() => listGuestQuizzes(id));
  const [results, setResults] = useState(() => listGuestResults(id));
  const [activeQuiz, setActiveQuiz] = useState<GuestQuiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{ score: number; correct: number; total: number; weak_concepts: string[] } | null>(null);
  const [generating, setGenerating] = useState(false);

  const topicTitle = findTitle(roadmap, session.current_topic_key) ?? session.topic;

  const generate = async () => {
    setGenerating(true);
    try {
      const { questions } = await gen({ data: {
        meta: { topic: session.topic, target_role: session.target_role, domain: session.domain, objective: session.objective, difficulty: session.difficulty },
        topic_title: topicTitle,
      } });
      const q = addGuestQuiz(id, session.current_topic_key ?? "general", topicTitle, questions);
      setQuizzes(listGuestQuizzes(id));
      setActiveQuiz(q); setAnswers({}); setResult(null);
    } catch (e: any) { toast.error(e.message); }
    finally { setGenerating(false); }
  };

  if (activeQuiz && !result) {
    const questions = activeQuiz.questions;
    return (
      <GlassCard className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">Quiz · {activeQuiz.topic_title}</h3>
          <button onClick={() => setActiveQuiz(null)} className="text-xs text-muted-foreground hover:text-foreground">Back</button>
        </div>
        <div className="space-y-5">
          {questions.map((q, i) => (
            <div key={q.id}>
              <div className="text-sm font-medium">{i + 1}. {q.prompt}</div>
              <div className="mt-2 grid gap-2">
                {q.choices.map((c, ci) => (
                  <button key={ci} onClick={() => setAnswers({ ...answers, [q.id]: ci })}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left text-sm",
                      answers[q.id] === ci ? "border-primary gradient-brand-soft" : "border-border hover:bg-accent",
                    )}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button
          disabled={Object.keys(answers).length !== questions.length}
          onClick={() => {
            let correct = 0; const weak = new Set<string>();
            for (const q of questions) {
              if (answers[q.id] === q.answer_index) correct++;
              else weak.add(q.concept);
            }
            const score = (correct / questions.length) * 100;
            const weak_concepts = Array.from(weak);
            addGuestResult(id, { quiz_id: activeQuiz.id, session_id: id, answers, score, total: questions.length, weak_concepts });
            setResults(listGuestResults(id));
            setResult({ score, correct, total: questions.length, weak_concepts });
          }}
          className="mt-6 w-full rounded-lg gradient-brand px-4 py-2.5 font-medium text-primary-foreground shadow-glow disabled:opacity-50">
          Submit answers
        </button>
      </GlassCard>
    );
  }

  if (result && activeQuiz) {
    const questions = activeQuiz.questions as QuizQuestion[];
    return (
      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold">Score: {Math.round(result.score)}%</h3>
        <p className="text-sm text-muted-foreground">{result.correct} of {result.total} correct</p>
        {result.weak_concepts.length > 0 && (
          <div className="mt-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Weak concepts</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {result.weak_concepts.map((c) => (
                <span key={c} className="rounded-full gradient-brand-soft px-3 py-1 text-xs">{c}</span>
              ))}
            </div>
          </div>
        )}
        <div className="mt-6 space-y-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Review</div>
          {questions.map((q, i) => {
            const userAns = answers[q.id];
            const isCorrect = userAns === q.answer_index;
            return (
              <div key={q.id} className={cn("rounded-xl border p-4",
                isCorrect ? "border-primary/40 bg-primary/5" : "border-destructive/40 bg-destructive/5")}>
                <div className="flex items-start gap-2">
                  {isCorrect
                    ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
                  <div className="text-sm font-medium">{i + 1}. {q.prompt}</div>
                </div>
                <div className="mt-3 grid gap-1.5 pl-6">
                  {q.choices.map((c, ci) => {
                    const isAnswer = ci === q.answer_index;
                    const isUser = ci === userAns;
                    return (
                      <div key={ci} className={cn(
                        "rounded-md border px-3 py-1.5 text-xs",
                        isAnswer ? "border-primary/60 bg-primary/10 text-foreground"
                          : isUser ? "border-destructive/50 bg-destructive/10 text-foreground"
                          : "border-border text-muted-foreground")}>
                        {c}
                        {isAnswer && <span className="ml-2 text-[10px] uppercase tracking-wider text-primary">correct</span>}
                        {isUser && !isAnswer && <span className="ml-2 text-[10px] uppercase tracking-wider text-destructive">your answer</span>}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 pl-6 text-xs leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">Explanation: </span>{q.explanation}
                </div>
                <div className="mt-1 pl-6 text-[10px] uppercase tracking-wider text-muted-foreground">Concept: {q.concept}</div>
              </div>
            );
          })}
        </div>
        <button onClick={() => { setActiveQuiz(null); setResult(null); }} className="mt-6 rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent">Done</button>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Quizzes</h3>
          <p className="text-xs text-muted-foreground">Generate one for the current topic to evaluate understanding.</p>
        </div>
        <button onClick={generate} disabled={generating}
          className="inline-flex items-center gap-2 rounded-lg gradient-brand px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {generating ? "Generating…" : "Generate quiz"}
        </button>
      </div>
      <div className="mt-4 space-y-2">
        {quizzes.length === 0 && <div className="text-sm text-muted-foreground">No quizzes yet.</div>}
        {quizzes.map((q) => {
          const r = results.find((x) => x.quiz_id === q.id);
          return (
            <button key={q.id} onClick={() => { setActiveQuiz(q); setAnswers({}); setResult(null); }}
              className="flex w-full items-center justify-between rounded-xl border border-border bg-card/40 px-4 py-3 text-left hover:border-primary/40">
              <div>
                <div className="text-sm font-medium">{q.topic_title}</div>
                <div className="text-xs text-muted-foreground">{q.questions.length} questions</div>
              </div>
              {r && <span className="rounded-full gradient-brand-soft px-3 py-1 text-xs">{Math.round(r.score)}%</span>}
            </button>
          );
        })}
      </div>
    </GlassCard>
  );
}

function AnalyticsTab({ id, roadmap, progress }: { id: string; roadmap: RoadmapStructure | null; progress: GuestProgress[] }) {
  const results = listGuestResults(id);
  const totalTopics = (roadmap?.phases ?? []).reduce((acc, p) => acc + (p.topics?.length ?? 0), 0);
  const completed = progress.filter((p) => p.status === "completed").length;
  const pct = totalTopics ? Math.round((completed / totalTopics) * 100) : 0;
  const avg = results.length ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length) : 0;

  const weakCounts = new Map<string, number>();
  for (const r of results) for (const c of r.weak_concepts) weakCounts.set(c, (weakCounts.get(c) ?? 0) + 1);
  const weak = Array.from(weakCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <GlassCard className="p-6">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Roadmap progress</div>
        <div className="mt-2 text-3xl font-semibold">{pct}%</div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-card">
          <div className="h-full gradient-brand" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2 text-xs text-muted-foreground">{completed}/{totalTopics} topics</div>
      </GlassCard>
      <GlassCard className="p-6">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Average quiz score</div>
        <div className="mt-2 text-3xl font-semibold">{avg}%</div>
        <div className="mt-2 text-xs text-muted-foreground">{results.length} attempts</div>
      </GlassCard>
      <GlassCard className="p-6 md:col-span-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Weak concepts</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {weak.length === 0 && <div className="text-sm text-muted-foreground">No data yet — take a quiz.</div>}
          {weak.map(([c, n]) => (
            <span key={c} className="rounded-full gradient-brand-soft px-3 py-1 text-xs">{c} · {n}</span>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
