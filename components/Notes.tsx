"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type Note = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
};

const inputClass =
  "rounded border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700";
const primaryBtn =
  "rounded bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";
const secondaryBtn =
  "rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700";

export default function Notes({ email, initialNotes }: { email: string; initialNotes: Note[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createNote(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() && !content.trim()) return;
    setBusy(true);
    setError(null);
    // user_id is filled in by the database default (auth.uid()); RLS checks it.
    const { data, error } = await supabase
      .from("notes")
      .insert({ title: title.trim(), content: content.trim() })
      .select()
      .single();
    if (error) setError(error.message);
    else {
      setNotes([data as Note, ...notes]);
      setTitle("");
      setContent("");
    }
    setBusy(false);
  }

  function startEdit(note: Note) {
    setEditingId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
  }

  async function saveEdit(id: string) {
    setBusy(true);
    setError(null);
    const { data, error } = await supabase
      .from("notes")
      .update({ title: editTitle.trim(), content: editContent.trim() })
      .eq("id", id)
      .select()
      .single();
    if (error) setError(error.message);
    else {
      setNotes(notes.map((n) => (n.id === id ? (data as Note) : n)));
      setEditingId(null);
    }
    setBusy(false);
  }

  async function deleteNote(id: string) {
    if (!confirm("Delete this note?")) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) setError(error.message);
    else setNotes(notes.filter((n) => n.id !== id));
    setBusy(false);
  }

  async function logOut() {
    await supabase.auth.signOut();
    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My notes</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-zinc-500">{email}</span>
          <button onClick={logOut} className={secondaryBtn}>
            Log out
          </button>
        </div>
      </header>

      <form
        onSubmit={createNote}
        className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
        />
        <textarea
          placeholder="Write a note…"
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className={inputClass}
        />
        <div>
          <button type="submit" disabled={busy} className={primaryBtn}>
            Add note
          </button>
        </div>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {notes.length === 0 ? (
        <p className="text-center text-sm text-zinc-500">No notes yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((note) => (
            <li
              key={note.id}
              className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              {editingId === note.id ? (
                <div className="flex flex-col gap-2">
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className={inputClass}
                  />
                  <textarea
                    rows={4}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className={inputClass}
                  />
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(note.id)} disabled={busy} className={primaryBtn}>
                      Save
                    </button>
                    <button onClick={() => setEditingId(null)} disabled={busy} className={secondaryBtn}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="font-medium">{note.title || "Untitled"}</h2>
                    <time className="shrink-0 text-xs text-zinc-500">
                      {new Date(note.created_at).toLocaleString()}
                    </time>
                  </div>
                  {note.content && (
                    <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                      {note.content}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(note)} disabled={busy} className={secondaryBtn}>
                      Edit
                    </button>
                    <button
                      onClick={() => deleteNote(note.id)}
                      disabled={busy}
                      className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 disabled:opacity-50 dark:border-red-800"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
