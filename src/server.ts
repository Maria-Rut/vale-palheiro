import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { Scheduler, DEFAULT_CONFIG, type SchedulerConfig } from "./scheduler.ts";
import { getSentLog } from "./channels.ts";
import { MockBookingSource, InMemoryEventSource } from "./sources.ts";
import { getPropertyInfo, updatePropertyInfo, sampleFieldCount } from "./property.ts";
import { placeLabel } from "./generator.ts";
import type { Language, ResortEvent } from "./types.ts";
import { RESORT_TZ, zonedTime } from "./timezone.ts";
import { getActivities, setActivityEnabled } from "./activities.ts";
import { conditionsFor } from "./recommender.ts";

/**
 * HTTP layer for Terra. Serves the staff dashboard and a small JSON API.
 *
 * Built on Node's standard library only — no Express, no npm install — so the
 * prototype runs anywhere Node 22+ is present. Each real integration (LLM,
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

const scheduler = new Scheduler(new MockBookingSource(), new InMemoryEventSource(), { ...DEFAULT_CONFIG });

// Build the initial plan, then send anything already due so the demo opens
// with a realistic mix of sent / scheduled / held / skipped.
await scheduler.plan();
await scheduler.runDue();

// In real use Terra runs on its own: re-read bookings + events every 15 minutes
// (new reservations, changed dates, new events) and send what's due every minute.
setInterval(() => void scheduler.plan(), 15 * 60_000);
setInterval(() => void scheduler.runDue(), 60_000);

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
  const evById = Object.fromEntries(scheduler.getEvents().map((e) => [e.id, e]));
  return scheduler.getMessages().map((m) => {
    const r = byId[m.reservationId];
    return {
      ...m,
      guest: r?.guest,
      place: r ? placeLabel(r) : undefined,
      reference: r?.reference,
      checkIn: r?.checkIn,
      checkOut: r?.checkOut,
      occasion: r?.occasion,
      eventTitle: m.eventId ? evById[m.eventId]?.title.en : undefined,
    };
  });
}

const CONFIG_NUMBERS: (keyof SchedulerConfig)[] = [
  "preArrivalDaysBefore", "arrivalHoursBefore", "inStayHoursAfterCheckIn",
  "postStayHoursAfterCheckOut", "sendWindowStart", "sendWindowEnd",
  "inviteMinDaysBetween", "inviteQuietDaysAroundStay", "inviteMaxPerYear",
];
const CONFIG_BOOLS: (keyof SchedulerConfig)[] = ["arrivalTextReminder", "holdPersonalMoments"];

function str(v: unknown): string { return typeof v === "string" ? v.trim() : ""; }

/** A "2026-12-05T20:30" form value means 20:30 on the resort's clock. */
function resortTime(v: string): Date {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return new Date(v);
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  return zonedTime(y, mo, d, h, mi, RESORT_TZ);
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
    if (pathname === "/api/overview" && method === "GET") {
      const msgs = scheduler.getMessages();
      const count = (s: string) => msgs.filter((m) => m.status === s).length;
      return sendJson(res, 200, {
        scheduled: count("scheduled"), held: count("held"), sent: count("sent"),
        skipped: count("skipped"), tasksOpen: scheduler.getTasks().filter((t) => !t.done).length,
        sampleFields: sampleFieldCount(),
      });
    }

    if (pathname === "/api/config" && method === "GET") {
      return sendJson(res, 200, scheduler.getConfig());
    }
    if (pathname === "/api/config" && method === "POST") {
      const body = await readBody(req);
      const patch: Record<string, unknown> = {};
      for (const k of CONFIG_NUMBERS) {
        const v = body[k];
        if (typeof v === "number" && Number.isFinite(v) && v >= 0) patch[k] = v;
      }
      for (const k of CONFIG_BOOLS) if (typeof body[k] === "boolean") patch[k] = body[k];
      scheduler.setConfig(patch as Partial<SchedulerConfig>);
      await scheduler.plan();
      return sendJson(res, 200, scheduler.getConfig());
    }

    const msgAction = pathname.match(/^\/api\/messages\/([^/]+)\/(edit|cancel|approve)$/);
    if (msgAction && method === "POST") {
      const [, id, action] = msgAction;
      let ok = false;
      if (action === "edit") {
        const { subject, body } = await readBody(req);
        ok = scheduler.editMessage(id, {
          subject: typeof subject === "string" ? subject : undefined,
          body: typeof body === "string" ? body : undefined,
        });
      } else if (action === "cancel") ok = scheduler.cancelMessage(id);
      else ok = scheduler.approveMessage(id);
      return sendJson(res, ok ? 200 : 400, { ok });
    }

    if (pathname === "/api/tasks" && method === "GET") {
      return sendJson(res, 200, scheduler.getTasks());
    }
    const taskToggle = pathname.match(/^\/api\/tasks\/([^/]+)\/toggle$/);
    if (taskToggle && method === "POST") {
      const ok = scheduler.toggleTask(decodeURIComponent(taskToggle[1]));
      return sendJson(res, ok ? 200 : 400, { ok });
    }

    if (pathname === "/api/events" && method === "GET") {
      return sendJson(res, 200, { events: scheduler.getEvents(), suppressions: scheduler.getSuppressions() });
    }
    if (pathname === "/api/events" && method === "POST") {
      const b = await readBody(req);
      const start = str(b.start);
      const titleEn = str(b.titleEn);
      if (!titleEn || !start || Number.isNaN(Date.parse(start))) {
        return sendJson(res, 400, { ok: false, error: "Title and a valid date are required" });
      }
      const text = (prefix: string): Record<Language, string> => ({
        en: str(b[`${prefix}En`]),
        pt: str(b[`${prefix}Pt`]) || str(b[`${prefix}En`]),
        fr: str(b[`${prefix}Fr`]) || str(b[`${prefix}En`]),
      });
      const event: Omit<ResortEvent, "id"> = {
        title: text("title"),
        description: text("desc"),
        start: resortTime(start).toISOString(),
        place: str(b.place) || "Vale Palheiro",
        audience: b.audience === "in_house" ? "in_house" : "everyone",
        inviteLeadDays: typeof b.inviteLeadDays === "number" ? b.inviteLeadDays : 14,
      };
      const created = await scheduler.getEventSource().addEvent(event);
      await scheduler.plan();
      return sendJson(res, 200, { ok: true, event: created });
    }
    const evDelete = pathname.match(/^\/api\/events\/([^/]+)\/delete$/);
    if (evDelete && method === "POST") {
      const ok = await scheduler.getEventSource().removeEvent(evDelete[1]);
      await scheduler.plan();
      return sendJson(res, ok ? 200 : 400, { ok });
    }

    if (pathname === "/api/property" && method === "GET") {
      return sendJson(res, 200, getPropertyInfo());
    }
    if (pathname === "/api/property" && method === "POST") {
      const b = await readBody(req);
      const patch: Record<string, string> = {};
      for (const [k, v] of Object.entries(b)) if (typeof v === "string") patch[k] = v;
      updatePropertyInfo(patch);
      await scheduler.plan(); // re-render unedited messages with the new details
      return sendJson(res, 200, getPropertyInfo());
    }

    if (pathname === "/api/weather" && method === "GET") {
      const f = scheduler.getForecast();
      return sendJson(res, 200, {
        ...scheduler.getWeatherStatus(),
        fetchedAt: f?.fetchedAt,
        days: (f?.days ?? []).slice(0, 7).map((d) => ({ ...d, conditions: conditionsFor(d) })),
      });
    }
    if (pathname === "/api/activities" && method === "GET") {
      return sendJson(res, 200, getActivities());
    }
    const actToggle = pathname.match(/^\/api\/activities\/([^/]+)\/toggle$/);
    if (actToggle && method === "POST") {
      const a = getActivities().find((x) => x.id === actToggle[1]);
      const ok = !!a && setActivityEnabled(a.id, !a.enabled);
      await scheduler.plan(); // re-pick suggestions in unsent welcome emails
      return sendJson(res, ok ? 200 : 400, { ok });
    }

    if (pathname === "/api/simulate" && method === "POST") {
      const { atHoursFromNow } = await readBody(req);
      const now =
        typeof atHoursFromNow === "number"
          ? new Date(Date.now() + atHoursFromNow * 3600_000)
          : new Date();
      const sent = await scheduler.runUntil(now);
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
