"use client";

import { useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { NotepadTextIcon } from "lucide-react";
import { toast } from "sonner";
import {
  createNoteAction,
  deleteNoteAction,
  updateNoteAction,
  type ActionResult,
} from "@/app/actions/notes";
import { friendly, logDevError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/client";
import { NOTE_CONTENT_MAX, NOTE_TITLE_MAX } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

export type Note = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
};

/** The action in flight; per-note actions carry the note id so only that button spins. */
type Pending = "create" | "logout" | `save:${string}` | `delete:${string}`;

export default function Notes({
  email,
  initialNotes,
  loadFailed = false,
}: {
  email: string;
  initialNotes: Note[];
  /** Loading notes failed, so an empty list doesn't mean "no notes yet". */
  loadFailed?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  // "Add note" needs something to save.
  const canCreate = title.trim() !== "" || content.trim() !== "";
  // With zero notes the composer is hidden behind the empty state until the
  // user clicks "Create your first note".
  const [composing, setComposing] = useState(false);
  const showEmptyState = notes.length === 0 && !composing && !loadFailed;
  // True while router.refresh() swaps back to the login screen after log out.
  const [refreshing, startRefresh] = useTransition();
  // Every action button is disabled while anything is pending.
  const busy = pending !== null || refreshing;

  // Focus management for keyboard and screen-reader users: when the control
  // that had focus disappears (Edit -> form, Save/Cancel -> view, Delete),
  // move focus somewhere sensible instead of dropping it to the page top.
  const editButtons = useRef(new Map<string, HTMLButtonElement>());
  const composerTitle = useRef<HTMLInputElement>(null);
  const emptyStateButton = useRef<HTMLButtonElement>(null);

  /** Leave edit mode and put focus back on that note's Edit button. */
  function closeEditor(id: string, update?: () => void) {
    // flushSync renders now, so the Edit button exists (and is enabled) before we focus it.
    flushSync(() => {
      update?.();
      setEditingId(null);
      setPending(null);
    });
    editButtons.current.get(id)?.focus();
  }

  /**
   * Calls a Server Action. Validation and database errors come back as
   * friendly messages; a thrown error (e.g. the network dropped) becomes
   * `fallback`. Raw error details are only logged, in development.
   */
  async function run<T>(
    context: string,
    fallback: string,
    action: () => Promise<ActionResult<T>>,
  ): Promise<ActionResult<T>> {
    try {
      return await action();
    } catch (error) {
      logDevError(context, error);
      return { ok: false, message: fallback };
    }
  }

  async function createNote(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) return;
    setPending("create");
    // The server action re-validates (Zod) and checks the user; RLS checks ownership.
    const result = await run("create note", friendly.saveNote, () =>
      createNoteAction({ title, content }),
    );
    if (!result.ok) {
      toast.error(result.message);
    } else {
      setNotes([result.data, ...notes]);
      setTitle("");
      setContent("");
      toast.success("Note saved.");
    }
    setPending(null);
  }

  // "Save" needs a non-empty note that differs from what's already saved.
  function canSave(note: Note) {
    const t = editTitle.trim();
    const c = editContent.trim();
    if (!t && !c) return false;
    return t !== note.title || c !== note.content;
  }

  function startEdit(note: Note) {
    setEditingId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
  }

  async function saveEdit(id: string) {
    setPending(`save:${id}`);
    const result = await run("save note", friendly.saveNote, () =>
      updateNoteAction({ id, title: editTitle, content: editContent }),
    );
    if (!result.ok) {
      toast.error(result.message);
    } else {
      const saved = result.data;
      closeEditor(id, () => setNotes(notes.map((n) => (n.id === id ? saved : n))));
      toast.success("Note saved.");
    }
    setPending(null);
  }

  async function deleteNote(id: string) {
    if (!confirm("Delete this note?")) return;
    setPending(`delete:${id}`);
    const result = await run("delete note", friendly.deleteNote, () => deleteNoteAction({ id }));
    if (!result.ok) {
      toast.error(result.message);
    } else {
      // Focus the next note (or the previous one if this was last); with no
      // notes left, the empty-state button or the new-note Title field.
      const index = notes.findIndex((n) => n.id === id);
      const neighbor = notes[index + 1] ?? notes[index - 1];
      flushSync(() => {
        setNotes(notes.filter((n) => n.id !== id));
        setPending(null);
      });
      const target = neighbor
        ? editButtons.current.get(neighbor.id)
        : (emptyStateButton.current ?? composerTitle.current);
      target?.focus();
      toast.success("Note deleted.");
    }
    setPending(null);
  }

  async function logOut() {
    setPending("logout");
    const { error } = await supabase.auth.signOut();
    if (error) {
      logDevError("log out", error);
      toast.error(friendly.logOut);
    } else {
      startRefresh(() => router.refresh());
    }
    setPending(null);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 pt-2">
      <header className="flex items-center justify-between gap-4">
        {/* The title and Log out never shrink; only the email gives way. */}
        <h1 className="shrink-0 text-2xl font-semibold">My notes</h1>
        {/* min-w-0 lets this flex item shrink below its content so the email can truncate. */}
        <div className="flex min-w-0 items-center gap-3 text-sm">
          <span className="min-w-0 truncate text-muted-foreground" title={email}>
            {email}
          </span>
          <Button
            variant="outline"
            onClick={logOut}
            disabled={busy}
            aria-busy={pending === "logout" || refreshing}
          >
            {(pending === "logout" || refreshing) && <Spinner data-icon="inline-start" aria-hidden="true" />}
            Log out
          </Button>
        </div>
      </header>

      {showEmptyState ? (
        <Card className="mx-auto mt-10 w-full max-w-md text-center">
          <CardHeader className="justify-items-center gap-2">
            <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
              <NotepadTextIcon aria-hidden="true" className="size-6 text-muted-foreground" />
            </div>
            <CardTitle className="text-lg font-semibold">
              <h2>No notes yet</h2>
            </CardTitle>
            <CardDescription className="text-balance">
              Capture ideas, to-dos, and anything you want to remember. Only you can see your
              notes.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button ref={emptyStateButton} size="lg" onClick={() => setComposing(true)}>
              Create your first note
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          {/* `contents` keeps CardContent/CardFooter as direct flex children of the Card. */}
          <form onSubmit={createNote} className="contents">
            <CardContent className="flex flex-col gap-2">
              <Input
                ref={composerTitle}
                placeholder="Title"
                aria-label="Title"
                maxLength={NOTE_TITLE_MAX}
                // Coming from the empty state: put the cursor straight in the form.
                autoFocus={composing}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Textarea
                placeholder="Write a note…"
                aria-label="Note"
                maxLength={NOTE_CONTENT_MAX}
                rows={3}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </CardContent>
            <CardFooter className="justify-end">
              <Button type="submit" disabled={busy || !canCreate} aria-busy={pending === "create"}>
                {pending === "create" && <Spinner data-icon="inline-start" aria-hidden="true" />}
                Add note
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {notes.length > 0 && (
        <ul className="flex flex-col gap-3">
          {notes.map((note) => (
            <li key={note.id}>
              <Card>
                <CardContent>
                  {editingId === note.id ? (
                    <div className="flex flex-col gap-2">
                      <Input
                        // Edit was just pressed and has disappeared: move focus into the form.
                        autoFocus
                        // Distinct from the new-note form's "Title" field.
                        aria-label="Edit title"
                        maxLength={NOTE_TITLE_MAX}
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                      />
                      <Textarea
                        aria-label="Edit note text"
                        maxLength={NOTE_CONTENT_MAX}
                        rows={4}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                      />
                      {/* Distinct keys so React doesn't reuse (and color-animate) the Edit/Delete buttons. */}
                      <div className="flex justify-end gap-2">
                        <Button
                          key="cancel"
                          variant="outline"
                          onClick={() => closeEditor(note.id)}
                          disabled={busy}
                        >
                          Cancel
                        </Button>
                        <Button
                          key="save"
                          onClick={() => saveEdit(note.id)}
                          disabled={busy || !canSave(note)}
                          aria-busy={pending === `save:${note.id}`}
                        >
                          {pending === `save:${note.id}` && <Spinner data-icon="inline-start" aria-hidden="true" />}
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {/* Phones: timestamp under the title so the title gets the full width.
                          sm and up: side by side. */}
                      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                        {/* min-w-0 + wrap-anywhere: long unbroken titles wrap inside the card. */}
                        <h2 className="min-w-0 text-base font-semibold wrap-anywhere">
                          {note.title || "Untitled"}
                        </h2>
                        <time dateTime={note.created_at} className="shrink-0 text-xs text-muted-foreground">
                          {new Date(note.created_at).toLocaleString()}
                        </time>
                      </div>
                      {note.content && (
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-card-foreground/90 wrap-break-word">
                          {note.content}
                        </p>
                      )}
                      <div className="-ml-2.5 flex gap-1">
                        <Button
                          key="edit"
                          ref={(el: HTMLButtonElement | null) => {
                            if (el) editButtons.current.set(note.id, el);
                            else editButtons.current.delete(note.id);
                          }}
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(note)}
                          disabled={busy}
                          // Says which note; starts with the visible word so voice control still matches.
                          aria-label={`Edit note: ${note.title || "Untitled"}`}
                        >
                          Edit
                        </Button>
                        <Button
                          key="delete"
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteNote(note.id)}
                          disabled={busy}
                          aria-busy={pending === `delete:${note.id}`}
                          aria-label={`Delete note: ${note.title || "Untitled"}`}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          {pending === `delete:${note.id}` && <Spinner data-icon="inline-start" aria-hidden="true" />}
                          Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
