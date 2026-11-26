"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

type AuthAction = "login" | "signup" | "github";

export default function AuthForm() {
  const router = useRouter();
  // /auth/callback sends us back here with ?auth_error=... if GitHub sign-in fails.
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(searchParams.get("auth_error"));
  const [message, setMessage] = useState<string | null>(null);
  // Which auth action is in flight (drives the spinner on that button).
  const [pending, setPending] = useState<AuthAction | null>(null);
  // True while router.refresh() swaps in the logged-in page after success.
  const [refreshing, startRefresh] = useTransition();
  const busy = pending !== null || refreshing;
  // Remembers the last action so its button keeps spinning during the refresh.
  const [lastAction, setLastAction] = useState<AuthAction | null>(null);
  function start(action: AuthAction) {
    setLastAction(action);
    setPending(action);
  }

  async function handle(mode: "login" | "signup") {
    setError(null);
    setMessage(null);
    if (!email || !password) {
      setError("Enter an email and password.");
      return;
    }
    start(mode);
    const supabase = createClient();

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else startRefresh(() => router.refresh());
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else if (!data.session)
        setMessage("Account created. Check your inbox to confirm your email, then log in.");
      else startRefresh(() => router.refresh());
    }
    setPending(null);
  }

  async function signInWithGitHub() {
    setError(null);
    setMessage(null);
    start("github");
    const supabase = createClient();
    // Sends the browser to GitHub. Afterwards Supabase redirects to
    // /auth/callback, which finishes the sign-in and returns to "/".
    // On success the page navigates away, so the spinner stays until it does.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setPending(null);
    }
  }

  // Spinner goes on the action in flight, or on the one whose success is now
  // refreshing the page (pending is already cleared by then).
  const spinning = (action: AuthAction) =>
    pending === action || (refreshing && lastAction === action);

  return (
    <Card className="mx-auto my-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">
          <h1>Notes</h1>
        </CardTitle>
        <CardDescription>Log in or create an account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            handle("login");
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-9"
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {message && (
            <Alert>
              <AlertDescription className="text-green-700 dark:text-green-400">{message}</AlertDescription>
            </Alert>
          )}

          <div className="mt-2 flex gap-2">
            <Button
              type="submit"
              size="lg"
              disabled={busy}
              aria-busy={spinning("login")}
              className="flex-1"
            >
              {spinning("login") && <Spinner data-icon="inline-start" />}
              Log in
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              disabled={busy}
              aria-busy={spinning("signup")}
              onClick={() => handle("signup")}
              className="flex-1"
            >
              {spinning("signup") && <Spinner data-icon="inline-start" />}
              Sign up
            </Button>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={busy}
            aria-busy={spinning("github")}
            onClick={signInWithGitHub}
          >
            {spinning("github") ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <svg aria-hidden="true" viewBox="0 0 16 16" className="fill-current">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
            )}
            Continue with GitHub
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
