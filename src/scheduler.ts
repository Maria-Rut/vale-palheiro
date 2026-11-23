import type {
  Channel,
  MessageKind,
  Reservation,
  ScheduledMessage,
} from "./types.ts";
import { createGenerator, type Generator } from "./generator.ts";
import { senderFor } from "./channels.ts";
import { preferencesOpen, purgeAfterStay } from "./preferences.ts";

/**
 * The scheduler is the brain of "option C". For every reservation it:
 *   1. decides *when* each automated message should go out,
 *   2. decides *which channel(s)* to use (the guest's preferences),
 *   3. renders the copy up front so staff can preview and edit it,
 *   4. sends anything that is now due.
 *
 * Timing rules (configurable):
 *   - preferences: PREFERENCES_HOURS_BEFORE check-in (default 7 days before);
 *                  late bookings get it straight away, and it is skipped when
 *                  arrival is too close for the team to prepare (they call instead)
 *   - pre-stay:  PRE_STAY_HOURS_BEFORE check-in  (default 2h before arrival)
 *   - post-stay: POST_STAY_HOURS_AFTER check-out (default 24h after departure)
 *
 * To keep the prototype honest and demoable, the scheduler never sends a
 * message whose send time is in the future, and it only sends each message
 * once (status flips scheduled -> sent).
 */

export interface SchedulerConfig {
  preferencesHoursBefore: number;
  preStayHoursBefore: number;
  postStayHoursAfter: number;
  /**
   * How many channels to use per moment. "preferred" sends only on the guest's
   * first preferred channel (least intrusive, recommended). "all" sends on
   * every channel they opted into.
   */
  channelStrategy: "preferred" | "all";
}

export const DEFAULT_CONFIG: SchedulerConfig = {
  preferencesHoursBefore: 7 * 24,
  preStayHoursBefore: 2,
  postStayHoursAfter: 24,
  channelStrategy: "preferred",
};

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

  constructor(
    reservations: Reservation[],
    config: SchedulerConfig = DEFAULT_CONFIG,
    generator: Generator = createGenerator(),
  ) {
    this.reservations = reservations;
    this.config = config;
    this.generator = generator;
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

  private sendAtFor(r: Reservation, kind: MessageKind, now: Date): string {
    if (kind === "preferences") {
      const ideal = addHours(r.checkIn, -this.config.preferencesHoursBefore);
      // Booked late: invite them now rather than at a time already passed.
      return Date.parse(ideal) < now.getTime() ? now.toISOString() : ideal;
    }
    return kind === "pre_stay"
      ? addHours(r.checkIn, -this.config.preStayHoursBefore)
      : addHours(r.checkOut, this.config.postStayHoursAfter);
  }

  /** Whether a guest should get the "prepare your stay" invite at all. */
  private wantsPreferencesInvite(r: Reservation, now: Date): boolean {
    return !r.preferences && preferencesOpen(r, now);
  }

  /** Called when a guest submits the preferences page. */
  async preferencesUpdated(reservationId: string): Promise<void> {
    for (const m of this.messages.values()) {
      if (m.reservationId === reservationId && m.kind === "preferences" && m.status === "scheduled") {
        m.status = "cancelled"; // they've already answered — no need to invite them
      }
    }
    await this.plan();
  }

  /**
   * Build (or rebuild) the full message plan for all reservations. Existing
   * sent messages are preserved; only still-scheduled ones are regenerated so
   * that config/preview changes take effect without re-sending.
   */
  async plan(now: Date = new Date()): Promise<void> {
    const kinds: MessageKind[] = ["preferences", "pre_stay", "post_stay"];
    for (const r of this.reservations) {
      for (const kind of kinds) {
        for (const channel of channelsFor(r, this.config.channelStrategy)) {
          const key = `${r.id}:${kind}:${channel}`;
          const existing = this.findBy(r.id, kind, channel);
          if (existing && existing.status !== "scheduled") continue;
          if (kind === "preferences" && !existing && !this.wantsPreferencesInvite(r, now)) continue;

          const generated = await this.generator.generate({
            reservation: r,
            kind,
            channel,
            language: r.guest.language,
          });

          if (existing) {
            existing.sendAt = this.sendAtFor(r, kind, now);
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
              sendAt: this.sendAtFor(r, kind, now),
              status: "scheduled",
              subject: generated.subject,
              body: generated.body,
              generatedBy: generated.generatedBy,
            };
            this.messages.set(msg.id, msg);
            void key;
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

  /** Lets staff edit the generated copy before it goes out. */
  editMessage(id: string, patch: { subject?: string; body?: string }): boolean {
    const m = this.messages.get(id);
    if (!m || m.status !== "scheduled") return false;
    if (patch.subject !== undefined) m.subject = patch.subject;
    if (patch.body !== undefined) m.body = patch.body;
    return true;
  }

  cancelMessage(id: string): boolean {
    const m = this.messages.get(id);
    if (!m || m.status !== "scheduled") return false;
    m.status = "cancelled";
    return true;
  }

  /**
   * Send every scheduled message whose send time is at or before `now`.
   * Returns the messages that were sent on this run.
   */
  async runDue(now: Date = new Date()): Promise<ScheduledMessage[]> {
    const sent: ScheduledMessage[] = [];
    let preferencesChanged = false;
    for (const r of this.reservations) {
      if (purgeAfterStay(r, now)) preferencesChanged = true;
    }
    if (preferencesChanged) await this.plan(now);
    for (const m of this.getMessages()) {
      if (m.status !== "scheduled") continue;
      if (Date.parse(m.sendAt) > now.getTime()) continue;

      const reservation = this.getReservation(m.reservationId);
      if (!reservation) continue;

      // Too late to prepare, or already answered: don't send the invite.
      if (m.kind === "preferences" && !this.wantsPreferencesInvite(reservation, now)) {
        m.status = "cancelled";
        continue;
      }

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
