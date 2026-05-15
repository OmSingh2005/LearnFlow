// Public (no-auth) server functions used by guest mode.
// Guests own their state in localStorage and pass full context with each call.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { aiChat, aiTool, type ChatMsg } from "./ai.server";
import type { RoadmapStructure } from "./roadmap.functions";
import type { QuizQuestion } from "./quiz.functions";

const MessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().min(1).max(8000),
});

// ---- Generic guest chat (kept for backward compat) ----
export const guestChat = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ messages: z.array(MessageSchema).min(1).max(40) }).parse(d))
  .handler(async ({ data }) => {
    const sys: ChatMsg = {
      role: "system",
      content: `You are a helpful AI tutor in a guest chat session. The user is not signed in and no history will be saved between sessions. Answer clearly and concisely. Use markdown headings, bullet points, and code blocks where helpful.`,
    };
    const reply = await aiChat([sys, ...(data.messages as ChatMsg[])]);
    return { content: reply };
  });

// ---- Guest roadmap generation ----
const SessionMetaSchema = z.object({
  topic: z.string().min(1).max(200),
  target_role: z.string().max(120).nullable().optional(),
  domain: z.string().max(120).nullable().optional(),
  objective: z.string().max(500).nullable().optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
});

export const guestGenerateRoadmap = createServerFn({ method: "POST" })
  .inputValidator((d) => SessionMetaSchema.parse(d))
  .handler(async ({ data }) => {
    const sys = `You are a senior curriculum designer creating personalized, industry-relevant learning roadmaps. Output structured JSON only via the provided tool. Keep titles concise. 4-6 phases, 3-6 topics per phase. Topic keys must be unique short slugs (kebab-case).`;
    const user = `Create a learning roadmap for:
Topic: ${data.topic}
Target role: ${data.target_role ?? "—"}
Domain: ${data.domain ?? "—"}
Objective: ${data.objective ?? "—"}
Difficulty: ${data.difficulty}

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
                  key: { type: "string" }, title: { type: "string" }, goal: { type: "string" },
                  prerequisites: { type: "array", items: { type: "string" } },
                  milestone: { type: "string" },
                  topics: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: { key: { type: "string" }, title: { type: "string" }, summary: { type: "string" } },
                      required: ["key", "title", "summary"], additionalProperties: false,
                    },
                  },
                },
                required: ["key", "title", "goal", "prerequisites", "milestone", "topics"],
                additionalProperties: false,
              },
            },
          },
          required: ["overview", "phases"], additionalProperties: false,
        },
      },
    );
    return { structure };
  });

// ---- Guest study chat ----
export const guestStudyChat = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    meta: SessionMetaSchema,
    topic_title: z.string().nullable().optional(),
    history: z.array(MessageSchema).min(1).max(24),
  }).parse(d))
  .handler(async ({ data }) => {
    const sys: ChatMsg = {
      role: "system",
      content: `You are an adaptive learning tutor in a structured study workspace.
Topic of study: ${data.meta.topic}
Current focus: ${data.topic_title ?? "general overview"}
Target role: ${data.meta.target_role ?? "—"} | Domain: ${data.meta.domain ?? "—"} | Level: ${data.meta.difficulty}
Style: clear, concise, structured. Use markdown headings, bullet points, code blocks where helpful. Build on prior context, suggest next steps, and stay aligned with the roadmap.`,
    };
    const reply = await aiChat([sys, ...(data.history as ChatMsg[])]);
    return { content: reply };
  });

// ---- Guest doubt chat ----
export const guestDoubtChat = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    meta: SessionMetaSchema,
    topic_title: z.string().nullable().optional(),
    study_context: z.array(MessageSchema).max(8).optional(),
    history: z.array(MessageSchema).min(1).max(20),
  }).parse(d))
  .handler(async ({ data }) => {
    const digest = (data.study_context ?? [])
      .map((m) => `${m.role === "user" ? "Learner" : "Tutor"}: ${m.content.slice(0, 400)}`)
      .join("\n---\n") || "No prior study messages.";

    const sys: ChatMsg = {
      role: "system",
      content: `You are answering an isolated learner doubt. You inherit the study context below as READ-ONLY background — answer ONLY the asked question, concisely and surgically. Do NOT continue the lecture, do NOT advance the roadmap, do NOT introduce new topics unless directly required to clear the doubt.

Topic: ${data.meta.topic} | Focus: ${data.topic_title ?? "general"} | Level: ${data.meta.difficulty}

--- READ-ONLY STUDY CONTEXT ---
${digest}
--- END CONTEXT ---`,
    };
    const reply = await aiChat([sys, ...(data.history as ChatMsg[])]);
    return { content: reply };
  });

// ---- Guest quiz generation ----
export const guestGenerateQuiz = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    meta: SessionMetaSchema,
    topic_title: z.string().min(1).max(200),
  }).parse(d))
  .handler(async ({ data }) => {
    const sys = `You are an assessment designer. Generate 5 conceptual multiple-choice questions that evaluate understanding (not memorization). Each has 4 plausible choices, 1 correct. Tag each with a short concept label so weak concepts can be aggregated. Difficulty: ${data.meta.difficulty}.`;
    const user = `Subject: ${data.meta.topic}
Focus topic: ${data.topic_title}
Target role: ${data.meta.target_role ?? "—"}`;

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
          required: ["questions"], additionalProperties: false,
        },
      },
    );
    const questions: QuizQuestion[] = result.questions.map((q, i) => ({ ...q, id: `q${i + 1}` }));
    return { questions };
  });
