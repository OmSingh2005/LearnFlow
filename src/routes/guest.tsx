import { createFileRoute, Outlet, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Brain, Plus, LayoutDashboard, MessageSquare, LogIn, Trash2 } from "lucide-react";
import { listGuestSessions, deleteGuestSession, type GuestSession } from "@/lib/guest-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/guest")({
  head: () => ({ meta: [{ title: "Guest workspace — LearnFlow" }] }),
  component: GuestLayout,
});

function GuestLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<GuestSession[]>([]);

  // Re-read on every route change (state lives in localStorage).
  useEffect(() => { setSessions(listGuestSessions()); }, [pathname]);

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-sidebar/60 backdrop-blur-xl md:flex">
        <Link to="/guest/dashboard" className="flex items-center gap-2 px-5 py-5 font-semibold">
          <div className="grid h-9 w-9 place-items-center rounded-xl gradient-brand shadow-glow">
            <Brain className="h-5 w-5 text-primary-foreground" />
          </div>
          LearnFlow · Guest
        </Link>

        <nav className="px-3 pb-3">
          <Link
            to="/guest/dashboard"
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
              pathname === "/guest/dashboard" ? "gradient-brand-soft text-foreground" : "text-muted-foreground hover:bg-accent",
            )}
          >
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </Link>
          <Link
            to="/guest/sessions/new"
            className={cn(
              "mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
              pathname === "/guest/sessions/new" ? "gradient-brand-soft text-foreground" : "text-muted-foreground hover:bg-accent",
            )}
          >
            <Plus className="h-4 w-4" /> New session
          </Link>
        </nav>

        <div className="px-5 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">Guest sessions</div>
        <div className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {sessions.length === 0 && (
            <div className="rounded-lg border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
              No sessions yet. Create one to start.
            </div>
          )}
          {sessions.map((s) => {
            const active = pathname === `/guest/sessions/${s.id}`;
            return (
              <div key={s.id} className={cn(
                "group flex items-start gap-2 rounded-lg px-3 py-2 text-sm",
                active ? "gradient-brand-soft text-foreground" : "text-muted-foreground hover:bg-accent",
              )}>
                <Link to="/guest/sessions/$id" params={{ id: s.id }} className="flex min-w-0 flex-1 items-start gap-2">
                  <MessageSquare className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-foreground">{s.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{s.topic}</div>
                  </div>
                </Link>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    if (!confirm("Delete this guest session?")) return;
                    deleteGuestSession(s.id);
                    setSessions(listGuestSessions());
                    if (active) navigate({ to: "/guest/dashboard" });
                  }}
                  className="opacity-0 transition group-hover:opacity-100"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        <div className="m-3 rounded-lg border border-dashed border-border px-3 py-2 text-[11px] text-muted-foreground">
          Guest mode — data stays in this browser only.
        </div>
        <Link to="/login" className="m-3 mt-0 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent">
          <LogIn className="h-4 w-4" /> Sign in to save progress
        </Link>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
