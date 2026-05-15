import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiTool } from "./ai.server";

export type QuizQuestion = {
  id: string;
  prompt: string;
  choices: string[];
  answer_index: number;
  concept: string;
  explanation: string;
};

export const listQuizzes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ session_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: quizzes } = await context.supabase
      .from("quizzes").select("id, topic_key, topic_title, questions, created_at")
      .eq("session_id", data.session_id).order("created_at", { ascending: false });
    const { data: results } = await context.supabase
      .from("quiz_results").select("quiz_id, score, total, weak_concepts, created_at")
      .eq("session_id", data.session_id).order("created_at", { ascending: false });
    return { quizzes: quizzes ?? [], results: results ?? [] };
  });

export const generateQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    session_id: z.string().uuid(),
    topic_key: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: session } = await context.supabase
      .from("learning_sessions").select("*").eq("id", data.session_id).single();
    if (!session) throw new Error("Session not found");
    const { data: rm } = await context.supabase
      .from("roadmaps").select("structure").eq("session_id", data.session_id).maybeSingle();
    const structure = rm?.structure as any;

    const topicKey = data.topic_key ?? session.current_topic_key;
    let topicTitle = session.topic;
    if (structure && topicKey) {
      for (const p of structure.phases ?? [])
        for (const t of p.topics ?? []) if (t.key === topicKey) topicTitle = t.title;
    }

    const sys = `You are an assessment designer. Generate 5 conceptual multiple-choice questions that evaluate understanding (not memorization). Each has 4 plausible choices, 1 correct. Tag each with a short concept label so weak concepts can be aggregated. Difficulty: ${session.difficulty}.`;
    const user = `Subject: ${session.topic}
Focus topic: ${topicTitle}
Target role: ${session.target_role ?? "—"}`;

    const result = await aiTool<{ questions: Omit<QuizQuestion, "id">[] }>(
      [{ role: "system", content: sys }, { role: "user", content: user }],
      {
        name: "build_quiz",
        description: "Generate quiz questions.",
        parameters: {
          type: "object",
          properties: {
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  prompt: { type: "string" },
                  choices: { type: "array", items: { type: "string" } },
                  answer_index: { type: "number" },
                  concept: { type: "string" },
                  explanation: { type: "string" },
                },
                required: ["prompt", "choices", "answer_index", "concept", "explanation"],
                additionalProperties: false,
              },
            },
          },
          required: ["questions"],
          additionalProperties: false,
        },
      },
    );

    const questions: QuizQuestion[] = result.questions.map((q, i) => ({ ...q, id: `q${i + 1}` }));

    const { data: quiz, error } = await context.supabase.from("quizzes").insert({
      session_id: data.session_id,
      topic_key: topicKey ?? "general",
      topic_title: topicTitle,
      questions: questions as any,
    }).select().single();
    if (error) throw new Error(error.message);
    return quiz;
  });

export const submitQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    quiz_id: z.string().uuid(),
    answers: z.record(z.string(), z.number()),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: quiz, error } = await context.supabase
      .from("quizzes").select("*").eq("id", data.quiz_id).single();
    if (error || !quiz) throw new Error("Quiz not found");
    const questions = quiz.questions as unknown as QuizQuestion[];
    let correct = 0;
    const weak = new Set<string>();
    for (const q of questions) {
      const a = data.answers[q.id];
      if (a === q.answer_index) correct++;
      else weak.add(q.concept);
    }
    const score = (correct / questions.length) * 100;
    const { data: row, error: insErr } = await context.supabase.from("quiz_results").insert({
      quiz_id: data.quiz_id,
      session_id: quiz.session_id,
      answers: data.answers as any,
      score,
      total: questions.length,
      weak_concepts: Array.from(weak),
    }).select().single();
    if (insErr) throw new Error(insErr.message);
    return { result: row, correct, total: questions.length, weak_concepts: Array.from(weak) };
  });
