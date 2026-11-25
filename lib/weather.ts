import "server-only";

// Server-only: this module reads WEATHER_API_KEY. The `server-only` import
// makes the build fail if a Client Component ever imports it, so the key
// can't end up in the browser bundle.

/** The city shown in the weather widget. Any WeatherAPI.com `q` value works
 *  ("Paris", "London, UK", a US zip code, "lat,lon"). */
export const WEATHER_CITY = "Dickson, Tennessee";

export type Weather = {
  location: string;
  tempC: number;
  tempF: number;
  condition: string;
  iconUrl: string;
};

export type WeatherResult = { ok: true; weather: Weather } | { ok: false; reason: string };

export async function getCurrentWeather(city: string = WEATHER_CITY): Promise<WeatherResult> {
  const key = process.env.WEATHER_API_KEY;
  if (!key) return { ok: false, reason: "Weather API key not set" };
  if (!city) return { ok: false, reason: "No city configured" };

  const url = new URL("https://api.weatherapi.com/v1/current.json");
  url.searchParams.set("key", key);
  url.searchParams.set("q", city);

  // Never log `url` or the error object: the URL contains the API key.
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (res.status !== 200) {
      // WeatherAPI error bodies look like { error: { code, message } }.
      const body = await res.text();
      let message = res.statusText || "Unknown error";
      try {
        message = JSON.parse(body)?.error?.message ?? message;
      } catch {
        // Not JSON; keep the status text.
      }
      // Belt and braces: strip the key if it ever appears in the message.
      message = message.split(key).join("[redacted]");
      const reason = `Weather error ${res.status}: ${message}`;
      console.error(`[weather] ${reason}`);
      return { ok: false, reason };
    }
    const data = await res.json();
    const icon: string = data.current.condition.icon; // e.g. "//cdn.weatherapi.com/..."
    return {
      ok: true,
      weather: {
        location: data.location.name,
        tempC: Math.round(data.current.temp_c),
        tempF: Math.round(data.current.temp_f),
        condition: data.current.condition.text,
        iconUrl: icon.startsWith("//") ? `https:${icon}` : icon,
      },
    };
  } catch {
    console.error("[weather] Request to WeatherAPI failed");
    return { ok: false, reason: "Weather unavailable" };
  }
}
