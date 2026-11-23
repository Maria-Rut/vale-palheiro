import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { reservations } from "./mockData.ts";
import { Scheduler, DEFAULT_CONFIG } from "./scheduler.ts";
import { getSentLog } from "./channels.ts";
import { EXPERIENCES } from "./experiences.ts";
import type { GuestPreferences, Interest, WeatherKind } from "./types.ts";

/**
 * HTTP layer for Terra. Serves the staff dashboard and a small JSON API.
 *
 * Built on Node's standard library only — no Express, no npm install — so the
 * prototype runs anywhere Node 18+ is present. Each real integration (LLM,
 * email/SMS/WhatsApp providers) is a pluggable adapter elsewhere; this file
 * only wires HTTP to the scheduler.
 *
 * Auth is a single shared staff login — deliberately minimal for a pilot. It
 * is a real gate (session cookie), not just a UI flourish, but production would
 * wire it to the resort's own accounts.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "public");

const STAFF_USER = process.env.TERRA_USER ?? "palheiro";
const STAFF_PASS = process.env.TERRA_PASS ?? "costa-vicentina";

const scheduler = new Scheduler(reservations, { ...DEFAULT_CONFIG });

// Give each reservation a (simulated) forecast so the experiences message has
// something to react to. In production this comes from a weather API keyed by
// the resort's location and the stay dates.
const demoWeather = ["sunny", "rainy", "sunny", "windy", "cloudy"] as const;
scheduler.getReservations().forEach((r, i) => {
  scheduler.setWeather(r.id, demoWeather[i % demoWeather.length]);
});

// Build the initial plan, then auto-send anything already due (e.g. the
// imminent arrival and the recent checkout in the mock data) so the demo opens
// with a realistic mix of "sent" and "scheduled".
await scheduler.plan();
await scheduler.runDue();

// --- tiny cookie-based session (no external deps) ---
const sessions = new Set<string>();
function newToken(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k) out[k] = decodeURIComponent(v.join("="));
  }
  return out;
}
function isAuthed(req: IncomingMessage): boolean {
  const token = parseCookies(req.headers.cookie)["terra_session"];
  return !!token && sessions.has(token);
}

// --- helpers ---
function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(body);
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c: Buffer | string) => (data += c));
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data) as Record<string, unknown>);
      } catch {
        resolve({});
      }
    });
  });
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function serveStatic(res: ServerResponse, urlPath: string): void {
  const rel = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.join(PUBLIC_DIR, path.normalize(rel).replace(/^(\.\.[/\\])+/, ""));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (err, content) => {
    if (err) {
      // SPA fallback: serve index.html for unknown paths.
      fs.readFile(path.join(PUBLIC_DIR, "index.html"), (e2, idx) => {
        if (e2) {
          res.writeHead(404);
          res.end("Not found");
        } else {
          res.writeHead(200, { "Content-Type": MIME[".html"] });
          res.end(idx);
        }
      });
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] ?? "application/octet-stream" });
    res.end(content);
  });
}

function withReservationContext() {
  const byId = Object.fromEntries(scheduler.getReservations().map((r) => [r.id, r]));
  return scheduler.getMessages().map((m) => {
    const r = byId[m.reservationId];
    return {
      ...m,
      guest: r?.guest,
      accommodation: r?.accommodation,
      reference: r?.reference,
      motive: r?.motive,
      ratePlan: r?.ratePlan,
      partySize: r?.partySize,
      checkIn: r?.checkIn,
      checkOut: r?.checkOut,
      weather: r ? scheduler.getWeather(r.id) : undefined,
      hasPreferences: !!r?.preferences,
    };
  });
}

// --- router ---
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const { pathname } = url;
  const method = req.method ?? "GET";

  // API routes
  if (pathname.startsWith("/api/")) {
    // Public: login, session check, logout
    if (pathname === "/api/login" && method === "POST") {
      const { username, password } = await readBody(req);
      if (username === STAFF_USER && password === STAFF_PASS) {
        const token = newToken();
        sessions.add(token);
        res.setHeader("Set-Cookie", `terra_session=${token}; HttpOnly; Path=/; SameSite=Lax`);
        return sendJson(res, 200, { ok: true });
      }
      return sendJson(res, 401, { ok: false, error: "Invalid credentials" });
    }
    if (pathname === "/api/logout" && method === "POST") {
      const token = parseCookies(req.headers.cookie)["terra_session"];
      if (token) sessions.delete(token);
      res.setHeader("Set-Cookie", "terra_session=; Path=/; Max-Age=0");
      return sendJson(res, 200, { ok: true });
    }
    if (pathname === "/api/session" && method === "GET") {
      return sendJson(res, 200, { authed: isAuthed(req) });
    }

    // Everything below requires auth
    if (!isAuthed(req)) return sendJson(res, 401, { error: "Not authenticated" });

    if (pathname === "/api/reservations" && method === "GET") {
      return sendJson(res, 200, scheduler.getReservations());
    }
    if (pathname === "/api/messages" && method === "GET") {
      return sendJson(res, 200, withReservationContext());
    }
    if (pathname === "/api/config" && method === "GET") {
      return sendJson(res, 200, scheduler.getConfig());
    }
    if (pathname === "/api/config" && method === "POST") {
      const b = await readBody(req);
      const patch: Record<string, unknown> = {};
      for (const k of [
        "preferencesDaysBefore",
        "preStayHoursBefore",
        "experiencesHoursAfter",
        "postStayHoursAfter",
      ] as const) {
        if (typeof b[k] === "number") patch[k] = b[k];
      }
      if (b.channelStrategy === "preferred" || b.channelStrategy === "all") {
        patch.channelStrategy = b.channelStrategy;
      }
      scheduler.setConfig(patch);
      await scheduler.plan();
      return sendJson(res, 200, scheduler.getConfig());
    }

    // --- CRM: one row per reservation with guest, preferences and weather ---
    if (pathname === "/api/crm" && method === "GET") {
      const rows = scheduler.getReservations().map((r) => ({
        ...r,
        weather: scheduler.getWeather(r.id),
      }));
      return sendJson(res, 200, rows);
    }

    // --- set simulated weather for a reservation (drives experiences email) ---
    const weatherMatch = pathname.match(/^\/api\/reservations\/([^/]+)\/weather$/);
    if (weatherMatch && method === "POST") {
      const { weather } = await readBody(req);
      if (["sunny", "cloudy", "rainy", "windy"].includes(weather as string)) {
        scheduler.setWeather(weatherMatch[1], weather as WeatherKind);
        await scheduler.plan();
        return sendJson(res, 200, { ok: true });
      }
      return sendJson(res, 400, { ok: false, error: "Invalid weather" });
    }

    // --- staff records guest questionnaire answers (CRM) ---
    const prefMatch = pathname.match(/^\/api\/reservations\/([^/]+)\/preferences$/);
    if (prefMatch && method === "POST") {
      const b = await readBody(req);
      const prefs: GuestPreferences = {
        estimatedArrival: typeof b.estimatedArrival === "string" ? b.estimatedArrival : undefined,
        dietary: typeof b.dietary === "string" ? b.dietary : undefined,
        occasion: typeof b.occasion === "string" ? b.occasion : undefined,
        interests: Array.isArray(b.interests) ? (b.interests as Interest[]) : [],
        pace: ["active", "balanced", "restful"].includes(b.pace as string)
          ? (b.pace as GuestPreferences["pace"])
          : undefined,
        arrangements: Array.isArray(b.arrangements) ? (b.arrangements as string[]) : [],
        notes: typeof b.notes === "string" ? b.notes : undefined,
        submittedAt: new Date().toISOString(),
      };
      const ok = scheduler.setPreferences(prefMatch[1], prefs);
      if (ok) await scheduler.plan(); // regenerate experiences copy with new interests
      return sendJson(res, ok ? 200 : 404, { ok });
    }

    if (pathname === "/api/experiences" && method === "GET") {
      return sendJson(res, 200, EXPERIENCES);
    }

    const editMatch = pathname.match(/^\/api\/messages\/([^/]+)\/edit$/);
    if (editMatch && method === "POST") {
      const { subject, body } = await readBody(req);
      const ok = scheduler.editMessage(editMatch[1], {
        subject: typeof subject === "string" ? subject : undefined,
        body: typeof body === "string" ? body : undefined,
      });
      return sendJson(res, ok ? 200 : 400, { ok });
    }

    const cancelMatch = pathname.match(/^\/api\/messages\/([^/]+)\/cancel$/);
    if (cancelMatch && method === "POST") {
      const ok = scheduler.cancelMessage(cancelMatch[1]);
      return sendJson(res, ok ? 200 : 400, { ok });
    }

    if (pathname === "/api/simulate" && method === "POST") {
      const { atHoursFromNow } = await readBody(req);
      const now =
        typeof atHoursFromNow === "number"
          ? new Date(Date.now() + atHoursFromNow * 3600_000)
          : new Date();
      const sent = await scheduler.runDue(now);
      return sendJson(res, 200, { simulatedAt: now.toISOString(), sentCount: sent.length, sent });
    }

    if (pathname === "/api/sent-log" && method === "GET") {
      return sendJson(res, 200, getSentLog());
    }

    return sendJson(res, 404, { error: "Unknown endpoint" });
  }

  // Static files + SPA fallback
  serveStatic(res, pathname);
});

const PORT = Number(process.env.PORT ?? 3000);
// Bind to 0.0.0.0 so cloud hosts (Render, Railway, Fly, etc.) can route to it.
// Locally this is still reachable at http://localhost:PORT.
const HOST = process.env.HOST ?? "0.0.0.0";
server.listen(PORT, HOST, () => {
  console.log(`Terra running on ${HOST}:${PORT} (locally: http://localhost:${PORT})`);
  console.log(`Staff login — user: ${STAFF_USER}  pass: ${STAFF_PASS}`);
});
