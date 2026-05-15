// Browser-only localStorage store for guest sessions.
// All data lives in the user's browser; nothing is sent to the database.
import type { RoadmapStructure } from "./roadmap.functions";
import type { QuizQuestion } from "./quiz.functions";

export type GuestSession = {
  id: string;
  title: string;
  topic: string;
  target_role: string | null;
  domain: string | null;
  objective: string | null;
  difficulty: "beginner" | "intermediate" | "advanced";
  current_topic_key: string | null;
  created_at: string;
  updated_at: string;
};

export type GuestMessage = { id: string; role: "user" | "assistant"; content: string; topic_key: string | null; created_at: string };
export type GuestProgress = { topic_key: string; status: "not_started" | "in_progress" | "completed"; completed_at: string | null };
export type GuestQuiz = { id: string; topic_key: string; topic_title: string; questions: QuizQuestion[]; created_at: string };
export type GuestQuizResult = { id: string; quiz_id: string; session_id: string; answers: Record<string, number>; score: number; total: number; weak_concepts: string[]; created_at: string };

const PREFIX = "learnflow.guest.";
const KEYS = {
  sessions: `${PREFIX}sessions`,
  roadmap: (sid: string) => `${PREFIX}roadmap.${sid}`,
  progress: (sid: string) => `${PREFIX}progress.${sid}`,
  study: (sid: string) => `${PREFIX}study.${sid}`,
  doubt: (sid: string) => `${PREFIX}doubt.${sid}`,
  quizzes: (sid: string) => `${PREFIX}quizzes.${sid}`,
  results: (sid: string) => `${PREFIX}results.${sid}`,
};

const isBrowser = () => typeof window !== "undefined";
function read<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function write<T>(key: string, value: T) { if (isBrowser()) localStorage.setItem(key, JSON.stringify(value)); }
function remove(key: string) { if (isBrowser()) localStorage.removeItem(key); }
const uid = () => (isBrowser() && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const now = () => new Date().toISOString();

// Sessions
export function listGuestSessions(): GuestSession[] {
  return read<GuestSession[]>(KEYS.sessions, []).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}
export function getGuestSession(id: string): GuestSession | null {
  return listGuestSessions().find((s) => s.id === id) ?? null;
}
export function createGuestSession(input: Omit<GuestSession, "id" | "created_at" | "updated_at" | "current_topic_key">): GuestSession {
  const s: GuestSession = { ...input, id: uid(), current_topic_key: null, created_at: now(), updated_at: now() };
  const all = read<GuestSession[]>(KEYS.sessions, []);
  all.push(s); write(KEYS.sessions, all);
  return s;
}
export function updateGuestSession(id: string, patch: Partial<GuestSession>) {
  const all = read<GuestSession[]>(KEYS.sessions, []);
  const i = all.findIndex((s) => s.id === id);
  if (i < 0) return;
  all[i] = { ...all[i], ...patch, updated_at: now() };
  write(KEYS.sessions, all);
}
export function deleteGuestSession(id: string) {
  write(KEYS.sessions, read<GuestSession[]>(KEYS.sessions, []).filter((s) => s.id !== id));
  for (const k of [KEYS.roadmap, KEYS.progress, KEYS.study, KEYS.doubt, KEYS.quizzes, KEYS.results]) remove(k(id));
}

// Roadmap
export function getGuestRoadmap(sid: string): RoadmapStructure | null { return read<RoadmapStructure | null>(KEYS.roadmap(sid), null); }
export function setGuestRoadmap(sid: string, structure: RoadmapStructure) { write(KEYS.roadmap(sid), structure); }
export function listGuestProgress(sid: string): GuestProgress[] { return read<GuestProgress[]>(KEYS.progress(sid), []); }
export function setGuestProgress(sid: string, topic_key: string, status: GuestProgress["status"]) {
  const all = read<GuestProgress[]>(KEYS.progress(sid), []);
  const i = all.findIndex((p) => p.topic_key === topic_key);
  const row = { topic_key, status, completed_at: status === "completed" ? now() : null };
  if (i >= 0) all[i] = row; else all.push(row);
  write(KEYS.progress(sid), all);
}

// Messages
function msgList(key: string) { return read<GuestMessage[]>(key, []); }
function msgAdd(key: string, role: GuestMessage["role"], content: string, topic_key: string | null): GuestMessage {
  const m: GuestMessage = { id: uid(), role, content, topic_key, created_at: now() };
  const all = msgList(key); all.push(m); write(key, all); return m;
}
export const listStudy = (sid: string) => msgList(KEYS.study(sid));
export const addStudy = (sid: string, role: GuestMessage["role"], content: string, topic_key: string | null) => msgAdd(KEYS.study(sid), role, content, topic_key);
export const listDoubt = (sid: string) => msgList(KEYS.doubt(sid));
export const addDoubt = (sid: string, role: GuestMessage["role"], content: string, topic_key: string | null) => msgAdd(KEYS.doubt(sid), role, content, topic_key);
export const clearDoubt = (sid: string) => write(KEYS.doubt(sid), []);

// Quizzes
export function listGuestQuizzes(sid: string): GuestQuiz[] {
  return read<GuestQuiz[]>(KEYS.quizzes(sid), []).sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export function addGuestQuiz(sid: string, topic_key: string, topic_title: string, questions: QuizQuestion[]): GuestQuiz {
  const q: GuestQuiz = { id: uid(), topic_key, topic_title, questions, created_at: now() };
  const all = listGuestQuizzes(sid); all.push(q); write(KEYS.quizzes(sid), all); return q;
}
export function listGuestResults(sid: string): GuestQuizResult[] { return read<GuestQuizResult[]>(KEYS.results(sid), []); }
export function addGuestResult(sid: string, r: Omit<GuestQuizResult, "id" | "created_at">): GuestQuizResult {
  const row: GuestQuizResult = { ...r, id: uid(), created_at: now() };
  const all = listGuestResults(sid); all.push(row); write(KEYS.results(sid), all); return row;
}
