"use server";

// Server Actions for every note write. Each action is a public POST endpoint
// (see the Next.js data-security guide), so each one:
//   1. re-checks who is logged in (never trusts the page),
//   2. validates its input with Zod (never trusts the client),
//   3. writes with the server Supabase client, where RLS still limits the
//      user to their own rows,
//   4. returns only friendly messages; details are logged in development.

import { friendly, logDevError, runDb } from "@/lib/errors";
import { getSimulateDbError } from "@/lib/simulate";
import { createClient } from "@/lib/supabase/server";
import {
  createNoteSchema,
  deleteNoteSchema,
  firstIssue,
  updateNoteSchema,
} from "@/lib/validation";
import type { Note } from "@/components/Notes";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; message: string };

const NOT_LOGGED_IN = "You're logged out. Refresh the page and log in again.";

async function getUserClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? supabase : null;
}

export async function createNoteAction(input: unknown): Promise<ActionResult<Note>> {
  const parsed = createNoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };

  const supabase = await getUserClient();
  if (!supabase) return { ok: false, message: NOT_LOGGED_IN };

  // user_id is filled in by the database default (auth.uid()); RLS checks it.
  const { data, error } = await runDb<Note>(getSimulateDbError().writes, () =>
    supabase.from("notes").insert(parsed.data).select().single(),
  );
  if (error || !data) {
    logDevError("create note (server action)", error);
    return { ok: false, message: friendly.saveNote };
  }
  return { ok: true, data };
}

export async function updateNoteAction(input: unknown): Promise<ActionResult<Note>> {
  const parsed = updateNoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };

  const supabase = await getUserClient();
  if (!supabase) return { ok: false, message: NOT_LOGGED_IN };

  const { id, title, content } = parsed.data;
  const { data, error } = await runDb<Note>(getSimulateDbError().writes, () =>
    supabase.from("notes").update({ title, content }).eq("id", id).select().single(),
  );
  if (error || !data) {
    // Also covers "no row": the id isn't this user's (RLS hides it).
    logDevError("update note (server action)", error);
    return { ok: false, message: friendly.saveNote };
  }
  return { ok: true, data };
}

export async function deleteNoteAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = deleteNoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };

  const supabase = await getUserClient();
  if (!supabase) return { ok: false, message: NOT_LOGGED_IN };

  const { error } = await runDb<null>(getSimulateDbError().writes, () =>
    supabase.from("notes").delete().eq("id", parsed.data.id),
  );
  if (error) {
    logDevError("delete note (server action)", error);
    return { ok: false, message: friendly.deleteNote };
  }
  return { ok: true, data: { id: parsed.data.id } };
}
