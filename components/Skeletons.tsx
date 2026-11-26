import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Loading placeholders that mirror the real layouts in Notes.tsx and
// AuthForm.tsx, so content swaps in without the page jumping around.

/** Placeholder for the logged-in notes screen: header, composer, note cards. */
export function NotesSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div
      className="mx-auto flex w-full max-w-2xl flex-col gap-6 pt-2"
      aria-busy="true"
      aria-label="Loading notes"
    >
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-36" />
        <div className="flex items-center gap-3">
          <Skeleton className="hidden h-4 w-32 sm:block" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
        <CardFooter className="justify-end">
          <Skeleton className="h-8 w-24" />
        </CardFooter>
      </Card>

      <ul className="flex flex-col gap-3">
        {Array.from({ length: count }, (_, i) => (
          <li key={i}>
            <NoteCardSkeleton />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One note card: title + timestamp, two lines of text, action row. */
export function NoteCardSkeleton() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-7 w-12" />
          <Skeleton className="h-7 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}

/** Placeholder for the logged-out login card. */
export function LoginSkeleton() {
  return (
    <Card className="mx-auto my-auto w-full max-w-sm" aria-busy="true" aria-label="Loading">
      <CardHeader>
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-48" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-9 w-full" />
        <div className="mt-2 flex gap-2">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 flex-1" />
        </div>
        <Skeleton className="h-9 w-full" />
      </CardContent>
    </Card>
  );
}

/** Placeholder for the top-right weather widget. */
export function WeatherSkeleton() {
  return <Skeleton aria-label="Loading weather" className="h-11 w-44 rounded-xl" />;
}
