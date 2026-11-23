import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { reservations } from "./mockData.ts";
import { Scheduler, DEFAULT_CONFIG } from "./scheduler.ts";
import { getSentLog } from "./channels.ts";
import {
  defaultPreferences,
  parsePreferences,
  preferencesOpen,
  preferencesUrl,
} from "./preferences.ts";
import type { Reservation } from "./types.ts";
import { BRAND } from "./brand.ts";

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
    };
  });
}

/** What the guest's own page may see about their booking — nothing more. */
function guestView(r: Reservation) {
  return {
    firstName: r.guest.firstName,
    language: r.guest.language,
    accommodation: r.accommodation,
    checkIn: r.checkIn,
    checkOut: r.checkOut,
    partySize: r.partySize,
    motive: r.motive,
    open: preferencesOpen(r),
    wifi: { network: BRAND.practical.wifiNetwork, password: BRAND.practical.wifiPassword },
    phone: BRAND.practical.phone,
    answered: !!r.preferences,
    preferences: r.preferences ?? { ...defaultPreferences(r), submittedAt: null },
  };
}

function byToken(token: string): Reservation | undefined {
  return scheduler.getReservations().find((r) => r.preferencesToken === token);
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

    // Public: the guest's personal "prepare your stay" page. The unguessable
    // token in the link is the only key, so guests never need to log in.
    const stayMatch = pathname.match(/^\/api\/stay\/([A-Za-z0-9_-]{8,64})$/);
    if (stayMatch) {
      const r = byToken(stayMatch[1]);
      if (!r) return sendJson(res, 404, { error: "not_found" });
      if (method === "GET") return sendJson(res, 200, guestView(r));
      if (method === "POST") {
        if (!preferencesOpen(r)) return sendJson(res, 409, { error: "closed" });
        const parsed = parsePreferences(r, await readBody(req));
        if (!parsed.ok) return sendJson(res, 400, { error: parsed.error });
        r.preferences = parsed.preferences;
        await scheduler.preferencesUpdated(r.id);
        return sendJson(res, 200, guestView(r));
      }
    }

    // Everything below requires auth
    if (!isAuthed(req)) return sendJson(res, 401, { error: "Not authenticated" });

    if (pathname === "/api/reservations" && method === "GET") {
      return sendJson(
        res,
        200,
        scheduler.getReservations().map((r) => ({
          ...r,
          preferencesUrl: preferencesUrl(r),
          preferencesOpen: preferencesOpen(r),
        })),
      );
    }
    if (pathname === "/api/messages" && method === "GET") {
      return sendJson(res, 200, withReservationContext());
    }
    if (pathname === "/api/config" && method === "GET") {
      return sendJson(res, 200, scheduler.getConfig());
    }
    if (pathname === "/api/config" && method === "POST") {
      const { preferencesHoursBefore, preStayHoursBefore, postStayHoursAfter, channelStrategy } = await readBody(req);
      const patch: Record<string, unknown> = {};
      if (typeof preferencesHoursBefore === "number") patch.preferencesHoursBefore = preferencesHoursBefore;
      if (typeof preStayHoursBefore === "number") patch.preStayHoursBefore = preStayHoursBefore;
      if (typeof postStayHoursAfter === "number") patch.postStayHoursAfter = postStayHoursAfter;
      if (channelStrategy === "preferred" || channelStrategy === "all") patch.channelStrategy = channelStrategy;
      scheduler.setConfig(patch);
      await scheduler.plan();
      return sendJson(res, 200, scheduler.getConfig());
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

  // Guest preferences page: /stay/<token>
  if (/^\/stay\/[A-Za-z0-9_-]+\/?$/.test(pathname)) {
    return serveStatic(res, "/stay.html");
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
