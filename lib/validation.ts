import { z } from "zod";

// Input rules for notes, shared by the Server Actions (which enforce them)
// and the form (which mirrors the limits with maxLength for instant feedback).
// The same limits are enforced again by CHECK constraints in
// supabase/schema.sql, because the publishable key lets anyone call Supabase
// directly and skip this app's server.

export const NOTE_TITLE_MAX = 200;
export const NOTE_CONTENT_MAX = 20_000;

/** Friendly messages only; these are shown to users as-is. */
export const validationMessages = {
  titleTooLong: `Titles can be up to ${NOTE_TITLE_MAX} characters.`,
  contentTooLong: `Notes can be up to ${NOTE_CONTENT_MAX.toLocaleString("en-US")} characters.`,
  empty: "Add a title or some text first.",
  badId: "That note couldn't be found. Refresh the page and try again.",
} as const;

const title = z.string().trim().max(NOTE_TITLE_MAX, validationMessages.titleTooLong);
const content = z.string().trim().max(NOTE_CONTENT_MAX, validationMessages.contentTooLong);

/** Note ids are Postgres uuids (gen_random_uuid()). */
export const noteIdSchema = z.uuid(validationMessages.badId);

const notFieldsEmpty = (v: { title: string; content: string }) =>
  v.title !== "" || v.content !== "";

/** Creating a note: trimmed, within limits, not completely empty. */
export const createNoteSchema = z
  .object({ title, content })
  .strict()
  .refine(notFieldsEmpty, validationMessages.empty);

/** Editing a note: same rules plus a valid id. */
export const updateNoteSchema = z
  .object({ id: noteIdSchema, title, content })
  .strict()
  .refine(notFieldsEmpty, validationMessages.empty);

/** Deleting a note: just a valid id. */
export const deleteNoteSchema = z.object({ id: noteIdSchema }).strict();

/**
 * Query string of /auth/callback. Supabase's PKCE auth code is a short opaque
 * token (a UUID today); allow URL-safe characters only and cap the length so
 * arbitrary junk is never forwarded to Supabase. Provider error text is only
 * logged in development, but is still length-capped.
 */
export const oauthCallbackSchema = z.object({
  code: z
    .string()
    .regex(/^[A-Za-z0-9._~-]{1,512}$/)
    .optional(),
  error: z.string().max(200).optional(),
  error_description: z.string().max(1000).optional(),
});

const friendlyMessages = new Set<string>(Object.values(validationMessages));

/**
 * First user-facing message from a failed parse. Only our own friendly
 * messages pass through; Zod's built-in wording (e.g. "Unrecognized key",
 * "expected string") only happens for hand-crafted requests and stays generic.
 */
export function firstIssue(error: z.ZodError): string {
  const message = error.issues[0]?.message;
  return message && friendlyMessages.has(message)
    ? message
    : "Something about that note isn't valid. Refresh the page and try again.";
}
