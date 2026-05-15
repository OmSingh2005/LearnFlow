
# AI Learning Workspace — MVP Plan

## Stack adaptation (important)

The PRD specifies MongoDB + Express + Firebase + Gemini. On Lovable, the equivalent managed stack is:

- **TanStack Start (React 19, Vite)** — frontend + server functions (replaces Express)
- **Lovable Cloud** (Postgres + Auth + Storage, powered by Supabase under the hood) — replaces MongoDB + Firebase. Google OAuth is supported natively.
- **Lovable AI Gateway** (Gemini models available, no API key needed) — replaces direct Gemini integration

This gives the same capabilities with zero infra setup. If you need the literal Mongo/Express/Firebase stack, say so and I'll stop — otherwise I'll proceed with the above.

## Architecture

```
src/
  routes/
    index.tsx                  Landing page (marketing, CTA → login)
    login.tsx                  Google sign-in
    _authenticated.tsx         Auth gate layout (sidebar + outlet)
    _authenticated/
      dashboard.tsx            Overview, active sessions, analytics widgets
      sessions.new.tsx         New learning session form (topic/role/level)
      sessions.$id.tsx         Session workspace (tabs: Roadmap/Study/Doubt/Quiz)
    api/public/                (none needed for MVP)
  components/
    app-sidebar.tsx            Multi-session sidebar
    roadmap-tree.tsx           Expandable phases + topics + progress
    chat-panel.tsx             Reusable AI chat (study + doubt)
    quiz-runner.tsx            MCQ flow + results
    analytics-cards.tsx        Progress / accuracy / weak topics
    glass-card.tsx             Glassmorphism wrapper
  lib/
    sessions.functions.ts      CRUD learning sessions
    roadmap.functions.ts       generateRoadmap (AI), updateProgress
    study.functions.ts         sendStudyMessage (AI, context-aware)
    doubt.functions.ts         sendDoubtMessage (AI, inherits study ctx, isolated)
    quiz.functions.ts          generateQuiz, submitQuiz (scoring + weakness)
    analytics.functions.ts     getDashboardAnalytics
    ai.server.ts               Lovable AI Gateway client (Gemini)
  integrations/supabase/       (auto-generated)
  styles.css                   Dark theme, indigo/violet accents, glass tokens
```

## Database schema (Lovable Cloud / Postgres)

- `profiles` (id=auth.uid, name, email, avatar_url, created_at)
- `learning_sessions` (id, user_id, title, topic, target_role, domain, objective, difficulty, created_at, updated_at)
- `roadmaps` (id, session_id, structure jsonb — phases→topics with prerequisites/milestones, created_at)
- `roadmap_progress` (id, session_id, topic_key, status: not_started|in_progress|completed, completed_at)
- `study_messages` (id, session_id, role: user|assistant, content, topic_key nullable, created_at)
- `doubt_messages` (id, session_id, role, content, topic_key, created_at)  -- isolated from study
- `quizzes` (id, session_id, topic_key, questions jsonb [{q, choices, answer, explanation}], created_at)
- `quiz_results` (id, quiz_id, session_id, answers jsonb, score, weak_concepts text[], created_at)

RLS: every table scoped to `auth.uid() = user_id` (joined via session for child tables). Roles via separate `user_roles` table (not needed for MVP unless admin requested — skipping).

## AI flow (Lovable AI Gateway, model: `google/gemini-2.5-flash`)

- **Roadmap**: structured JSON output (phases, topics, prerequisites, milestones).
- **Study chat**: system prompt includes session metadata + current topic + last N messages from `study_messages`.
- **Doubt chat**: system prompt includes session metadata + current topic + last N study messages as READ-ONLY context, plus prior doubt messages. Writes only to `doubt_messages`.
- **Quiz**: structured JSON MCQs with explanations.
- **Weakness analysis**: post-submit, derived from incorrect answers' topic tags.

All AI calls live in `*.functions.ts` server functions protected by `requireSupabaseAuth`.

## UI direction

- Dark slate/charcoal background, off-white text, indigo→violet gradient accents
- Glassmorphism panels (backdrop-blur, subtle borders, soft glow)
- Inter for body, tight modern headings
- Sidebar with session list + "+ New session"
- Session workspace: tabbed layout (Roadmap | Study | Doubt | Quiz | Analytics)
- Smooth Framer-Motion-free transitions via Tailwind (cheap, polished)

## Build order (incremental)

1. **Foundation**: enable Lovable Cloud, configure Google OAuth, dark design system in `styles.css`, glass components.
2. **Auth + landing + login**: marketing landing, `/login`, `_authenticated` gate.
3. **DB schema**: migration for all tables + RLS.
4. **Sidebar + dashboard shell**: list sessions, create session form, dashboard with analytics cards (empty states).
5. **Roadmap**: AI generation server fn, roadmap tree UI, progress toggling.
6. **Study chat**: server fn + chat panel with markdown.
7. **Doubt tab**: isolated chat with study-context injection.
8. **Quiz**: generation + runner + scoring + weakness write-back.
9. **Analytics**: dashboard widgets fed from quiz_results + progress.
10. **Polish pass**: animations, empty states, responsiveness, SEO meta.

## Out of scope (per PRD §19)

No vector DB, RAG, LangChain, multi-agent, websockets, embeddings.

---

Confirm and I'll start building from step 1. If you specifically need MongoDB/Express/Firebase instead of Lovable Cloud, tell me before I begin.
