import type {
  Channel,
  Guest,
  Language,
  MessageKind,
  Reservation,
  ResortEvent,
  ScheduledMessage,
  StaffTask,
} from "./types.ts";
import { createGenerator, placeLabel, type Generator } from "./generator.ts";
import { senderFor } from "./channels.ts";
import type { BookingSource, EventSource } from "./sources.ts";
import {
  RESORT_TZ,
  atLocalTime,
  fitToWindow,
  localLabel,
  zonedParts,
  type Window,
} from "./timezone.ts";
import { OCCASION } from "./brand.ts";
import { preferenceTasks, purgeAfterStay } from "./preferences.ts";
import { createWeather, type CachedWeather, type Forecast } from "./weather.ts";
import { recommend } from "./recommender.ts";

/**
 * The scheduler is the scheduler is the brain. For every reservation and every event it:
 *   1. decides *which* messages a guest should get (and which they shouldn't),
 *   2. decides *when*, in the guest's own time zone, avoiding awkward hours,
 *   3. renders the copy up front so staff can preview, edit or hold it,
 *   4. sends what's due — and skips anything whose moment has passed rather
 *      than sending something stale,
 *   5. raises the small manual tasks that keep the welcome human (a
 *      welcome-back gift, a handwritten note for an anniversary, a late arrival).
 *
 * Anti-spam rules for event invites (all configurable):
 *   - only guests who opted in, and who have actually stayed with us,
 *   - never to someone who'll be staying during the event (they hear about it
 *     in their stay messages instead),
 *   - at most one invite every `inviteMinDaysBetween` days per guest,
 *   - no invite within `inviteQuietDaysAroundStay` days of a stay message,
 *   - at most `inviteMaxPerYear` per guest per year.
 */

/**
 * Which messages wait for a person before they go:
 *   personal                 — birthday / anniversary messages (default)
 *   personal_and_suggestions — also welcome emails with weather-based picks
 *   all                      — every message
 *   none                     — nothing; everything sends on time
 */
export type ApprovalPolicy = "personal" | "personal_and_suggestions" | "all" | "none";

export interface SchedulerConfig {
  preArrivalDaysBefore: number;
  arrivalHoursBefore: number;
  inStayHoursAfterCheckIn: number;
  postStayHoursAfterCheckOut: number;
  /** Guest-local hours in which non-urgent messages may arrive. */
  sendWindowStart: number;
  sendWindowEnd: number;
  /** Also send a short WhatsApp/SMS on arrival day if the guest opted in. */
  arrivalTextReminder: boolean;
  approvalPolicy: ApprovalPolicy;
  inviteMinDaysBetween: number;
  inviteQuietDaysAroundStay: number;
  inviteMaxPerYear: number;
}

export const DEFAULT_CONFIG: SchedulerConfig = {
  preArrivalDaysBefore: 3,
  arrivalHoursBefore: 3,
  inStayHoursAfterCheckIn: 2,
  postStayHoursAfterCheckOut: 24,
  sendWindowStart: 9,
  sendWindowEnd: 20,
  arrivalTextReminder: true,
  approvalPolicy: "personal",
  inviteMinDaysBetween: 30,
  inviteQuietDaysAroundStay: 7,
  inviteMaxPerYear: 6,
};

/** Why a past guest is not getting an invite — shown to staff for transparency. */
export interface Suppression {
  guestName: string;
  eventTitle: string;
  reason: string;
}

function staffOccasion(r: Reservation): string {
  return r.occasion ? OCCASION[r.occasion].en.replace(/^your /, "their ") : "";
}

const HOUR = 3600_000;
const DAY = 24 * HOUR;

