import { createFileRoute, Outlet, redirect, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Brain, Plus, LayoutDashboard, LogOut, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listSessions } from "@/lib/sessions.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: AuthLayout,
});

function AuthLayout() {
  const fetchSessions = useServerFn(listSessions);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: sessions = [] } = useQuery({ queryKey: ["sessions"], queryFn: () => fetchSessions() });

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-sidebar/60 backdrop-blur-xl md:flex">
        <Link to="/dashboard" className="flex items-center gap-2 px-5 py-5 font-semibold">
          <div className="grid h-9 w-9 place-items-center rounded-xl gradient-brand shadow-glow">
            <Brain className="h-5 w-5 text-primary-foreground" />
          </div>
          LearnFlow
        </Link>

        <nav className="px-3 pb-3">
          <Link
            to="/dashboard"
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
              pathname === "/dashboard" ? "gradient-brand-soft text-foreground" : "text-muted-foreground hover:bg-accent",
            )}
          >
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </Link>
          <Link
            to="/sessions/new"
            className={cn(
              "mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
              pathname === "/sessions/new" ? "gradient-brand-soft text-foreground" : "text-muted-foreground hover:bg-accent",
            )}
          >
            <Plus className="h-4 w-4" /> New session
          </Link>
        </nav>

        <div className="px-5 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">Learning sessions</div>
        <div className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {sessions.length === 0 && (
            <div className="rounded-lg border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
              No sessions yet. Create your first one.
            </div>
          )}
          {sessions.map((s) => {
            const active = pathname === `/sessions/${s.id}`;
            return (
              <Link
                key={s.id}
                to="/sessions/$id"
                params={{ id: s.id }}
                className={cn(
                  "flex items-start gap-2 rounded-lg px-3 py-2 text-sm",
                  active ? "gradient-brand-soft text-foreground" : "text-muted-foreground hover:bg-accent",
                )}
              >
                <MessageSquare className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-foreground">{s.title}</div>
                  <div className="truncate text-xs text-muted-foreground">{s.topic}</div>
                </div>
              </Link>
            );
          })}
        </div>

        <button onClick={signOut} className="m-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
