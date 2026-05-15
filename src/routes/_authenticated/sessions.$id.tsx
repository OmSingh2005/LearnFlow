import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Circle, Loader2, Sparkles, Map as MapIcon, MessageSquare, HelpCircle, ListChecks, BarChart3 } from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import { ChatPanel } from "@/components/chat-panel";
import { getSession, setCurrentTopic } from "@/lib/sessions.functions";
import { getRoadmap, generateRoadmap, setTopicStatus } from "@/lib/roadmap.functions";
import { listStudyMessages, sendStudyMessage } from "@/lib/study.functions";
import { listDoubtMessages, sendDoubtMessage, clearDoubts } from "@/lib/doubt.functions";
import { listQuizzes, generateQuiz, submitQuiz, type QuizQuestion } from "@/lib/quiz.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/sessions/$id")({
  head: () => ({ meta: [{ title: "Learning session — LearnFlow" }] }),
  component: SessionWorkspace,
});

type Tab = "roadmap" | "study" | "doubt" | "quiz" | "analytics";

function SessionWorkspace() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("roadmap");

  const fetchSession = useServerFn(getSession);
  const fetchRoadmap = useServerFn(getRoadmap);
  const { data: session } = useQuery({ queryKey: ["session", id], queryFn: () => fetchSession({ data: { id } }) });
  const { data: roadmap, isLoading: rmLoading } = useQuery({ queryKey: ["roadmap", id], queryFn: () => fetchRoadmap({ data: { session_id: id } }) });

  const tabs: { key: Tab; label: string; icon: typeof MapIcon }[] = [
    { key: "roadmap", label: "Roadmap", icon: MapIcon },
    { key: "study", label: "Study", icon: MessageSquare },
    { key: "doubt", label: "Doubts", icon: HelpCircle },
    { key: "quiz", label: "Quiz", icon: ListChecks },
    { key: "analytics", label: "Analytics", icon: BarChart3 },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{session?.title ?? "…"}</h1>
          <p className="text-sm text-muted-foreground">{session?.topic}</p>
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
        {tab === "roadmap" && (
          <RoadmapTab id={id} roadmap={roadmap} loading={rmLoading} currentKey={session?.current_topic_key ?? null}
            onTopicChange={() => qc.invalidateQueries({ queryKey: ["session", id] })} />
        )}
        {tab === "study" && <StudyTab id={id} topicTitle={findTitle(roadmap?.structure, session?.current_topic_key)} />}
        {tab === "doubt" && <DoubtTab id={id} topicTitle={findTitle(roadmap?.structure, session?.current_topic_key)} />}
        {tab === "quiz" && <QuizTab id={id} />}
        {tab === "analytics" && <AnalyticsTab id={id} />}
      </div>
    </div>
  );
}

function findTitle(structure: any, key: string | null | undefined): string | null {
  if (!structure || !key) return null;
  for (const p of structure.phases ?? [])
    for (const t of p.topics ?? []) if (t.key === key) return t.title;
  return null;
}

