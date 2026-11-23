import type {
  Channel,
  GuestPreferences,
  MessageKind,
  Reservation,
  ScheduledMessage,
  WeatherKind,
} from "./types.ts";
import { createGenerator, type Generator } from "./generator.ts";
import { senderFor } from "./channels.ts";

/**
 * The scheduler is the brain of "option C". For every reservation it:
 *   1. decides *when* each automated message should go out,
 *   2. decides *which channel(s)* to use (the guest's preferences),
 *   3. renders the copy up front so staff can preview and edit it,
 *   4. sends anything that is now due.
 *
 * There are four moments, in order:
 *   - preferences : PREFERENCES_DAYS_BEFORE check-in (default 7 days before) —
 *                   invites the guest to fill the questionnaire.
 *   - pre_stay    : PRE_STAY_HOURS_BEFORE check-in (default 2h before arrival).
 *   - experiences : EXPERIENCES_HOURS_AFTER check-in (default 3h after arrival) —
 *                   suggests activities for the day's weather.
 *   - post_stay   : POST_STAY_HOURS_AFTER check-out (default 24h after departure).
 *
 * To keep the prototype honest and demoable, the scheduler never sends a
 * message whose send time is in the future, and it only sends each message
 * once (status flips scheduled -> sent).
 */

export interface SchedulerConfig {
  preferencesDaysBefore: number;
  preStayHoursBefore: number;
  experiencesHoursAfter: number;
  postStayHoursAfter: number;
  /**
   * How many channels to use per moment. "preferred" sends only on the guest's
   * first preferred channel (least intrusive, recommended). "all" sends on
   * every channel they opted into.
   */
  channelStrategy: "preferred" | "all";
  /**
   * Which messages must be approved by staff before Terra will send them.
   *   - "uncertain" : hold only the less-predictable ones (experiences, which
   *                   depend on the forecast; and anything staff edited). The
   *                   rest send automatically. (default)
   *   - "all"       : hold every message for approval.
   *   - "none"      : send everything automatically (no approval step).
   */
  approvalPolicy: "uncertain" | "all" | "none";
}

export const DEFAULT_CONFIG: SchedulerConfig = {
  preferencesDaysBefore: 7,
  preStayHoursBefore: 2,
  experiencesHoursAfter: 3,
  postStayHoursAfter: 24,
  channelStrategy: "preferred",
  approvalPolicy: "uncertain",
};

/**
 * Message kinds that are "uncertain" and so are held for approval under the
 * default policy. Experiences emails depend on the (simulated) forecast and
 * auto-selected activities, so a human should glance at them before they go.
 */
const UNCERTAIN_KINDS: ReadonlySet<MessageKind> = new Set(["experiences"]);

const ALL_KINDS: MessageKind[] = ["preferences", "pre_stay", "experiences", "post_stay"];

function addHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 3600_000).toISOString();
}

function channelsFor(
  reservation: Reservation,
  strategy: SchedulerConfig["channelStrategy"],
): Channel[] {
  const prefs = reservation.guest.preferredChannels;
  if (prefs.length === 0) return ["email"];
  return strategy === "all" ? prefs : [prefs[0]];
}

let seq = 0;
function newId(): string {
  seq += 1;
  return `msg_${Date.now().toString(36)}_${seq}`;
}

export class Scheduler {
  private messages = new Map<string, ScheduledMessage>();
  private reservations: Reservation[];
  private config: SchedulerConfig;
  private generator: Generator;
  /** Simulated forecast per reservation, keyed by reservation id. */
  private weather = new Map<string, WeatherKind>();
  /** Base URL used to build each guest's questionnaire link. */
  private questionnaireBase: string;

  constructor(
    reservations: Reservation[],
    config: SchedulerConfig = DEFAULT_CONFIG,
    generator: Generator = createGenerator(),
    questionnaireBase = "/q",
  ) {
    this.reservations = reservations;
    this.config = config;
    this.generator = generator;
    this.questionnaireBase = questionnaireBase;
  }

  getConfig(): SchedulerConfig {
    return this.config;
  }

