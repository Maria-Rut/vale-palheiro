/**
 * Weather + sea forecast for Vale Palheiro.
 *
 * Two sources share one interface:
 *   - SimulatedWeather: deterministic, offline, used for the demo. It produces
 *     a realistic run of Costa Vicentina days (rain, sun, big Atlantic swell…).
 *   - OpenMeteoWeather: the live source. Open-Meteo (https://open-meteo.com)
 *     blends the official national models (ECMWF, Météo-France, DWD ICON…) and
 *     has a separate Marine API with wave height — which is what tells us when
 *     the Atlantic is putting on a show. No key needed for testing; a hotel is
 *     commercial use, so production should use a paid key (OPEN_METEO_API_KEY),
 *     which switches to the customer endpoints automatically.
 *
 * Switch with WEATHER_SOURCE=open-meteo. If the live call fails, the system never
 * invents weather: recommendations simply drop the forecast wording.
 */

import { RESORT_TZ, zonedParts } from "./timezone.ts";

export interface DayForecast {
  /** Local date at the resort, "YYYY-MM-DD". */
  date: string;
  /** WMO weather code (0 clear … 61-65 rain … 95 thunderstorm). */
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  /** Max chance of rain that day, %. */
  rainChance: number;
  rainMm: number;
  windMaxKmh: number;
  gustMaxKmh: number;
  /** Max significant wave height on the west coast, metres. */
  waveHeightM: number;
  wavePeriodS: number;
}

export interface Forecast {
  source: "simulated" | "open-meteo";
  fetchedAt: string;
  days: DayForecast[];
}

export interface WeatherSource {
  readonly name: Forecast["source"];
  getForecast(): Promise<Forecast>;
}

/** The estate (land forecast) and the nearest open coast (sea forecast). */
export const LOCATION = {
  estate: { lat: 37.31, lon: -8.83 },
  coast: { lat: 37.34, lon: -8.87 }, // off Monte Clérigo
};

/** Resort-local "YYYY-MM-DD" for `date`, shifted by `addDays`. */
export function resortDate(date: Date, addDays = 0): string {
  const p = zonedParts(date, RESORT_TZ);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + addDays));
  return d.toISOString().slice(0, 10);
}

// ----------------------------------------------------------- simulated

/**
 * A believable autumn/winter run on the Costa Vicentina, repeating weekly from
 * today so the demo always shows a mix: rain, sun, a big swell, showers, calm.
 */
const PATTERN: Omit<DayForecast, "date">[] = [
  { weatherCode: 2, tempMax: 18, tempMin: 10, rainChance: 10, rainMm: 0, windMaxKmh: 14, gustMaxKmh: 25, waveHeightM: 1.8, wavePeriodS: 10 },
  { weatherCode: 63, tempMax: 15, tempMin: 11, rainChance: 90, rainMm: 12, windMaxKmh: 30, gustMaxKmh: 55, waveHeightM: 2.6, wavePeriodS: 11 },
  { weatherCode: 1, tempMax: 19, tempMin: 9, rainChance: 5, rainMm: 0, windMaxKmh: 12, gustMaxKmh: 22, waveHeightM: 1.4, wavePeriodS: 9 },
  { weatherCode: 2, tempMax: 17, tempMin: 10, rainChance: 15, rainMm: 0, windMaxKmh: 22, gustMaxKmh: 38, waveHeightM: 4.2, wavePeriodS: 14 },
  { weatherCode: 80, tempMax: 16, tempMin: 10, rainChance: 50, rainMm: 2, windMaxKmh: 20, gustMaxKmh: 35, waveHeightM: 2.2, wavePeriodS: 11 },
  { weatherCode: 0, tempMax: 20, tempMin: 9, rainChance: 0, rainMm: 0, windMaxKmh: 8, gustMaxKmh: 15, waveHeightM: 1.1, wavePeriodS: 8 },
  { weatherCode: 3, tempMax: 17, tempMin: 11, rainChance: 25, rainMm: 0.2, windMaxKmh: 18, gustMaxKmh: 30, waveHeightM: 1.9, wavePeriodS: 10 },
];

export class SimulatedWeather implements WeatherSource {
  readonly name = "simulated" as const;
  async getForecast(): Promise<Forecast> {
    const now = new Date();
    const days: DayForecast[] = [];
    for (let i = 0; i < 16; i++) {
      days.push({ date: resortDate(now, i), ...PATTERN[i % PATTERN.length] });
    }
    return { source: this.name, fetchedAt: now.toISOString(), days };
  }
}

// ----------------------------------------------------------- Open-Meteo

type Daily = Record<string, (number | string | null)[]>;

