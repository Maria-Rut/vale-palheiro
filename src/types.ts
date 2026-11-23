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
 * The automated moments in the guest journey:
 *   - preferences: "Let's prepare your stay" invite, a few days before arrival
 *   - pre_stay:    welcome, shortly before arrival
 *   - post_stay:   thank-you, after departure
 */
export type MessageKind = "preferences" | "pre_stay" | "post_stay";

/** Roughly when the guest expects to arrive. */
export type ArrivalWindow = "early" | "afternoon" | "evening" | "late";
/** What we stock in the villa fridge before arrival. */
export type Drink = "still_water" | "sparkling_water" | "wine" | "sparkling_wine" | "beer" | "alcohol_free";
/** Sleeping set-up: as booked, split into separate beds, or one extra bed. */
export type Beds = "as_booked" | "separate" | "extra";
/** Portugal uses EU (type F) sockets; guests from elsewhere may need an adapter. */
export type Adapter = "none" | "uk" | "us" | "other";
export type Occasion = "none" | "birthday" | "anniversary" | "honeymoon" | "treat" | "other";
export type Dietary = "vegetarian" | "vegan" | "pescatarian" | "gluten_free" | "lactose_free";
/** Experiences from Vale Palheiro's own Experiences Menu (brochure v4). */
export type Experience =
  | "trail" | "picnic" | "jeep" | "horse" | "balloon" | "bikes"
  | "surf" | "boat" | "kayak"
  | "yoga" | "massage"
  | "wine_tasting" | "barn" | "private_dinner" | "cooking"
  | "workshop"
  | "transfer" | "babysitting";

/**
 * What the guest told us through the "prepare your stay" page. Every field has
 * a sensible default, so a guest who is happy with everything submits in one
 * tap — they only change what matters to them.
 */
export interface GuestPreferences {
  arrival: ArrivalWindow;
  /** Fireplace laid and ready to light on arrival. */
  fireplace: boolean;
  /** Drinks waiting in the fridge. Alcohol is confirmed (and priced) by staff. */
  drinks: Drink[];
  beds: Beds;
  adapter: Adapter;
  dietary: Dietary[];
  /**
   * Allergies are health data (GDPR special category). They are only stored
   * when the guest ticks the explicit consent box, and are deleted
   * automatically after check-out.
   */
  allergies?: string;
  allergyConsent: boolean;
  /** Set once allergies were deleted after the stay. */
  allergiesDeletedAt?: string;
  occasion: Occasion;
  occasionNote?: string;
  /** Experiences the guest would like the team to help arrange. */
  experiences: Experience[];
  note?: string;
  /** Guest opted in to having these remembered for future stays. */
  rememberForNextTime: boolean;
  submittedAt: string;
}

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
  /**
   * Unguessable token for the guest's personal "prepare your stay" link, so
   * they never need to log in or type their booking reference.
   */
  preferencesToken: string;
  /** Filled in once the guest answers the preferences page. */
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