  setConfig(config: Partial<SchedulerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getReservations(): Reservation[] {
    return this.reservations;
  }

  getReservation(id: string): Reservation | undefined {
    return this.reservations.find((r) => r.id === id);
  }

  getMessages(): ScheduledMessage[] {
    return [...this.messages.values()].sort(
      (a, b) => Date.parse(a.sendAt) - Date.parse(b.sendAt),
    );
  }

  getMessage(id: string): ScheduledMessage | undefined {
    return this.messages.get(id);
  }

  /** Weather used for a reservation's experiences message (simulated in demo). */
  getWeather(reservationId: string): WeatherKind {
    return this.weather.get(reservationId) ?? "sunny";
  }

  setWeather(reservationId: string, weather: WeatherKind): void {
    this.weather.set(reservationId, weather);
  }

  /**
   * Record the preferences a guest submits via the questionnaire. Stored on the
   * reservation (the CRM reads this) and used to tailor later messages.
   */
  setPreferences(reservationId: string, prefs: GuestPreferences): boolean {
    const r = this.getReservation(reservationId);
    if (!r) return false;
    r.preferences = prefs;
    return true;
  }

  private sendAtFor(r: Reservation, kind: MessageKind): string {
    switch (kind) {
      case "preferences":
        return addHours(r.checkIn, -this.config.preferencesDaysBefore * 24);
      case "pre_stay":
        return addHours(r.checkIn, -this.config.preStayHoursBefore);
      case "experiences":
        return addHours(r.checkIn, this.config.experiencesHoursAfter);
      case "post_stay":
        return addHours(r.checkOut, this.config.postStayHoursAfter);
    }
  }

  /**
   * Build (or rebuild) the full message plan for all reservations. Existing
   * sent messages are preserved; only still-scheduled ones are regenerated so
   * that config/preview/weather/preferences changes take effect without
   * re-sending.
   */
  /** Initial status for a freshly planned message, given the approval policy. */
  private initialStatus(kind: MessageKind): "needs_approval" | "scheduled" {
    const policy = this.config.approvalPolicy;
    if (policy === "none") return "scheduled";
    if (policy === "all") return "needs_approval";
    // "uncertain": hold only the less-predictable kinds.
    return UNCERTAIN_KINDS.has(kind) ? "needs_approval" : "scheduled";
  }

  async plan(): Promise<void> {
    for (const r of this.reservations) {
      for (const kind of ALL_KINDS) {
        for (const channel of channelsFor(r, this.config.channelStrategy)) {
          const existing = this.findBy(r.id, kind, channel);
          if (existing && existing.status === "sent") continue;

          const generated = await this.generator.generate({
            reservation: r,
            kind,
            channel,
            language: r.guest.language,
            questionnaireUrl: `${this.questionnaireBase}/${r.reference}`,
            weather: this.getWeather(r.id),
          });

          if (existing) {
            // Preserve staff decisions (approved/cancelled/edited); only refresh
            // the copy and send time. A still-held message stays held.
            existing.sendAt = this.sendAtFor(r, kind);
            existing.subject = generated.subject;
            existing.body = generated.body;
            existing.generatedBy = generated.generatedBy;
          } else {
            const msg: ScheduledMessage = {
              id: newId(),
              reservationId: r.id,
              kind,
              channel,
              language: r.guest.language,
              sendAt: this.sendAtFor(r, kind),
              status: this.initialStatus(kind),
              subject: generated.subject,
              body: generated.body,
              generatedBy: generated.generatedBy,
            };
            this.messages.set(msg.id, msg);
          }
        }
      }
    }
  }

  private findBy(
    reservationId: string,
    kind: MessageKind,
    channel: Channel,
  ): ScheduledMessage | undefined {
    for (const m of this.messages.values()) {
      if (
        m.reservationId === reservationId &&
        m.kind === kind &&
        m.channel === channel
      ) {
        return m;
      }
    }
    return undefined;
  }

  /**
   * Lets staff edit the generated copy before it goes out. Editing makes the
   * message "uncertain" again, so it returns to needs_approval (unless the
   * policy is "none") and must be re-approved before sending.
   */
  editMessage(id: string, patch: { subject?: string; body?: string }): boolean {
    const m = this.messages.get(id);
    if (!m || (m.status !== "scheduled" && m.status !== "needs_approval")) return false;
    if (patch.subject !== undefined) m.subject = patch.subject;
    if (patch.body !== undefined) m.body = patch.body;
    if (this.config.approvalPolicy !== "none") m.status = "needs_approval";
    return true;
  }

  /** Staff approves a held message so Terra may send it at its send time. */
  approveMessage(id: string): boolean {
    const m = this.messages.get(id);
    if (!m || m.status !== "needs_approval") return false;
    m.status = "scheduled";
    return true;
  }

  cancelMessage(id: string): boolean {
    const m = this.messages.get(id);
    if (!m || (m.status !== "scheduled" && m.status !== "needs_approval")) return false;
    m.status = "cancelled";
    return true;
  }

  /**
   * Send every scheduled message whose send time is at or before `now`.
   * Returns the messages that were sent on this run.
   */
  async runDue(now: Date = new Date()): Promise<ScheduledMessage[]> {
    const sent: ScheduledMessage[] = [];
    for (const m of this.getMessages()) {
      if (m.status !== "scheduled") continue;
      if (Date.parse(m.sendAt) > now.getTime()) continue;

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
