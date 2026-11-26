import { connection } from "next/server";
import { getCurrentWeather } from "@/lib/weather";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

// Server Component: fetches on the server at request time. Only the rendered
// text and icon reach the browser — never the API key.
export default async function WeatherWidget() {
  await connection(); // fetch on every page load, never at build time
  const result = await getCurrentWeather();

  if (!result.ok) {
    return (
      <Alert variant="destructive" className="w-auto max-w-xs border-destructive/50 py-1.5">
        <AlertDescription className="text-xs">{result.reason}</AlertDescription>
      </Alert>
    );
  }

  const { location, tempC, tempF, condition, iconUrl } = result.weather;
  return (
    <Card size="sm" className="flex-row items-center gap-2 px-3 py-1.5" title={condition}>
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny external icon, no optimization needed */}
      <img src={iconUrl} alt="" width={32} height={32} className="h-8 w-8" />
      <div className="leading-tight">
        <p className="font-medium">
          {tempF}°F <span className="text-muted-foreground">/ {tempC}°C</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {location} · {condition}
        </p>
      </div>
    </Card>
  );
}
