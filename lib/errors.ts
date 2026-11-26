// Error helpers shared by server and client code.
//
// Users only ever see short, friendly messages. Full error details (and a
// stack trace) are logged to the console in development only.

export const isDev = process.env.NODE_ENV === "development";

/** Friendly, user-facing messages. Never include raw error text. */
export const friendly = {
  saveNote: "Couldn't save your note. Try again.",
  deleteNote: "Couldn't delete your note. Try again.",
  loadNotes: "Couldn't load your notes. Try refreshing the page.",
  logIn: "Couldn't log you in. Check your email and password and try again.",
  signUp: "Couldn't create your account. Try again.",
  github: "Couldn't sign in with GitHub. Try again.",
  logOut: "Couldn't log you out. Try again.",
} as const;

/**
 * In development, logs the full error plus a stack trace. Supabase errors are
 * plain objects without a stack, so a stack for the call site is captured too.
 * In production this does nothing, so error details never reach the console.
 */
export function logDevError(context: string, error: unknown) {
  if (!isDev) return;
  const stack =
    error instanceof Error && error.stack ? error.stack : new Error(`at ${context}`).stack;
  console.error(`[${context}]`, error, "\n", stack);
}

/** Shape shared by Supabase query results that callers read. */
export type DbResult<T> = { data: T | null; error: unknown };

/**
 * Runs a Supabase query, or (when `simulate` is true) skips it and returns a
 * fake error after a short delay, so failure handling can be tested in dev.
 * `simulate` comes from getSimulateDbError() on the server, which is always
 * false outside development.
 */
export async function runDb<T>(
  simulate: boolean,
  query: () => PromiseLike<DbResult<T>>,
): Promise<DbResult<T>> {
  if (simulate) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { data: null, error: new Error("Simulated database error (SIMULATE_DB_ERROR)") };
  }
  return query();
}