function RoadmapTab({ id, roadmap, loading, currentKey, onTopicChange }: any) {
  const qc = useQueryClient();
  const gen = useServerFn(generateRoadmap);
  const setStatus = useServerFn(setTopicStatus);
  const setCurrent = useServerFn(setCurrentTopic);
  const genMut = useMutation({
    mutationFn: () => gen({ data: { session_id: id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["roadmap", id] }); toast.success("Roadmap generated"); },
    onError: (e: any) => toast.error(e.message),
  });

  if (loading) return <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!roadmap?.structure) {
    return (
      <GlassCard className="p-10 text-center">
        <h3 className="text-lg font-semibold">No roadmap yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">Generate one to start learning.</p>
        <button onClick={() => genMut.mutate()} disabled={genMut.isPending}
          className="mt-6 inline-flex items-center gap-2 rounded-lg gradient-brand px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-glow">
          <Sparkles className="h-4 w-4" /> {genMut.isPending ? "Generating…" : "Generate roadmap"}
        </button>
      </GlassCard>
    );
  }
  const progressMap = new Map<string, string>((roadmap.progress ?? []).map((p: any) => [p.topic_key, p.status]));

  return (
    <div className="space-y-4">
      <GlassCard className="p-6">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Overview</div>
        <p className="mt-2 text-sm leading-relaxed">{roadmap.structure.overview}</p>
      </GlassCard>
      {roadmap.structure.phases.map((phase: any, i: number) => (
        <GlassCard key={phase.key} className="p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-lg gradient-brand-soft text-sm font-semibold">{i + 1}</div>
            <div>
              <h3 className="font-semibold">{phase.title}</h3>
              <p className="text-xs text-muted-foreground">{phase.goal}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {phase.topics.map((t: any) => {
              const status = progressMap.get(t.key) ?? "not_started";
              const isCurrent = currentKey === t.key;
              return (
                <div key={t.key} className={cn("rounded-xl border p-3", isCurrent ? "border-primary/60 gradient-brand-soft" : "border-border bg-card/40")}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{t.title}</div>
                      <div className="text-xs text-muted-foreground">{t.summary}</div>
                    </div>
                    <button title="Toggle complete"
                      onClick={async () => {
                        const next = status === "completed" ? "not_started" : "completed";
                        await setStatus({ data: { session_id: id, topic_key: t.key, status: next } });
                        qc.invalidateQueries({ queryKey: ["roadmap", id] });
                        qc.invalidateQueries({ queryKey: ["analytics"] });
                      }}>
                      {status === "completed"
                        ? <CheckCircle2 className="h-5 w-5 text-primary" />
                        : <Circle className="h-5 w-5 text-muted-foreground" />}
                    </button>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={async () => {
                        await setCurrent({ data: { session_id: id, topic_key: t.key } });
                        await setStatus({ data: { session_id: id, topic_key: t.key, status: "in_progress" } });
                        qc.invalidateQueries({ queryKey: ["roadmap", id] });
                        onTopicChange();
                      }}
                      className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent">
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
      <button onClick={() => genMut.mutate()} disabled={genMut.isPending}
        className="text-xs text-muted-foreground hover:text-foreground">Regenerate roadmap</button>
    </div>
  );
}

function StudyTab({ id, topicTitle }: { id: string; topicTitle: string | null }) {
  const qc = useQueryClient();
  const list = useServerFn(listStudyMessages);
  const send = useServerFn(sendStudyMessage);
  const { data: messages = [] } = useQuery({ queryKey: ["study", id], queryFn: () => list({ data: { session_id: id } }) });
  const [sending, setSending] = useState(false);

  return (
    <GlassCard className="p-5">
      <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
        Studying: {topicTitle ?? "general"}
      </div>
      <ChatPanel
        messages={messages as any}
        sending={sending}
        placeholder="Ask the tutor anything about this topic…"
        emptyTitle="Start a study conversation"
        emptySubtitle="Ask for explanations, examples, or breakdowns of the current topic."
        onSend={async (content) => {
          setSending(true);
          // optimistic
          qc.setQueryData(["study", id], (old: any[] = []) => [...old, { id: `tmp-${Date.now()}`, role: "user", content }]);
          try {
            await send({ data: { session_id: id, content } });
            qc.invalidateQueries({ queryKey: ["study", id] });
          } catch (e: any) {
            toast.error(e.message);
          } finally { setSending(false); }
        }}
      />
    </GlassCard>
  );
}

function DoubtTab({ id, topicTitle }: { id: string; topicTitle: string | null }) {
  const qc = useQueryClient();
  const list = useServerFn(listDoubtMessages);
  const send = useServerFn(sendDoubtMessage);
  const clear = useServerFn(clearDoubts);
  const { data: messages = [] } = useQuery({ queryKey: ["doubt", id], queryFn: () => list({ data: { session_id: id } }) });
  const [sending, setSending] = useState(false);

  return (
    <GlassCard className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Isolated doubt thread · context: {topicTitle ?? "general"}
        </div>
        <button onClick={async () => { await clear({ data: { session_id: id } }); qc.invalidateQueries({ queryKey: ["doubt", id] }); }}
          className="text-xs text-muted-foreground hover:text-foreground">Clear thread</button>
      </div>
      <ChatPanel
        messages={messages as any}
        sending={sending}
        placeholder="Ask a quick doubt — won't affect the study thread"
        emptyTitle="Ask anything, isolated"
        emptySubtitle="Doubts inherit your study context but never modify the main learning flow."
        onSend={async (content) => {
          setSending(true);
          qc.setQueryData(["doubt", id], (old: any[] = []) => [...old, { id: `tmp-${Date.now()}`, role: "user", content }]);
          try {
            await send({ data: { session_id: id, content } });
            qc.invalidateQueries({ queryKey: ["doubt", id] });
          } catch (e: any) { toast.error(e.message); }
          finally { setSending(false); }
        }}
      />
    </GlassCard>
  );
}

function QuizTab({ id }: { id: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listQuizzes);
  const gen = useServerFn(generateQuiz);
  const submit = useServerFn(submitQuiz);
  const { data } = useQuery({ queryKey: ["quizzes", id], queryFn: () => list({ data: { session_id: id } }) });
  const [activeQuiz, setActiveQuiz] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<any>(null);

  const genMut = useMutation({
    mutationFn: () => gen({ data: { session_id: id } }),
    onSuccess: (q) => { setActiveQuiz(q); setAnswers({}); setResult(null); qc.invalidateQueries({ queryKey: ["quizzes", id] }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (activeQuiz && !result) {
    const questions = activeQuiz.questions as QuizQuestion[];
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
          onClick={async () => {
            try {
              const r = await submit({ data: { quiz_id: activeQuiz.id, answers } });
              setResult(r);
              qc.invalidateQueries({ queryKey: ["quizzes", id] });
              qc.invalidateQueries({ queryKey: ["analytics"] });
            } catch (e: any) { toast.error(e.message); }
          }}
          className="mt-6 w-full rounded-lg gradient-brand px-4 py-2.5 font-medium text-primary-foreground shadow-glow disabled:opacity-50">
          Submit answers
        </button>
      </GlassCard>
    );
  }

  if (result) {
    const questions = activeQuiz?.questions as QuizQuestion[] | undefined;
    return (
      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold">Score: {Math.round(Number(result.result.score))}%</h3>
        <p className="text-sm text-muted-foreground">{result.correct} of {result.total} correct</p>
        {result.weak_concepts.length > 0 && (
          <div className="mt-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Weak concepts</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {result.weak_concepts.map((c: string) => (
                <span key={c} className="rounded-full gradient-brand-soft px-3 py-1 text-xs">{c}</span>
              ))}
            </div>
          </div>
        )}
        {questions && (
          <div className="mt-6 space-y-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Review</div>
            {questions.map((q, i) => {
              const userAns = answers[q.id];
              const isCorrect = userAns === q.answer_index;
              return (
                <div key={q.id} className={cn(
                  "rounded-xl border p-4",
                  isCorrect ? "border-primary/40 bg-primary/5" : "border-destructive/40 bg-destructive/5",
                )}>
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
                            : "border-border text-muted-foreground",
                        )}>
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
        )}
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
        <button onClick={() => genMut.mutate()} disabled={genMut.isPending}
          className="inline-flex items-center gap-2 rounded-lg gradient-brand px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow">
          <Sparkles className="h-4 w-4" /> {genMut.isPending ? "Generating…" : "Generate quiz"}
        </button>
      </div>
      <div className="mt-4 space-y-2">
        {(data?.quizzes ?? []).length === 0 && <div className="text-sm text-muted-foreground">No quizzes yet.</div>}
        {(data?.quizzes ?? []).map((q: any) => {
          const r = (data?.results ?? []).find((x: any) => x.quiz_id === q.id);
          return (
            <button key={q.id} onClick={() => { setActiveQuiz(q); setAnswers({}); setResult(null); }}
              className="flex w-full items-center justify-between rounded-xl border border-border bg-card/40 px-4 py-3 text-left hover:border-primary/40">
              <div>
                <div className="text-sm font-medium">{q.topic_title}</div>
                <div className="text-xs text-muted-foreground">{q.questions.length} questions</div>
              </div>
              {r && <span className="rounded-full gradient-brand-soft px-3 py-1 text-xs">{Math.round(Number(r.score))}%</span>}
            </button>
          );
        })}
      </div>
    </GlassCard>
  );
}

function AnalyticsTab({ id }: { id: string }) {
  const list = useServerFn(listQuizzes);
  const fetchRoadmap = useServerFn(getRoadmap);
  const { data } = useQuery({ queryKey: ["quizzes", id], queryFn: () => list({ data: { session_id: id } }) });
  const { data: rm } = useQuery({ queryKey: ["roadmap", id], queryFn: () => fetchRoadmap({ data: { session_id: id } }) });

  const totalTopics = (rm?.structure?.phases ?? []).reduce((acc: number, p: any) => acc + (p.topics?.length ?? 0), 0);
  const completed = (rm?.progress ?? []).filter((p: any) => p.status === "completed").length;
  const pct = totalTopics ? Math.round((completed / totalTopics) * 100) : 0;
  const avg = (data?.results ?? []).length ? Math.round((data!.results.reduce((s, r) => s + Number(r.score), 0)) / data!.results.length) : 0;

  const weakCounts = new Map<string, number>();
  for (const r of data?.results ?? []) for (const c of r.weak_concepts ?? []) weakCounts.set(c, (weakCounts.get(c) ?? 0) + 1);
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
        <div className="mt-2 text-xs text-muted-foreground">{data?.results.length ?? 0} attempts</div>
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
