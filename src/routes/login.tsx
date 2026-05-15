import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Brain, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@/components/glass-card";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — LearnFlow" }] }),
  component: LoginPage,
});

type Mode = "signin" | "signup";

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const signInGoogle = async () => {
    setOauthLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/dashboard" },
    });
    if (error) {
      toast.error(error.message ?? "Sign-in failed");
      setOauthLoading(false);
    }
    // OAuth triggers a full-page redirect; no nav here.
  };

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Email and password are required");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/dashboard",
            data: name ? { full_name: name, name } : undefined,
          },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Check your email to confirm your account");
          setMode("signin");
          return;
        }
        toast.success("Account created");
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <GlassCard strong className="w-full max-w-md p-10">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2 font-semibold">
            <div className="grid h-9 w-9 place-items-center rounded-xl gradient-brand shadow-glow">
              <Brain className="h-5 w-5 text-primary-foreground" />
            </div>
            LearnFlow
          </Link>
          <h1 className="mt-6 text-2xl font-semibold">
            {mode === "signin" ? "Sign in to continue" : "Create your account"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Pick up where you left off in your AI learning workspace."
              : "Start building personalized AI-powered learning sessions."}
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-1 rounded-lg border border-border bg-card/40 p-1 text-sm">
          {(["signin", "signup"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "rounded-md px-3 py-1.5 transition",
                mode === m ? "gradient-brand-soft text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "signin" ? "Sign in" : "Sign up"}
            </button>
          ))}
        </div>

        <form onSubmit={handleEmailSubmit} className="mt-6 space-y-3">
          {mode === "signup" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground" htmlFor="name">Name (optional)</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                maxLength={120}
                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                placeholder="Ada Lovelace"
              />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              maxLength={255}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              minLength={8}
              maxLength={128}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg gradient-brand px-4 py-2.5 font-medium text-primary-foreground shadow-glow disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
        </div>

        <button
          onClick={signInGoogle}
          disabled={oauthLoading}
          className="inline-flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 font-medium hover:bg-accent disabled:opacity-60"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="#fff" d="M21.35 11.1H12v2.92h5.36c-.23 1.5-1.66 4.4-5.36 4.4-3.23 0-5.86-2.67-5.86-5.96 0-3.3 2.63-5.96 5.86-5.96 1.84 0 3.07.78 3.78 1.45l2.58-2.49C16.74 3.97 14.6 3 12 3 6.92 3 2.83 7.08 2.83 12.16 2.83 17.24 6.92 21.32 12 21.32c6.93 0 11.5-4.87 11.5-11.72 0-.79-.08-1.39-.15-2z"/></svg>
          {oauthLoading ? "Connecting…" : "Continue with Google"}
        </button>

        <Link
          to="/guest/dashboard"
          className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          Continue without login →
        </Link>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Guest progress stays in this browser only. By continuing you agree to the terms of use.
        </p>
      </GlassCard>
    </main>
  );
}