export class OpenMeteoWeather implements WeatherSource {
  readonly name = "open-meteo" as const;
  private readonly apiKey?: string;
  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  private url(kind: "forecast" | "marine", params: Record<string, string | number>): string {
    const host = kind === "forecast"
      ? (this.apiKey ? "customer-api.open-meteo.com" : "api.open-meteo.com")
      : (this.apiKey ? "customer-marine-api.open-meteo.com" : "marine-api.open-meteo.com");
    const q = new URLSearchParams({
      ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
      timezone: RESORT_TZ,
      forecast_days: "16",
      ...(this.apiKey ? { apikey: this.apiKey } : {}),
    });
    return `https://${host}/v1/${kind}?${q}`;
  }

  private async daily(url: string): Promise<Daily> {
    // Some hosts/APIs reject the default Node fetch; send a UA + JSON accept.
    // One retry smooths over a cold-start or transient network blip.
    const opts: RequestInit = {
      signal: AbortSignal.timeout(12_000),
      headers: { "User-Agent": "ValePalheiro-GuestMessaging/1.0", Accept: "application/json" },
    };
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, opts);
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(`Open-Meteo HTTP ${res.status}${body ? ` — ${body.slice(0, 160)}` : ""}`);
        }
        const json = (await res.json()) as { daily?: Daily };
        if (!json.daily) throw new Error("Open-Meteo: response had no daily data");
        return json.daily;
      } catch (e) {
        lastErr = e;
        const reason = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
        console.error(`[weather] fetch attempt ${attempt + 1} failed for ${url} — ${reason}`);
        if (attempt === 0) await new Promise((r) => setTimeout(r, 800));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  async getForecast(): Promise<Forecast> {
    const [land, sea] = await Promise.all([
      this.daily(this.url("forecast", {
        latitude: LOCATION.estate.lat, longitude: LOCATION.estate.lon,
        daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max",
      })),
      this.daily(this.url("marine", {
        latitude: LOCATION.coast.lat, longitude: LOCATION.coast.lon,
        daily: "wave_height_max,wave_period_max",
      })),
    ]);
    const num = (v: unknown, fallback = 0) => (typeof v === "number" ? v : fallback);
    const seaByDate = new Map<string, number>();
    (sea.time as string[]).forEach((d, i) => seaByDate.set(d, i));

    const days = (land.time as string[]).map((date, i) => {
      const j = seaByDate.get(date);
      return {
        date,
        weatherCode: num(land.weather_code[i]),
        tempMax: num(land.temperature_2m_max[i]),
        tempMin: num(land.temperature_2m_min[i]),
        rainChance: num(land.precipitation_probability_max[i]),
        rainMm: num(land.precipitation_sum[i]),
        windMaxKmh: num(land.wind_speed_10m_max[i]),
        gustMaxKmh: num(land.wind_gusts_10m_max[i]),
        waveHeightM: j === undefined ? 0 : num(sea.wave_height_max[j]),
        wavePeriodS: j === undefined ? 0 : num(sea.wave_period_max[j]),
      };
    });
    return { source: this.name, fetchedAt: new Date().toISOString(), days };
  }
}

// ----------------------------------------------------------- caching + choice

/**
 * Caches the forecast and is careful with the API's rate limits.
 *   - Serves the cached forecast for `ttlMs` (default 3h).
 *   - On a failure, keeps showing the last good forecast (up to 2 days old).
 *   - On a rate-limit (HTTP 429), backs off until the next day before trying
 *     again, so we don't keep burning the daily quota with every page view.
 */
export class CachedWeather {
  private last?: Forecast;
  private lastError?: string;
  private retryNotBefore = 0; // epoch ms; don't call the source before this
  private readonly source: WeatherSource;
  private readonly ttlMs: number;
  constructor(source: WeatherSource, ttlMs = 3 * 3600_000) {
    this.source = source;
    this.ttlMs = ttlMs;
  }

  get sourceName() { return this.source.name; }
  get error() { return this.lastError; }

  async get(): Promise<Forecast | undefined> {
    const now = Date.now();
    const fresh = this.last && now - Date.parse(this.last.fetchedAt) < this.ttlMs;
    if (fresh) return this.last;
    // Still in a back-off window (e.g. after a 429) — serve what we have.
    if (now < this.retryNotBefore) return this.last;

    try {
      this.last = await this.source.getForecast();
      this.lastError = undefined;
      this.retryNotBefore = 0;
    } catch (e) {
      this.lastError = e instanceof Error ? e.message : String(e);
      const rateLimited = /\b429\b|request limit/i.test(this.lastError);
      // 429 = daily cap: wait 6h before trying again (quota resets ~midnight UTC).
      // Other errors: short back-off so a blip doesn't spam retries.
      this.retryNotBefore = now + (rateLimited ? 6 * 3600_000 : 10 * 60_000);
      // Keep a good forecast for up to 2 days; only then is it too stale to show.
      if (this.last && now - Date.parse(this.last.fetchedAt) > 2 * 24 * 3600_000) this.last = undefined;
    }
    return this.last;
  }
}

export function createWeather(): CachedWeather {
  const live = process.env.WEATHER_SOURCE === "open-meteo";
  return new CachedWeather(live ? new OpenMeteoWeather(process.env.OPEN_METEO_API_KEY) : new SimulatedWeather());
}
