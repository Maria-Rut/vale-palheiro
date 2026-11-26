/**
 * Supabase persistence (optional).
 *
 * The prototype keeps everything in memory, which resets on restart. When a
 * Supabase project is configured, guest preferences and events consent are
 * also persisted there, so they survive restarts and redeploys.
 *
 * We talk to Supabase over its REST API (PostgREST) with the built-in `fetch`,
 * so there are no npm dependencies to install — same approach as the weather
 * integration. Enabled only when SUPABASE_URL and SUPABASE_KEY are set; without
 * them the app behaves exactly as before (in-memory only).
 *
 * Expected tables (SQL is in db/supabase.sql):
 *   guest_preferences(reservation_id text primary key, data jsonb, updated_at timestamptz)
 *   guest_consent(reservation_id text primary key, marketing_consent boolean, updated_at timestamptz)
 */

const URL_BASE = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_KEY ?? process.env.SUPABASE_SERVICE_KEY ?? "";

/** True when Supabase is configured; otherwise the app stays in-memory only. */
export const supabaseEnabled = Boolean(URL_BASE && KEY);

/** Normalise to the PostgREST base, whether the user gave the project URL or the full /rest/v1 path. */
function restBase(): string {
  if (/\/rest\/v1$/.test(URL_BASE)) return URL_BASE;
  return `${URL_BASE}/rest/v1`;
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function req(path: string, init: RequestInit): Promise<Response> {
  const res = await fetch(`${restBase()}${path}`, {
    ...init,
    headers: { ...headers(), ...(init.headers as Record<string, string> | undefined) },
    signal: AbortSignal.timeout(10_000),
  });
  return res;
}

/** Read every row of a table. Returns [] on any error (never throws to callers). */
export async function selectAll<T>(table: string, columns = "*"): Promise<T[]> {
  try {
    const res = await req(`/${table}?select=${encodeURIComponent(columns)}`, { method: "GET" });
    if (!res.ok) {
      console.error(`[supabase] select ${table} HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
      return [];
    }
    return (await res.json()) as T[];
  } catch (e) {
    console.error(`[supabase] select ${table} failed: ${e instanceof Error ? e.message : e}`);
    return [];
  }
}

/**
 * Insert or update a row by primary key (upsert). Fire-and-forget friendly:
 * resolves to true/false and never throws, so a Supabase blip can't break a
 * guest save (the in-memory copy still holds).
 */
export async function upsert(table: string, row: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await req(`/${table}`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(row),
    });
    if (!res.ok) {
      console.error(`[supabase] upsert ${table} HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[supabase] upsert ${table} failed: ${e instanceof Error ? e.message : e}`);
    return false;
  }
}

/** One-line status for the dashboard integrations panel. */
export function supabaseStatus(): { configured: boolean; url: string } {
  return { configured: supabaseEnabled, url: URL_BASE };
}
