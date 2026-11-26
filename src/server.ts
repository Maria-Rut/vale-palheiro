import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { Scheduler, DEFAULT_CONFIG, type SchedulerConfig } from "./scheduler.ts";
import { channelStatus, getSentLog } from "./channels.ts";
import { MockBookingSource, InMemoryEventSource } from "./sources.ts";
import { preferenceSeeds } from "./mockData.ts";
import { GROUP_LABEL, getPropertyInfo, propList, updatePropertyInfo, sampleFieldCount } from "./property.ts";
import { placeLabel } from "./generator.ts";
import type { Language, MessageKind, Reservation, ResortEvent } from "./types.ts";
import { RESORT_TZ, zonedTime } from "./timezone.ts";
import {
  defaultPreferences,
  findByToken,
  getPreferences,
  parsePreferences,
  preferencesOpen,
  preferencesUrl,
  hasMinibar,
  setPreferences,
  loadPreferences,
} from "./preferences.ts";
import { prop } from "./property.ts";
import { supabaseEnabled, supabaseStatus } from "./supabase.ts";
import { addActivity, getActivities, setActivityEnabled, type Category, type Condition } from "./activities.ts";
import { TEXT_TEMPLATES, toPlainText, DEFAULT_TEMPLATES, FIELDS, getTemplate, isEdited, isTemplateKey, resetTemplate, setTemplate, toEmailHtml, type TemplateKey } from "./templates.ts";
import { exampleGuests } from "./examples.ts";
import { conditionsFor, recommend } from "./recommender.ts";

/**
 * HTTP layer for the Vale Palheiro guest messaging app. Serves the staff dashboard and a small JSON API.
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

// Demo: one guest has already filled in their "prepare your stay" page.
for (const [id, prefs] of Object.entries(preferenceSeeds)) setPreferences(id, prefs);

/**
 * Startup work — runs AFTER the HTTP server is listening (see bottom of file),
 * so the port opens immediately and the host's health check passes right away.
 * A slow or unreachable Supabase can delay this, but can never delay boot.
 */
async function initData(): Promise<void> {
  if (supabaseEnabled) {
    try {
      const [prefCount, consentCount] = await Promise.all([loadPreferences(), scheduler.loadConsent()]);
      console.log(`[supabase] loaded ${prefCount} saved preferences, ${consentCount} consent records`);
    } catch (e) {
      console.error(`[supabase] startup load failed (continuing in-memory): ${e instanceof Error ? e.message : e}`);
    }
  }
  // Build the initial plan, then send anything already due.
  await scheduler.plan();
  await scheduler.runDue();

  // Ongoing: re-read bookings + events every 15 minutes, send what's due every minute.
  setInterval(() => void scheduler.plan(), 15 * 60_000);
  setInterval(() => void scheduler.runDue(), 60_000);
}

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
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
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
      // A request for a real asset (has a file extension, e.g. .pdf .png .css)
      // that doesn't exist is a genuine 404 — never fall back to index.html,
      // or a missing PDF would silently open the dashboard page instead.
      const ext = path.extname(filePath).toLowerCase();
      if (ext && ext !== ".html") {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(`Not found: ${rel} is not uploaded yet.`);
        return;
      }
      // Otherwise it's an app route — serve the SPA shell.
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
      html: m.channel === "email" ? toEmailHtml(m.body) : undefined,
      // WhatsApp isn't connected yet: staff send it by hand from a pre-filled chat.
      whatsappLink: m.channel === "whatsapp" && r?.guest.phone
        ? `https://wa.me/${r.guest.phone.replace(/\D/g, "")}?text=${encodeURIComponent(toPlainText(m.body))}`
        : undefined,
      englishHtml: m.channel === "email" && m.english ? toEmailHtml(m.english.body) : undefined,
    };
  });
}

