import { connection } from "next/server";
import { getCurrentWeather } from "@/lib/weather";

// Server Component: fetches on the server at request time. Only the rendered
// text and icon reach the browser — never the API key.
export default async function WeatherWidget() {
  await connection(); // fetch on every page load, never at build time
  const result = await getCurrentWeather();

  if (!result.ok) {
    return (
      <p
        role="alert"
        className="max-w-xs rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400"
      >
        {result.reason}
      </p>
    );
  }

  const { location, tempC, tempF, condition, iconUrl } = result.weather;
  return (
    <div
      className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-800 dark:bg-zinc-900"
      title={condition}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny external icon, no optimization needed */}
      <img src={iconUrl} alt="" width={32} height={32} className="h-8 w-8" />
      <div className="leading-tight">
        <p className="font-medium">
          {tempF}°F <span className="text-zinc-500">/ {tempC}°C</span>
        </p>
        <p className="text-xs text-zinc-500">
          {location} · {condition}
        </p>
      </div>
    </div>
  );
}
