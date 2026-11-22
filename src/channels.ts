import type { Channel, DeliveryResult, ScheduledMessage } from "./types.ts";
import type { Reservation } from "./types.ts";

/**
 * Channel adapters. Each real provider (SendGrid for email, Twilio for SMS and
 * WhatsApp) lives behind this one interface, so the scheduler never needs to
 * know which provider is in use.
 *
 * In this sandbox there is no outbound network, so the adapters are "mock"
 * senders: they record the delivery and log it rather than hitting a provider.
 * A log of every send is kept in-memory and surfaced in the dashboard so the
 * demo can show exactly what would have gone out, to whom, on which channel.
 */

export interface ChannelSender {
  readonly channel: Channel;
  send(message: ScheduledMessage, reservation: Reservation): Promise<DeliveryResult>;
}

/** One recorded delivery, for the activity log in the UI. */
export interface SentRecord {
  at: string;
  channel: Channel;
  to: string;
  subject?: string;
  body: string;
  guestName: string;
  villa: string;
}

const sentLog: SentRecord[] = [];

export function getSentLog(): SentRecord[] {
  return [...sentLog].reverse(); // newest first
}

export function clearSentLog(): void {
  sentLog.length = 0;
}

function record(
  message: ScheduledMessage,
  reservation: Reservation,
  to: string,
): void {
  sentLog.push({
    at: new Date().toISOString(),
    channel: message.channel,
    to,
    subject: message.subject,
    body: message.body,
    guestName: `${reservation.guest.firstName} ${reservation.guest.lastName}`,
    villa: reservation.villa,
  });
}

class MockEmailSender implements ChannelSender {
  readonly channel = "email" as const;
  async send(message: ScheduledMessage, reservation: Reservation) {
    const to = reservation.guest.email;
    record(message, reservation, to);
    return {
      ok: true,
      channel: this.channel,
      to,
      detail: `Email queued to ${to} — subject: "${message.subject ?? ""}"`,
    } satisfies DeliveryResult;
  }
}

class MockSmsSender implements ChannelSender {
  readonly channel = "sms" as const;
  async send(message: ScheduledMessage, reservation: Reservation) {
    const to = reservation.guest.phone;
    record(message, reservation, to);
    return {
      ok: true,
      channel: this.channel,
      to,
      detail: `SMS queued to ${to} (${message.body.length} chars)`,
    } satisfies DeliveryResult;
  }
}

class MockWhatsAppSender implements ChannelSender {
  readonly channel = "whatsapp" as const;
  async send(message: ScheduledMessage, reservation: Reservation) {
    const to = reservation.guest.phone;
    record(message, reservation, to);
    return {
      ok: true,
      channel: this.channel,
      to,
      detail: `WhatsApp message queued to ${to}`,
    } satisfies DeliveryResult;
  }
}

const senders: Record<Channel, ChannelSender> = {
  email: new MockEmailSender(),
  sms: new MockSmsSender(),
  whatsapp: new MockWhatsAppSender(),
};

export function senderFor(channel: Channel): ChannelSender {
  return senders[channel];
}
