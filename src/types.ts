/**
 * Core domain types for Terra — the guest messaging concierge.
 *
 * These describe reservations and the messages the system schedules and sends.
 * They are intentionally simple so the prototype can later map onto a real
 * PMS / booking system (Cloudbeds, Mews, Booking.com, etc.) without reshaping
 * the rest of the app.
 *
 * Fields mirror what Vale Palheiro's real booking flow captures (motive of
 * stay, rate plan, breakfast, currency) so nothing here is invented.
 */

/** Languages the resort serves (site is published in EN / PT / FR). */
export type Language = "en" | "pt" | "fr";

/** Delivery channels a guest can be reached on. */
export type Channel = "email" | "sms" | "whatsapp";

/**
 * Motive of stay — this is Vale Palheiro's actual booking-form field
 * ("Business" / "Leisure" / "A little of both"). It gently shapes tone and the
 * single experience we might mention, without inventing guest intent.
 */
export type Motive = "business" | "leisure" | "both";

/** The two automated moments in the guest journey. */
export type MessageKind = "pre_stay" | "post_stay";

/** Lifecycle of a scheduled message. */
export type MessageStatus = "scheduled" | "sent" | "cancelled";

export interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string; // E.164, used for SMS + WhatsApp
  language: Language;
  /** Channels this guest has opted into, in order of preference. */
  preferredChannels: Channel[];
}

export interface Reservation {
  id: string;
  /** Human-friendly booking reference shown to staff. */
  reference: string;
  guest: Guest;
  /**
   * Accommodation booked. Vale Palheiro's collection is 13 villas, suites and
   * casitas; confirmed real names are used where known (Casa Atlantica, Casa
   * Lyra), otherwise a generic room type (Suite, Casita) — nothing invented.
   */
  accommodation: string;
  /** ISO datetime of arrival (check-in). */
  checkIn: string;
  /** ISO datetime of departure (check-out). */
  checkOut: string;
  /** Number of guests, matching the booking ("1 Room, 2 Adults"). */
  partySize: number;
  /** Real booking field: motive of stay. */
  motive: Motive;
  /** Rate plan as shown at booking, e.g. "Early Booking Rate". */
  ratePlan: string;
  /** Whether breakfast is included (true on breakfast-inclusive rates). */
  breakfastIncluded: boolean;
  /** Optional free-text the staff noted, woven into personalisation. */
  notes?: string;
}

/**
 * A single message the scheduler has planned or sent, for one reservation,
 * one moment (pre/post), and one channel.
 */
export interface ScheduledMessage {
  id: string;
  reservationId: string;
  kind: MessageKind;
  channel: Channel;
  language: Language;
  /** ISO datetime the message should go out. */
  sendAt: string;
  status: MessageStatus;
  /** Rendered subject (email only). */
  subject?: string;
  /** Rendered body. */
  body: string;
  /** Set once delivered. */
  sentAt?: string;
  /** Which generator produced the copy, for transparency in the UI. */
  generatedBy: "template" | "llm";
}

/** Result returned by a channel adapter after attempting delivery. */
export interface DeliveryResult {
  ok: boolean;
  channel: Channel;
  to: string;
  detail: string;
}