const CONFIG_NUMBERS: (keyof SchedulerConfig)[] = [
  "preArrivalDaysBefore", "arrivalHoursBefore", "inStayHoursAfterCheckIn",
  "postStayHoursAfterCheckOut", "sendWindowStart", "sendWindowEnd",
  "inviteMinDaysBetween", "inviteQuietDaysAroundStay", "inviteMaxPerYear",
];
const CHANNEL_CHOICES = ["email", "whatsapp", "both", "off"];
const KINDS = ["pre_arrival", "arrival_day", "in_stay", "morning", "post_stay", "event_invite"] as const;
const APPROVAL_POLICIES = ["personal", "personal_and_suggestions", "all", "none"];

/** The journey, in order, as the Emails tab shows it. */
const STEPS: { key: TemplateKey; title: string; when: string }[] = [
  { key: "pre_arrival", title: "3 days before arrival", when: "10:00 in the guest's own time zone: directions, The Barn, experiences, and the link to personalise their stay" },
  { key: "pre_arrival_text", title: "3 days before — WhatsApp", when: "The short version: asks for their arrival time, with the personalise button" },
  { key: "arrival_day", title: "3 hours before arrival", when: "Timed from the arrival time the guest gave us: where we meet them, their villa, contacts" },
  { key: "arrival_text", title: "Arrival-day WhatsApp", when: "The short version, for guests who agreed to WhatsApp (channel set in Settings)" },
  { key: "in_stay", title: "Welcome, after check-in", when: "2 hours after they arrive: Wi-Fi, reception, restaurant, bar, wellness, check-out, and ideas from the weather forecast" },
  { key: "morning", title: "Good morning (WhatsApp)", when: "Every morning of the stay at 08:30: today's weather and suggestion, with Wellness and Experiences buttons" },
  { key: "post_stay", title: "Thank you, after check-out", when: "24 hours after they leave (timing in Settings), with the TripAdvisor button" },
  { key: "post_stay_text", title: "Thank you — WhatsApp", when: "The short version, with the TripAdvisor button" },
  { key: "event_invite", title: "Event invitation", when: "To past guests who agreed to hear from us, before each event" },
];
const LANGS: Language[] = ["en", "pt", "fr"];

/** Staff wording for a turndown card, keyed "reservationId:date". */
const turndownEdits = new Map<string, string>();

/** Kept for the whole run so answers on an example guest's page stick. */
const exampleReservations = exampleGuests().map((e) => e.reservation);

async function templatePreviews(key: TemplateKey, lang: Language | "own") {
  const KIND: Partial<Record<TemplateKey, MessageKind>> = { arrival_text: "arrival_day", pre_arrival_text: "pre_arrival", post_stay_text: "post_stay" };
  const kind: MessageKind = KIND[key] ?? (key as MessageKind);
  const channel = TEXT_TEMPLATES.includes(key) ? "whatsapp" : "email";
  return Promise.all(exampleGuests().map(async (e, i) => {
    // Same booking (so the guest-page link and any answers stay put), dates kept fresh.
    Object.assign(exampleReservations[i], { checkIn: e.reservation.checkIn, checkOut: e.reservation.checkOut });
    e.reservation = exampleReservations[i];
    const l = lang === "own" ? e.reservation.guest.language : lang;
    const out = await scheduler.preview(e.reservation, kind, l, { returning: e.returning, channel });
    return {
      name: `${e.reservation.guest.firstName} ${e.reservation.guest.lastName}`,
      about: e.about, language: l, email: e.reservation.guest.email,
      subject: out.subject, text: out.body,
      html: channel === "email" ? toEmailHtml(out.body) : undefined,
    };
  }));
}

function str(v: unknown): string { return typeof v === "string" ? v.trim() : ""; }

/** A "2026-12-05T20:30" form value means 20:30 on the resort's clock. */
function resortTime(v: string): Date {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return new Date(v);
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  return zonedTime(y, mo, d, h, mi, RESORT_TZ);
}

