"use client";

import { useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { NotepadTextIcon } from "lucide-react";
import { toast } from "sonner";
import { friendly, logDevError, runDb } from "@/lib/errors";
import { createClient } from "@/lib/supabase/client";
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
  simulateDbError = false,
  loadFailed = false,
}: {
  email: string;
  initialNotes: Note[];
  /** Loading notes failed, so an empty list doesn't mean "no notes yet". */
  loadFailed?: boolean;
  /** Dev-only: make every note save/delete fail (see lib/simulate.ts). */
  simulateDbError?: boolean;
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

  async function createNote(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) return;
    setPending("create");
    // user_id is filled in by the database default (auth.uid()); RLS checks it.
    const { data, error } = await runDb<Note>(simulateDbError, () =>
      supabase
        .from("notes")
        .insert({ title: title.trim(), content: content.trim() })
        .select()
        .single(),
    );
    if (error || !data) {
      logDevError("create note", error);
      toast.error(friendly.saveNote);
    } else {
      setNotes([data, ...notes]);
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
    const { data, error } = await runDb<Note>(simulateDbError, () =>
      supabase
        .from("notes")
        .update({ title: editTitle.trim(), content: editContent.trim() })
        .eq("id", id)
        .select()
        .single(),
    );
    if (error || !data) {
      logDevError("save note", error);
      toast.error(friendly.saveNote);
    } else {
      closeEditor(id, () => setNotes(notes.map((n) => (n.id === id ? data : n))));
      toast.success("Note saved.");
    }
    setPending(null);
  }

  async function deleteNote(id: string) {
    if (!confirm("Delete this note?")) return;
    setPending(`delete:${id}`);
    const { error } = await runDb<null>(simulateDbError, () =>
      supabase.from("notes").delete().eq("id", id),
    );
    if (error) {
      logDevError("delete note", error);
      toast.error(friendly.deleteNote);
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
                // Coming from the empty state: put the cursor straight in the form.
                autoFocus={composing}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Textarea
                placeholder="Write a note…"
                aria-label="Note"
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
                        aria-label="Title"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                      />
                      <Textarea
                        aria-label="Note"
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
                        <time className="shrink-0 text-xs text-muted-foreground">
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
