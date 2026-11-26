import { Suspense } from "react";
import { cookies } from "next/headers";
import { connection } from "next/server";
import AuthForm from "@/components/AuthForm";
import Notes, { type Note } from "@/components/Notes";
import WeatherWidget from "@/components/WeatherWidget";
import { LoginSkeleton, NotesSkeleton, WeatherSkeleton } from "@/components/Skeletons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { friendly, logDevError, runDb } from "@/lib/errors";
import { getSimulateDbError } from "@/lib/simulate";
import { createClient } from "@/lib/supabase/server";

// Cache Components is on (Next.js 16 default), so anything that reads
// cookies has to sit inside <Suspense>.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col bg-background px-4 pb-10">
      {/* Same max width as the notes column, so the widget lines up with the
          header below it instead of drifting to the window corner on wide screens. */}
      <div className="mx-auto flex min-h-14 w-full max-w-2xl justify-end pt-3">
        <Suspense fallback={<WeatherSkeleton />}>
          <WeatherWidget />
        </Suspense>
      </div>
      <Suspense fallback={<NotesSkeleton />}>
        <Gate />
      </Suspense>
    </main>
  );
}

// Picks the right skeleton while the real auth check (a network call) runs.
// Only checks whether a Supabase auth cookie exists, which is instant; it is a
// UI hint, never an access decision (App verifies with getUser(), and RLS
// enforces access in the database).
async function Gate() {
  const cookieStore = await cookies();
  const maybeLoggedIn = cookieStore.getAll().some((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name));

  return (
    <Suspense fallback={maybeLoggedIn ? <NotesSkeleton /> : <LoginSkeleton />}>
      <App />
    </Suspense>
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

  const simulate = getSimulateDbError(); // always off outside development

  // RLS limits this to the logged-in user's rows; no user_id filter is needed.
  const { data: notes, error } = await runDb<Note[]>(simulate.load, () =>
    supabase.from("notes").select("*").order("created_at", { ascending: false }),
  );
  if (error) logDevError("load notes", error);

  return (
    <>
      {error && (
        <Alert variant="destructive" className="mx-auto mt-4 max-w-2xl">
          <AlertDescription>{friendly.loadNotes}</AlertDescription>
        </Alert>
      )}
      <Notes
        key={user.id}
        email={user.email ?? ""}
        initialNotes={notes ?? []}
        simulateDbError={simulate.writes}
        loadFailed={!!error}
      />
    </>
  );
}
