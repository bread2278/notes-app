import "server-only";

/**
 * Dev-only database error simulation, controlled by SIMULATE_DB_ERROR in
 * .env.local:
 *
 *   SIMULATE_DB_ERROR=true   every note save and delete fails
 *   SIMULATE_DB_ERROR=load   loading notes fails too
 *   (unset / anything else)  off
 *
 * Always off unless NODE_ENV is "development", so it can never affect a
 * production build, even if the variable is set there by mistake.
 */
export function getSimulateDbError(): { writes: boolean; load: boolean } {
  if (process.env.NODE_ENV !== "development") return { writes: false, load: false };
  const value = process.env.SIMULATE_DB_ERROR?.trim().toLowerCase();
  return { writes: value === "true" || value === "load", load: value === "load" };
}
