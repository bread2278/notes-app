import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

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

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

type CacheRow = {
  city: string;
  location: string;
  temp_c: number;
  temp_f: number;
  condition: string;
  icon_url: string;
  fetched_at: string;
};

/**
 * Current weather for `city`, served from the Supabase `weather_cache` table
 * when the cached row is under an hour old; otherwise fetched from WeatherAPI
 * and written back to the cache. Errors are never cached. If the cache itself
 * is unavailable, falls back to calling WeatherAPI directly.
 *
 * Callers must already be in request-time rendering (WeatherWidget calls
 * `await connection()`), since this reads the clock.
 */
export async function getCurrentWeather(city: string = WEATHER_CITY): Promise<WeatherResult> {
  if (!city) return { ok: false, reason: "No city configured" };
  const cacheKey = city.trim().toLowerCase();
  const db = createAdminClient();

  if (!db) {
    console.warn("[weather] SUPABASE_SECRET_KEY not set; skipping cache");
    return fetchFromWeatherApi(city);
  }

  // 1. Try the cache.
  const { data: row, error: readError } = await db
    .from("weather_cache")
    .select("*")
    .eq("city", cacheKey)
    .maybeSingle<CacheRow>();

  if (readError) {
    // PostgREST error messages don't contain keys; log code + message only.
    console.error(`[weather] cache read failed (${readError.code}): ${readError.message}`);
    return fetchFromWeatherApi(city);
  }

  if (row) {
    const ageMs = Date.now() - new Date(row.fetched_at).getTime();
    if (ageMs < CACHE_TTL_MS) {
      console.log(`[weather] cache hit for "${cacheKey}" (age ${Math.floor(ageMs / 60000)}m)`);
      return {
        ok: true,
        weather: {
          location: row.location,
          tempC: row.temp_c,
          tempF: row.temp_f,
          condition: row.condition,
          iconUrl: row.icon_url,
        },
      };
    }
  }

  // 2. Missing or stale: fetch fresh weather.
  const result = await fetchFromWeatherApi(city);
  if (!result.ok) return result; // don't cache errors

  // 3. Write it back. A failed write still shows the fresh weather.
  const w = result.weather;
  const { error: writeError } = await db.from("weather_cache").upsert({
    city: cacheKey,
    location: w.location,
    temp_c: w.tempC,
    temp_f: w.tempF,
    condition: w.condition,
    icon_url: w.iconUrl,
    fetched_at: new Date().toISOString(),
  });
  if (writeError) {
    console.error(`[weather] cache write failed (${writeError.code}): ${writeError.message}`);
  } else {
    console.log(`[weather] cache ${row ? "stale" : "miss"} for "${cacheKey}" → fetched and cached`);
  }
  return result;
}

/** Calls WeatherAPI.com directly (no cache). */
async function fetchFromWeatherApi(city: string): Promise<WeatherResult> {
  const key = process.env.WEATHER_API_KEY;
  if (!key) return { ok: false, reason: "Weather API key not set" };

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