/** What a guest's own page may see about their booking — nothing more. */
function guestView(r: Reservation) {
  const p = prop();
  const prefs = getPreferences(r.id);
  return {
    firstName: r.guest.firstName,
    language: r.guest.language,
    accommodation: placeLabel(r),
    checkIn: r.checkIn,
    checkOut: r.checkOut,
    partySize: r.adults + r.children,
    open: preferencesOpen(r),
    answered: !!prefs,
    preferences: prefs ?? { ...defaultPreferences(r), submittedAt: null },
    wifi: { network: p.wifiNetwork, password: p.wifiPassword },
    phone: p.receptionPhone,
    meetingPoint: p.meetingPoint,
    checkInTime: p.checkInTime,
    earlyCheckIn: p.earlyCheckIn,
    receptionHours: p.receptionHours,
    receptionClose: p.receptionClose,
    lateArrivalFee: p.lateArrivalFee,
    brochureLink: p.brochureLink,
    minibar: hasMinibar(placeLabel(r)) ? propList("minibarStandard") : null,
    minibarExtras: propList("minibarExtras"),
  };
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
    const stayMatch = pathname.match(/^\/api\/stay\/([A-Za-z0-9_-]{16,64})$/);
    if (stayMatch && (method === "GET" || method === "POST")) {
      // Example guests from the Emails tab get a working page too, so the
      // button in the template preview can be tried out.
      const r = findByToken(scheduler.getReservations(), stayMatch[1]) ?? findByToken(exampleReservations, stayMatch[1]);
      if (!r) return sendJson(res, 404, { error: "not_found" });
      if (method === "GET") return sendJson(res, 200, guestView(r));
      if (!preferencesOpen(r)) return sendJson(res, 409, { error: "closed" });
      const parsed = parsePreferences(r, await readBody(req));
      if (!parsed.ok) return sendJson(res, 400, { error: parsed.error });
      setPreferences(r.id, parsed.preferences);
      await scheduler.plan(); // refresh tasks + upcoming messages with their answers
      return sendJson(res, 200, guestView(r));
    }

    // Everything below requires auth
    if (!isAuthed(req)) return sendJson(res, 401, { error: "Not authenticated" });

    if (pathname === "/api/preferences" && method === "GET") {
      const now = Date.now();
      const msgs = scheduler.getMessages();
      const rows = scheduler.getReservations()
        .filter((r) => !r.cancelled && Date.parse(r.checkOut) + 7 * 24 * 3600_000 > now)
        .sort((a, b) => Date.parse(a.checkIn) - Date.parse(b.checkIn))
        .map((r) => {
          const invite = msgs.find((m) => m.reservationId === r.id && m.kind === "pre_arrival");
          return {
            id: r.id, reference: r.reference, guest: r.guest, place: placeLabel(r),
            checkIn: r.checkIn, checkOut: r.checkOut, partySize: r.adults + r.children,
            preferences: getPreferences(r.id) ?? null,
            url: preferencesUrl(r), open: preferencesOpen(r),
            invite: invite ? { status: invite.status, sendAt: invite.sendAt, sentAt: invite.sentAt } : null,
          };
        });
      return sendJson(res, 200, rows);
    }

    if (pathname === "/api/templates" && method === "GET") {
      return sendJson(res, 200, STEPS.map((s) => ({
        ...s,
        fields: FIELDS[s.key],
        templates: Object.fromEntries(LANGS.map((l) => [l, { ...getTemplate(s.key, l), edited: isEdited(s.key, l) }])),
      })));
    }
    const tplMatch = pathname.match(/^\/api\/templates\/([a-z_]+)(?:\/(en|pt|fr))?(\/preview)?$/);
    if (tplMatch && isTemplateKey(tplMatch[1])) {
      const key = tplMatch[1];
      if (tplMatch[3] && method === "GET") {
        const lang = (url.searchParams.get("lang") ?? "en") as Language | "own";
        return sendJson(res, 200, await templatePreviews(key, LANGS.includes(lang as Language) ? lang : lang === "own" ? "own" : "en"));
      }
      const lang = tplMatch[2] as Language | undefined;
      if (lang && method === "POST") {
        const body = await readBody(req);
        if (body.reset === true) resetTemplate(key, lang);
        else {
          const d = DEFAULT_TEMPLATES[key][lang];
          setTemplate(key, lang, {
            subject: typeof body.subject === "string" ? body.subject : d.subject,
            body: typeof body.body === "string" && body.body.trim() ? body.body : d.body,
          });
        }
        await scheduler.plan(); // every unsent, unedited message picks up the new wording
        return sendJson(res, 200, { ...getTemplate(key, lang), edited: isEdited(key, lang) });
      }
    }

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
      if (body.channels && typeof body.channels === "object") {
        const ch = { ...scheduler.getConfig().channels };
        const given = body.channels as Record<string, unknown>;
        for (const k of KINDS) if (typeof given[k] === "string" && CHANNEL_CHOICES.includes(given[k] as string)) ch[k] = given[k] as typeof ch[typeof k];
        patch.channels = ch;
      }
      if (typeof body.approvalPolicy === "string" && APPROVAL_POLICIES.includes(body.approvalPolicy)) patch.approvalPolicy = body.approvalPolicy;
      scheduler.setConfig(patch as Partial<SchedulerConfig>);
      await scheduler.plan();
      return sendJson(res, 200, scheduler.getConfig());
    }

    const msgAction = pathname.match(/^\/api\/messages\/([^/]+)\/(edit|cancel|approve|sent)$/);
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
      else if (action === "sent") ok = scheduler.markSent(id);
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

    // Guest replied to the good-morning events opt-in (EVENTS = yes, STOP = no).
    // Records consent so the event-invite scheduler includes/excludes them.
    const consentMatch = pathname.match(/^\/api\/reservations\/([^/]+)\/events-optin$/);
    if (consentMatch && method === "POST") {
      const b = await readBody(req);
      const consent = b.consent !== false; // default true (opting in)
      const result = scheduler.setMarketingConsent(decodeURIComponent(consentMatch[1]), consent);
      if (result === undefined) return sendJson(res, 404, { ok: false, error: "Reservation not found" });
      return sendJson(res, 200, { ok: true, marketingConsent: result });
    }

    if (pathname === "/api/events" && method === "GET") {
      return sendJson(res, 200, { events: scheduler.getEvents(), suppressions: scheduler.getSuppressions() });
    }
    const evMatch = pathname.match(/^\/api\/events(?:\/([^/]+))?$/);
    if (evMatch && method === "POST") {
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
        inviteLeadDays: typeof b.inviteLeadDays === "number" && b.inviteLeadDays >= 0 ? b.inviteLeadDays : 7,
      };
      const src = scheduler.getEventSource();
      const saved = evMatch[1] ? await src.updateEvent(evMatch[1], event) : await src.addEvent(event);
      if (!saved) return sendJson(res, 404, { ok: false, error: "Event not found" });
      await scheduler.plan();
      return sendJson(res, 200, { ok: true, event: saved });
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
    if (pathname === "/api/property/groups" && method === "GET") {
      return sendJson(res, 200, GROUP_LABEL);
    }
    if (pathname === "/api/integrations" && method === "GET") {
      const ch = channelStatus();
      const w = scheduler.getWeatherStatus();
      return sendJson(res, 200, [
        { name: "Bookings — GuestCentric", status: "planned", detail: "Demo bookings for now. Waiting on Carmine: API, webhook or export? Which fields?" },
        { name: "Email", status: "simulated", detail: "Messages are recorded in the sent log, not delivered. Needs an email provider (SMTP / SendGrid / Postmark) and the sending address." },
        { name: "WhatsApp", status: ch.whatsapp === "configured" ? "configured" : "manual", detail: ch.whatsapp === "configured" ? "Credentials found; Meta-approved templates still to map." : "WhatsApp Business API planned. Until then, due WhatsApps wait in the Outbox under \"To send by hand\"." },
        { name: "Weather & sea forecast", status: w.source === "open-meteo" && !w.error ? "live" : "simulated", detail: w.source === "open-meteo" && !w.error ? "Live from Open-Meteo (land + marine), free, no key needed." : `Simulated forecast for the demo${w.error ? ` (${w.error})` : ""}. Set WEATHER_SOURCE=open-meteo for the live one.` },
        { name: "Database — Supabase", status: supabaseStatus().configured ? "live" : "planned", detail: supabaseStatus().configured ? `Guest preferences and events consent persist to Supabase (${supabaseStatus().url}).` : "In-memory for now (resets on restart). Set SUPABASE_URL and SUPABASE_KEY to persist preferences and consent." },
        { name: "Message writing", status: "templates", detail: "Staff-edited templates. An AI model (hosted, or local on a Mac Mini) can be added for extra variety." },
      ]);
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

    if (pathname === "/api/activities" && method === "POST") {
      const b = await readBody(req);
      const name = str(b.name), pitch = str(b.pitch);
      if (!name) return sendJson(res, 400, { ok: false, error: "A name is required" });
      const CATS: Category[] = ["land", "sea", "wellbeing", "table", "craft"];
      const CONDS: Condition[] = ["sunny", "cloudy", "showers", "rainy", "windy", "calm", "big_sea", "surf_sea", "flat_sea", "warm"];
      const conds = (v: unknown) => (Array.isArray(v) ? v.filter((c): c is Condition => CONDS.includes(c as Condition)) : []);
      const from = Number(b.priceFrom);
      const a = addActivity({
        name, pitch: pitch || name,
        category: CATS.includes(b.category as Category) ? (b.category as Category) : "land",
        goodIn: conds(b.goodIn), notIn: conds(b.notIn),
        price: b.priceFrom === "" || b.priceFrom === undefined || !Number.isFinite(from) ? { onRequest: true } : from === 0 ? { free: true } : { from },
        indoor: b.indoor === true, family: b.family === true,
      });
      await scheduler.plan();
      return sendJson(res, 200, { ok: true, activity: a });
    }

    // Day-by-day suggestions for guests staying in the next days — the
    // back-office view of the recommendation agent, and the turndown cards.
    if (pathname === "/api/turndown" && method === "GET") {
      const now = Date.now();
      const f = scheduler.getForecast();
      const rows: unknown[] = [];
      for (const r of scheduler.getReservations()) {
        if (r.cancelled || Date.parse(r.checkOut) <= now || Date.parse(r.checkIn) > now + 7 * 86400_000) continue;
        const from = new Date(Math.max(now, Date.parse(r.checkIn)));
        const plan = recommend(r, from, f);
        for (const d of plan?.days ?? []) {
          const lang = r.guest.language;
          const key = `${r.id}:${d.date}`;
          rows.push({
            key, date: d.date, guest: `${r.guest.firstName} ${r.guest.lastName}`, firstName: r.guest.firstName,
            place: placeLabel(r), language: lang, activity: d.activity.name.en, reason: d.reason,
            card: turndownEdits.get(key) ?? `${d.activity.name[lang]} — ${d.activity.pitch[lang]}`,
            edited: turndownEdits.has(key),
            conditions: d.conditions,
          });
        }
      }
      return sendJson(res, 200, rows);
    }
    const tdEdit = pathname.match(/^\/api\/turndown\/([^/]+)$/);
    if (tdEdit && method === "POST") {
      const b = await readBody(req);
      const key = decodeURIComponent(tdEdit[1]);
      if (b.reset === true || !str(b.card)) turndownEdits.delete(key);
      else turndownEdits.set(key, str(b.card).slice(0, 400));
      return sendJson(res, 200, { ok: true });
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
  console.log(`Vale Palheiro guest messaging running on ${HOST}:${PORT} (locally: http://localhost:${PORT})`);
  console.log(`Staff login — user: ${STAFF_USER}  pass: ${STAFF_PASS}`);
  // Load data and start the schedulers once we're listening — never blocks boot.
  void initData();
});
