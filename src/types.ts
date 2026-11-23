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

/**
 * The automated moments in the guest journey, in order:
 *   - preferences : earliest — asks the guest to fill the questionnaire so the
 *                   team has time to prepare.
 *   - pre_stay    : the welcome message, shortly before arrival.
 *   - experiences : shortly after check-in — suggests activities that suit the
 *                   day's weather (and the guest's stated interests).
 *   - post_stay   : after checkout — thanks and an invitation to share feedback.
 */
export type MessageKind = "preferences" | "pre_stay" | "experiences" | "post_stay";

/** Weather used to tailor the experiences message. */
export type WeatherKind = "sunny" | "cloudy" | "rainy" | "windy";

/** Interests a guest can tick in the pre-arrival questionnaire. */
export type Interest =
  | "land_trails"
  | "sea_coast"
  | "wellbeing"
  | "food_wine"
  | "crafts";

/**
 * Preferences a guest submits via the questionnaire link in the first email.
 * Everything is optional — guests share only what they wish. These feed the
 * CRM and personalise later messages.
 */
export interface GuestPreferences {
  /** ISO datetime the guest expects to arrive, if given. */
  estimatedArrival?: string;
  /** Dietary needs / allergies, free text. */
  dietary?: string;
  /** Occasion, e.g. "anniversary", "birthday", "honeymoon", "just relaxing". */
  occasion?: string;
  /** What they'd like to do — maps to experiences. */
  interests: Interest[];
  /** Preferred pace of stay. */
  pace?: "active" | "balanced" | "restful";
  /** Things to arrange before arrival (cot, transfer, restaurant, babysitting…). */
  arrangements: string[];
  /** Anything else, free text. */
  notes?: string;
  /** When the guest submitted the questionnaire. */
  submittedAt: string;
}

/**
 * Lifecycle of a scheduled message.
 *   - needs_approval : held because it's "uncertain" (e.g. weather-based, or a
 *                      staff member edited it). Terra will NOT send it until a
 *                      staff member approves it.
 *   - scheduled      : approved / auto-approved; will send at its send time.
 *   - sent           : delivered.
 *   - cancelled      : staff chose not to send it.
 */
export type MessageStatus = "needs_approval" | "scheduled" | "sent" | "cancelled";

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
  /** Preferences submitted via the questionnaire, once the guest responds. */
  preferences?: GuestPreferences;
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
