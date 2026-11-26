import type { Channel, DeliveryResult, ScheduledMessage } from "./types.ts";
import { toPlainText } from "./templates.ts";
import type { Reservation } from "./types.ts";

/**
 * Channel adapters. Each provider lives behind this one interface, so the
 * scheduler never needs to know which provider is in use.
 *
 *   email     — SIMULATED in this prototype: the delivery is recorded in the
 *               sent log (shown in the dashboard) instead of going to a real
 *               provider. Going live = an SMTP / SendGrid / Postmark adapter.
 *   whatsapp  — PLANNED: WhatsApp Business (Cloud) API. Until the resort's
 *               Business account and credentials are set up, WhatsApp
 *               messages are NOT sent by the system: when due they move to
 *               "To send by hand" in the Outbox, where staff open them in
 *               WhatsApp (pre-filled) and mark them sent. Nothing pretends to
 *               be delivered.
 *   sms       — not used.
 */

export interface ChannelSender {
  readonly channel: Channel;
  /** false = no provider connected: due messages wait in the Outbox to be sent by hand. */
  readonly connected: boolean;
  /** Shown on messages waiting to be sent by hand. */
  readonly manualNote?: string;
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
  accommodation: string;
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
    // What a real provider would get: the plain-text part (buttons spelled
    // out as "Label: link"); the HTML part is toEmailHtml(message.body).
    body: toPlainText(message.body),
    guestName: `${reservation.guest.firstName} ${reservation.guest.lastName}`,
    accommodation: reservation.unit ? `${reservation.accommodation} ${reservation.unit}` : reservation.accommodation,
  });
}

class MockEmailSender implements ChannelSender {
  readonly channel = "email" as const;
  readonly connected = true; // simulated: recorded in the sent log
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

class NotConnectedSender implements ChannelSender {
  readonly connected = false;
  readonly channel: Channel;
  readonly manualNote: string;
  constructor(channel: Channel, manualNote: string) { this.channel = channel; this.manualNote = manualNote; }
  async send(_m: ScheduledMessage, r: Reservation): Promise<DeliveryResult> {
    return { ok: false, channel: this.channel, to: r.guest.phone, detail: this.manualNote };
  }
}

/**
 * WhatsApp Business (Cloud) API — the seam for going live. Needs, from the
 * resort's Meta Business account: a verified business number, its Phone
 * Number ID and a permanent access token (env WHATSAPP_PHONE_NUMBER_ID,
 * WHATSAPP_TOKEN), plus message templates approved by Meta — WhatsApp only
 * lets a business start a conversation with an approved template.
 * Template mapping is still to be done, so for now a configured sender
 * reports a clear failure rather than sending free text that Meta would reject.
 */
class WhatsAppBusinessSender implements ChannelSender {
  readonly channel = "whatsapp" as const;
  readonly connected = true;
  private phoneNumberId: string;
  private token: string;
  constructor(phoneNumberId: string, token: string) { this.phoneNumberId = phoneNumberId; this.token = token; }
  async send(_m: ScheduledMessage, r: Reservation): Promise<DeliveryResult> {
    void this.phoneNumberId; void this.token;
    return {
      ok: false, channel: this.channel, to: r.guest.phone,
      detail: "WhatsApp Business API credentials found, but the Meta-approved message templates aren't mapped yet — send by hand for now.",
    };
  }
}

function whatsappSender(): ChannelSender {
  const id = process.env.WHATSAPP_PHONE_NUMBER_ID, token = process.env.WHATSAPP_TOKEN;
  if (id && token) return new WhatsAppBusinessSender(id, token);
  return new NotConnectedSender("whatsapp", "WhatsApp Business API not connected yet (planned) — open in WhatsApp, send, then mark as sent.");
}

/** What each channel is running on, for the Integrations panel. */
export function channelStatus() {
  return {
    email: "simulated",
    whatsapp: process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_TOKEN ? "configured" : "manual",
  };
}

const senders: Record<Channel, ChannelSender> = {
  email: new MockEmailSender(),
  sms: new NotConnectedSender("sms", "SMS isn't used — send by hand if needed."),
  whatsapp: whatsappSender(),
};

export function senderFor(channel: Channel): ChannelSender {
  return senders[channel];
}