let seq = 0;
function newId(prefix: string): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${seq}`;
}

interface Plan {
  key: string;
  kind: MessageKind;
  reservation: Reservation;
  guest: Guest;
  channel: Channel;
  sendAt: Date;
  timeZone: string;
  timingNote?: string;
  expiresAt: Date;
  hold?: string;
  event?: ResortEvent;
}

export class Scheduler {
  private messages = new Map<string, ScheduledMessage & { key: string }>();
  private tasks = new Map<string, StaffTask>();
  private suppressions: Suppression[] = [];
  private reservations: Reservation[] = [];
  private events: ResortEvent[] = [];
  private config: SchedulerConfig;
  private generator: Generator;
  private bookings: BookingSource;
  private calendar: EventSource;
  private weather: CachedWeather;
  private forecast?: Forecast;

  constructor(
    bookings: BookingSource,
    calendar: EventSource,
    config: SchedulerConfig = DEFAULT_CONFIG,
    generator: Generator = createGenerator(),
    weather: CachedWeather = createWeather(),
  ) {
    this.bookings = bookings;
    this.calendar = calendar;
    this.weather = weather;
    this.config = { ...config };
    this.generator = generator;
  }

  // ------------------------------------------------------------ accessors

  getConfig(): SchedulerConfig { return this.config; }
  setConfig(patch: Partial<SchedulerConfig>): void { this.config = { ...this.config, ...patch }; }
  getReservations(): Reservation[] { return this.reservations; }
  getReservation(id: string) { return this.reservations.find((r) => r.id === id); }
  getEvents(): ResortEvent[] { return this.events; }
  getSuppressions(): Suppression[] { return this.suppressions; }
  getEventSource(): EventSource { return this.calendar; }
  getForecast(): Forecast | undefined { return this.forecast; }
  getWeatherStatus() { return { source: this.weather.sourceName, error: this.weather.error }; }

  getMessages(): ScheduledMessage[] {
    return [...this.messages.values()]
      .map(({ key: _k, ...m }) => m)
      .sort((a, b) => Date.parse(a.sendAt) - Date.parse(b.sendAt));
  }

  getTasks(): StaffTask[] {
    return [...this.tasks.values()].sort((a, b) => Date.parse(a.dueBy) - Date.parse(b.dueBy));
  }

  // ------------------------------------------------------------ helpers

  private isReturning(r: Reservation): boolean {
    return this.reservations.some(
      (o) => o.id !== r.id && !o.cancelled && o.guest.id === r.guest.id &&
        Date.parse(o.checkOut) <= Date.parse(r.checkIn),
    );
  }

  private eventsDuring(r: Reservation): ResortEvent[] {
    const a = Date.parse(r.checkIn), b = Date.parse(r.checkOut);
    return this.events.filter((e) => {
      const t = Date.parse(e.start);
      return t >= a && t < b;
    });
  }

  private win(): Window {
    return { startHour: this.config.sendWindowStart, endHour: this.config.sendWindowEnd };
  }

  // ------------------------------------------------------------ planning

  /** The stay messages a single reservation should get. */
  private journeyFor(r: Reservation): Plan[] {
    const c = this.config;
    const g = r.guest;
    const checkIn = new Date(r.checkIn);
    const checkOut = new Date(r.checkOut);
    const plans: Plan[] = [];
    const base = { reservation: r, guest: g };

    // 1. Pre-arrival — N days before, at 10:00 in the guest's own time zone.
    {
      const day = new Date(checkIn.getTime() - c.preArrivalDaysBefore * DAY);
      const sendAt = atLocalTime(day, g.timeZone, 10);
      const hold = r.occasion && c.approvalPolicy !== "none"
        ? `Mentions ${staffOccasion(r)} — add a personal line, then approve.`
        : undefined;
      plans.push({
        ...base, key: `pre_arrival:${r.id}:email`, kind: "pre_arrival", channel: "email",
        sendAt, timeZone: g.timeZone, hold,
        timingNote: `10:00 guest time, ${c.preArrivalDaysBefore} days before arrival`,
        expiresAt: new Date(checkIn.getTime() - 12 * HOUR),
      });
    }

    // 2. Arrival day — N hours before arrival. The guest is travelling to us,
    //    so this uses the resort's clock, and must land *before* they arrive.
    {
      const raw = new Date(checkIn.getTime() - c.arrivalHoursBefore * HOUR);
      const fit = fitToWindow(raw, RESORT_TZ, { startHour: 7, endHour: 22 }, "earlier");
      const channels: Channel[] = ["email"];
      if (c.arrivalTextReminder) {
        const text = g.preferredChannels.find((ch) => ch !== "email");
        if (text) channels.push(text);
      }
      for (const ch of channels) {
        plans.push({
          ...base, key: `arrival_day:${r.id}:${ch}`, kind: "arrival_day", channel: ch,
          sendAt: fit.date, timeZone: RESORT_TZ, timingNote: fit.note ?? `${c.arrivalHoursBefore}h before arrival`,
          expiresAt: checkIn,
        });
      }
    }

    // 3. In-stay — after check-in, on the resort's clock.
    {
      const raw = new Date(checkIn.getTime() + c.inStayHoursAfterCheckIn * HOUR);
      const fit = fitToWindow(raw, RESORT_TZ, { startHour: 8, endHour: 21 }, "later");
      plans.push({
        ...base, key: `in_stay:${r.id}:email`, kind: "in_stay", channel: "email",
        sendAt: fit.date, timeZone: RESORT_TZ,
        timingNote: fit.note ?? `${c.inStayHoursAfterCheckIn}h after check-in`,
        expiresAt: new Date(checkOut.getTime() - 12 * HOUR),
      });
    }

    // 4. Post-stay — after check-out, in the guest's time zone (they're home).
    {
      const raw = new Date(checkOut.getTime() + c.postStayHoursAfterCheckOut * HOUR);
      const fit = fitToWindow(raw, g.timeZone, this.win(), "later");
      plans.push({
        ...base, key: `post_stay:${r.id}:email`, kind: "post_stay", channel: "email",
        sendAt: fit.date, timeZone: g.timeZone,
        timingNote: fit.note ?? `${c.postStayHoursAfterCheckOut}h after check-out`,
        expiresAt: new Date(checkOut.getTime() + 7 * DAY),
      });
    }
    return plans;
  }

  /** Event invites to opted-in past guests, with the anti-spam rules applied. */
  private invites(journey: Plan[], now: Date): Plan[] {
    const c = this.config;
    this.suppressions = [];
    const out: Plan[] = [];

    // Already-sent invites count towards the limits.
    const sentInvites = new Map<string, number[]>();
    for (const m of this.messages.values()) {
      if (m.kind === "event_invite" && m.status === "sent") {
        const list = sentInvites.get(m.guestId) ?? [];
        list.push(Date.parse(m.sendAt));
        sentInvites.set(m.guestId, list);
      }
    }

    const guestsById = new Map<string, Guest>();
    for (const r of this.reservations) guestsById.set(r.guest.id, r.guest);

    const candidates: { guest: Guest; event: ResortEvent; sendAt: Date; lastStay: Reservation }[] = [];
    for (const event of this.events) {
      if (event.audience !== "everyone") continue;
      const evStart = Date.parse(event.start);
      if (evStart < now.getTime()) continue;
      for (const guest of guestsById.values()) {
        const stays = this.reservations.filter((r) => r.guest.id === guest.id && !r.cancelled);
        const past = stays
          .filter((r) => Date.parse(r.checkOut) <= now.getTime())
          .sort((a, b) => Date.parse(b.checkOut) - Date.parse(a.checkOut));
        if (past.length === 0) continue; // never stayed yet — not a past guest
        const name = `${guest.firstName} ${guest.lastName}`;
        const skip = (reason: string) =>
          this.suppressions.push({ guestName: name, eventTitle: event.title.en, reason });

        if (!guest.marketingConsent) { skip("Didn't opt in to news after their stay"); continue; }
        const staying = stays.some((r) => Date.parse(r.checkIn) <= evStart && Date.parse(r.checkOut) > evStart);
        if (staying) { skip("Will be staying during the event — told in their stay messages instead"); continue; }

        const day = new Date(evStart - event.inviteLeadDays * DAY);
        let sendAt = atLocalTime(day, guest.timeZone, 10);
        if (sendAt.getTime() < now.getTime()) {
          sendAt = fitToWindow(new Date(now.getTime() + HOUR), guest.timeZone, this.win(), "later").date;
        }
        candidates.push({ guest, event, sendAt, lastStay: past[0] });
      }
    }

    candidates.sort((a, b) => a.sendAt.getTime() - b.sendAt.getTime());
    const accepted = new Map<string, number[]>(sentInvites);
    for (const { guest, event, sendAt, lastStay } of candidates) {
      const name = `${guest.firstName} ${guest.lastName}`;
      const skip = (reason: string) =>
        this.suppressions.push({ guestName: name, eventTitle: event.title.en, reason });
      const t = sendAt.getTime();
      const mine = accepted.get(guest.id) ?? [];

      const tooSoon = mine.find((x) => Math.abs(x - t) < c.inviteMinDaysBetween * DAY);
      if (tooSoon !== undefined) {
        skip(`Already invited to something within ${c.inviteMinDaysBetween} days`);
        continue;
      }
      const yearCount = mine.filter((x) => Math.abs(x - t) < 365 * DAY).length;
      if (yearCount >= c.inviteMaxPerYear) { skip(`Reached ${c.inviteMaxPerYear} invites this year`); continue; }
      const nearStay = journey.find(
        (p) => p.guest.id === guest.id && Math.abs(p.sendAt.getTime() - t) < c.inviteQuietDaysAroundStay * DAY,
      );
      if (nearStay) {
        skip(`Already hearing from us about a stay within ${c.inviteQuietDaysAroundStay} days`);
        continue;
      }

      mine.push(t);
      accepted.set(guest.id, mine);
      out.push({
        key: `event_invite:${guest.id}:${event.id}`, kind: "event_invite", channel: "email",
        reservation: lastStay, guest, event, sendAt, timeZone: guest.timeZone,
        timingNote: `10:00 guest time, ${event.inviteLeadDays} days before the event`,
        expiresAt: new Date(Date.parse(event.start) - DAY),
      });
    }
    return out;
  }

  /** Small manual touches the system asks the team to do. */
  private planTasks(now: Date): void {
    const keep = new Map<string, StaffTask>();
    for (const r of this.reservations) {
      if (r.cancelled || Date.parse(r.checkIn) < now.getTime()) continue; // upcoming arrivals only
      const who = `${r.guest.firstName} ${r.guest.lastName}`;
      const where = placeLabel(r);
      const add = (kind: StaffTask["kind"], text: string) => {
        const id = `${kind}:${r.id}`;
        keep.set(id, { id, reservationId: r.id, kind, dueBy: r.checkIn, text, done: this.tasks.get(id)?.done ?? false });
      };
      if (this.isReturning(r)) {
        add("welcome_back_package", `Welcome-back gift for ${who} (returning guest) — place it in ${where} before arrival.`);
      }
      if (r.occasion) {
        add("occasion", `${who} is celebrating ${staffOccasion(r)} — handwritten note in ${where}.`);
      }
      const { hour } = zonedParts(new Date(r.checkIn), RESORT_TZ);
      if (hour >= 20 || hour < 7) {
        add("late_arrival", `${who} arrives after reception closes (~${localLabel(new Date(r.checkIn), RESORT_TZ)}) — arrange someone to meet them.`);
      }
      // What the guest asked for on their "prepare your stay" page.
      for (const t of preferenceTasks(r, where)) {
        const id = `guest_request:${t.key}:${r.id}`;
        keep.set(id, { id, reservationId: r.id, kind: "guest_request", dueBy: r.checkIn, text: t.text, done: this.tasks.get(id)?.done ?? false });
      }
    }
    this.tasks = keep;
  }

  /**
   * Build (or rebuild) the full plan from the live sources. Sent, cancelled and
   * skipped messages are kept as history; staff-edited wording is never
   * overwritten; anything no longer wanted (e.g. an event was removed) is dropped.
   */
  async plan(now: Date = new Date()): Promise<void> {
    this.reservations = await this.bookings.listReservations();
    this.events = await this.calendar.listEvents();
    this.forecast = await this.weather.get();

    // Stays that ended over a week ago are history: they inform "welcome back"
    // and invites, but get no stay messages.
    const active = this.reservations.filter(
      (r) => !r.cancelled && Date.parse(r.checkOut) + 7 * DAY > now.getTime(),
    );
    const journey = active.flatMap((r) => this.journeyFor(r));
    const plans = [...journey, ...this.invites(journey, now)];
    const wanted = new Set(plans.map((p) => p.key));

    for (const p of plans) {
      const existing = [...this.messages.values()].find((m) => m.key === p.key);
      if (existing && ["sent", "cancelled", "skipped"].includes(existing.status)) continue;
      // A moment that had already passed before the system first saw the booking
      // (e.g. a last-minute reservation) is simply not planned.
      if (!existing && p.expiresAt.getTime() <= now.getTime()) continue;

      const timing = {
        sendAt: p.sendAt.toISOString(),
        timeZone: p.timeZone,
        localSendTime: localLabel(p.sendAt, p.timeZone),
        timingNote: p.timingNote,
        expiresAt: p.expiresAt.toISOString(),
      };

      if (existing?.edited) {
        Object.assign(existing, timing);
        continue;
      }

      const stayPlan = p.kind === "in_stay" ? recommend(p.reservation, p.sendAt, this.forecast) : undefined;
      const generated = await this.generator.generate({
        reservation: p.reservation,
        kind: p.kind,
        channel: p.channel,
        language: p.guest.language,
        returning: this.isReturning(p.reservation),
        eventsDuringStay: this.eventsDuring(p.reservation),
        event: p.event,
        stayPlan,
      });

      // Staff read everything in English: keep an English copy of messages
      // that go out in Portuguese or French.
      const english = p.guest.language === "en" ? undefined : await this.generator.generate({
        reservation: p.reservation, kind: p.kind, channel: p.channel, language: "en",
        returning: this.isReturning(p.reservation), eventsDuringStay: this.eventsDuring(p.reservation),
        event: p.event, stayPlan,
      });

      const policy = this.config.approvalPolicy;
      const hold = policy === "none" ? undefined
        : policy === "all" ? (p.hold ?? "Every message needs approval (see Settings).")
        : p.hold ?? (policy === "personal_and_suggestions" && stayPlan?.days.length
          ? "Weather-based suggestions — check the picks, then approve."
          : undefined);
      const status = existing?.status === "scheduled" && existing.statusNote === "Approved"
        ? "scheduled"
        : hold ? "held" : "scheduled";

      const msg = {
        id: existing?.id ?? newId("msg"),
        key: p.key,
        reservationId: p.reservation.id,
        guestId: p.guest.id,
        kind: p.kind,
        eventId: p.event?.id,
        channel: p.channel,
        language: p.guest.language,
        ...timing,
        status,
        statusNote: status === "held" ? hold : existing?.statusNote,
        subject: generated.subject,
        body: generated.body,
        generatedBy: generated.generatedBy,
        english: english ? { subject: english.subject, body: english.body } : undefined,
        suggestions: stayPlan?.days.map((d) => ({ date: d.date, activity: d.activity.name.en, reason: d.reason })),
      } as ScheduledMessage & { key: string };
      this.messages.set(msg.id, msg);
    }

    for (const [id, m] of this.messages) {
      if (!wanted.has(m.key) && (m.status === "scheduled" || m.status === "held")) {
        this.messages.delete(id);
      }
    }

    this.planTasks(now);
  }

  /**
   * Write one message for any reservation (real or an example guest) without
   * scheduling it — used by the Emails tab to show how a template reads.
   */
  async preview(r: Reservation, kind: MessageKind, language: Language, opts: { returning?: boolean; channel?: Channel; event?: ResortEvent } = {}) {
    const sendAt = kind === "in_stay" ? new Date(Date.parse(r.checkIn) + this.config.inStayHoursAfterCheckIn * HOUR) : new Date();
    const stayPlan = kind === "in_stay" ? recommend(r, sendAt, this.forecast) : undefined;
    const a = Date.parse(r.checkIn), b = Date.parse(r.checkOut);
    return this.generator.generate({
      reservation: r, kind, channel: opts.channel ?? "email", language,
      returning: opts.returning ?? false,
      eventsDuringStay: this.events.filter((e) => { const t = Date.parse(e.start); return t >= a && t < b; }),
      event: opts.event ?? (kind === "event_invite" ? this.events.find((e) => e.audience === "everyone") : undefined),
      stayPlan,
    });
  }

  // ------------------------------------------------------------ staff actions

  editMessage(id: string, patch: { subject?: string; body?: string }): boolean {
    const m = this.messages.get(id);
    if (!m || (m.status !== "scheduled" && m.status !== "held")) return false;
    if (patch.subject !== undefined) m.subject = patch.subject;
    if (patch.body !== undefined) m.body = patch.body;
    m.edited = true;
    return true;
  }

  approveMessage(id: string): boolean {
    const m = this.messages.get(id);
    if (!m || m.status !== "held") return false;
    m.status = "scheduled";
    m.statusNote = "Approved";
    return true;
  }

  cancelMessage(id: string): boolean {
    const m = this.messages.get(id);
    if (!m || (m.status !== "scheduled" && m.status !== "held")) return false;
    m.status = "cancelled";
    return true;
  }

  toggleTask(id: string): boolean {
    const t = this.tasks.get(id);
    if (!t) return false;
    t.done = !t.done;
    return true;
  }

  // ------------------------------------------------------------ sending

  /**
   * Demo helper: fast-forward the clock to `target` as if the system had been
   * running the whole time — stepping an hour at a time so each message goes
   * out at its own moment instead of being judged stale on arrival.
   */
  async runUntil(target: Date, from: Date = new Date()): Promise<ScheduledMessage[]> {
    const sent: ScheduledMessage[] = [];
    for (let t = from.getTime(); t < target.getTime(); t += HOUR) {
      sent.push(...(await this.runDue(new Date(t))));
    }
    sent.push(...(await this.runDue(target)));
    return sent;
  }

  /**
   * Send every scheduled message whose time has come. A message whose moment
   * has already passed (e.g. a booking made the day before arrival) is marked
   * skipped instead — a stale "three days to go" is worse than none.
   */
  async runDue(now: Date = new Date()): Promise<ScheduledMessage[]> {
    const sent: ScheduledMessage[] = [];
    // Allergy details are only kept for the stay itself.
    purgeAfterStay(this.reservations, now);
    for (const m of [...this.messages.values()].sort((a, b) => Date.parse(a.sendAt) - Date.parse(b.sendAt))) {
      if (m.status !== "scheduled" && m.status !== "held") continue;
      if (Date.parse(m.sendAt) > now.getTime()) continue;

      if (now.getTime() > Date.parse(m.expiresAt)) {
        m.status = "skipped";
        m.statusNote = m.kind === "pre_arrival"
          ? "Booked too close to arrival for this message — not sent"
          : "Its moment passed before it could go — not sent";
        continue;
      }
      if (m.status === "held") continue; // waits for a person

      const reservation = this.getReservation(m.reservationId);
      if (!reservation) continue;
      const result = await senderFor(m.channel).send(m, reservation);
      if (result.ok) {
        m.status = "sent";
        m.sentAt = now.toISOString();
        sent.push(m);
      }
    }
    return sent;
  }
}
