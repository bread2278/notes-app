import { Suspense } from "react";
import { connection } from "next/server";
import AuthForm from "@/components/AuthForm";
import Notes, { type Note } from "@/components/Notes";
import WeatherWidget from "@/components/WeatherWidget";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/server";

// Cache Components is on (Next.js 16 default), so anything that reads
// cookies has to sit inside <Suspense>.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col bg-zinc-50 px-4 dark:bg-black">
      <div className="flex min-h-14 justify-end pt-3">
        <Suspense fallback={<p className="text-xs text-zinc-500">Loading weather…</p>}>
          <WeatherWidget />
        </Suspense>
      </div>
      <Suspense fallback={<p className="mt-24 text-center text-sm text-zinc-500">Loading…</p>}>
        <App />
      </Suspense>
    </main>
  );
}

async function App() {
  // Supabase auth reads the clock (Date.now) to check token expiry. Opt this
  // component into request-time rendering first so Next.js never prerenders it.
  await connection();
  const supabase = await createClient();
  // getUser() verifies the session with Supabase Auth (don't trust cookies alone).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <AuthForm />;

  // RLS limits this to the logged-in user's rows; no user_id filter is needed.
  const { data: notes, error } = await supabase
    .from("notes")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <>
      {error && (
        <Alert variant="destructive" className="mx-auto mt-4 max-w-2xl">
          <AlertDescription>Couldn&apos;t load notes: {error.message}</AlertDescription>
        </Alert>
      )}
      <Notes key={user.id} email={user.email ?? ""} initialNotes={(notes ?? []) as Note[]} />
    </>
  );
}
