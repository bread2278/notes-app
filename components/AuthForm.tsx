"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handle(mode: "login" | "signup") {
    setError(null);
    setMessage(null);
    if (!email || !password) {
      setError("Enter an email and password.");
      return;
    }
    setBusy(true);
    const supabase = createClient();

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else router.refresh();
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else if (!data.session)
        setMessage("Account created. Check your inbox to confirm your email, then log in.");
      else router.refresh();
    }
    setBusy(false);
  }

  return (
    <form
      className="mx-auto mt-24 flex w-full max-w-sm flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      onSubmit={(e) => {
        e.preventDefault();
        handle("login");
      }}
    >
      <h1 className="text-xl font-semibold">Notes</h1>
      <p className="text-sm text-zinc-500">Log in or create an account.</p>

      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-green-700 dark:text-green-400">{message}</p>}

      <div className="mt-2 flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="flex-1 rounded bg-zinc-900 px-3 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Log in
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => handle("signup")}
          className="flex-1 rounded border border-zinc-300 px-3 py-2 disabled:opacity-50 dark:border-zinc-700"
        >
          Sign up
        </button>
      </div>
    </form>
  );
}
