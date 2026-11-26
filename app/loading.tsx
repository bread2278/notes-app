import { NotesSkeleton, WeatherSkeleton } from "@/components/Skeletons";

// Route-level loading UI for "/" (the app's only page, where the notes live).
// Next.js wraps the page in <Suspense> with this as the fallback, so a slow
// load or refresh shows skeleton cards instead of a blank screen.
export default function Loading() {
  return (
    <main className="flex flex-1 flex-col bg-background px-4 pb-10">
      <div className="mx-auto flex min-h-14 w-full max-w-2xl justify-end pt-3">
        <WeatherSkeleton />
      </div>
      <NotesSkeleton />
    </main>
  );
}
