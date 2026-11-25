/**
 * Core domain types for the Vale Palheiro guest messaging concierge.
 *
 * These describe guests, reservations, the resort's event calendar and the
 * messages the system schedules. They are shaped so the prototype can later map onto
 * Vale Palheiro's real systems — Host (the PMS, which the team treats as the
 * single source of truth) and the events calendar — without reshaping the rest
 * of the app. See `sources.ts` for the connector seams.
 */

/** Languages the resort serves (site is published in EN / PT / FR). */
export type Language = "en" | "pt" | "fr";

/** Delivery channels a guest can be reached on. */
export type Channel = "email" | "sms" | "whatsapp";

/**
 * Motive of stay — Vale Palheiro's actual booking-form field
 * ("Business" / "Leisure" / "A little of both").
 */
export type Motive = "business" | "leisure" | "both";

/** A celebration the front office noted for the stay. */
export type Occasion = "birthday" | "anniversary" | "honeymoon" | "celebration";

/**
 * The moments in the guest journey the system writes for.
 *   pre_arrival  — 3 days before: "your villa is being prepared, we can't wait"
 *   arrival_day  — 3 hours before: where to go, where we'll meet you, your villa
 *   in_stay      — after check-in: Wi-Fi, contacts, activities, events this stay
 *   post_stay    — after check-out: thank you + a quick review
 *   event_invite — to opted-in past guests, about an upcoming resort event
 */
export type MessageKind =
  | "pre_arrival"
  | "arrival_day"
  | "in_stay"
  | "post_stay"
  | "event_invite";

/**
 * Lifecycle of a scheduled message.
 *   scheduled — will send at sendAt
 *   held      — waiting for a staff member to approve (personal moments)
 *   sent      — delivered
 *   cancelled — staff chose not to send
 *   skipped   — its moment passed before it could go (e.g. a last-minute
 *               booking), so the system deliberately didn't send a stale message
 */
export type MessageStatus = "scheduled" | "held" | "sent" | "cancelled" | "skipped";

export interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string; // E.164, used for SMS + WhatsApp
  language: Language;
  /** ISO 3166 country code from the booking (e.g. "DE"). */
  country: string;
  /** Home town, if the booking has it — used for a warmer welcome. */
  city?: string;
  /** IANA time zone of where the guest lives, e.g. "Europe/Berlin". */
  timeZone: string;
  /** Channels this guest has opted into, in order of preference. */
  preferredChannels: Channel[];
  /**
   * Whether the guest agreed to hear about events and news after their stay.
   * Without it the system never sends them event invites — only stay messages.
   */
  marketingConsent: boolean;
}

export interface Reservation {
  id: string;
  /** Human-friendly booking reference shown to staff. */
  reference: string;
  guest: Guest;
  /** Accommodation booked, e.g. "Casa Lyra" or "Suite". */
  accommodation: string;
  /** Unit / room number allocated in Host. Optional until allocated. */
  unit?: string;
  /** ISO datetime of expected arrival (check-in). */
  checkIn: string;
  /** ISO datetime of departure (check-out). */
  checkOut: string;
  adults: number;
  children: number;
  motive: Motive;
  ratePlan: string;
  breakfastIncluded: boolean;
  /** A celebration the team should know about. */
  occasion?: Occasion;
  /** Booking channel, for context only (direct, Booking.com, Expedia…). */
  source: string;
  /** Optional free-text the staff noted. */
  notes?: string;
  /** Cancelled bookings are kept for history but never messaged. */
  cancelled?: boolean;
}

/** An event in Vale Palheiro's calendar (Fado night, guest chef, yoga…). */
export interface ResortEvent {
  id: string;
  /** Title per language. */
  title: Record<Language, string>;
  /** One or two sentences per language. */
  description: Record<Language, string>;
  /** ISO datetime the event starts. */
  start: string;
  /** Where on the property, e.g. "The Barn". */
  place: string;
  /**
   * Who should hear about it:
   *   in_house — only guests staying at the time (mentioned in their messages)
   *   everyone — also invite opted-in past guests
   */
  audience: "in_house" | "everyone";
  /** Days before the event to send past-guest invites. */
  inviteLeadDays: number;
}

/** Something the team should do by hand — the system prompts, people deliver. */
export interface StaffTask {
  id: string;
  reservationId: string;
  kind: "welcome_back_package" | "occasion" | "late_arrival" | "guest_request";
  /** When it should be done by (ISO). */
  dueBy: string;
  text: string;
  done: boolean;
}

/**
 * A single message the scheduler has planned or sent, for one guest, one
 * moment and one channel.
 */
export interface ScheduledMessage {
  id: string;
  /** Reservation the message belongs to (for event invites: the guest's latest stay). */
  reservationId: string;
  guestId: string;
  kind: MessageKind;
  /** For event invites: which event. */
  eventId?: string;
  channel: Channel;
  language: Language;
  /** ISO datetime the message should go out. */
  sendAt: string;
  /** The time zone sendAt was chosen in, and the guest-local time it lands at. */
  timeZone: string;
  localSendTime: string;
  /** Why the send time moved, if it did (quiet hours etc.). */
  timingNote?: string;
  /** After this moment the message is stale and is skipped instead of sent. */
  expiresAt: string;
  status: MessageStatus;
  /** Why it is held / skipped, shown to staff. */
  statusNote?: string;
  subject?: string;
  body: string;
  /** English copy for staff, when the guest's language isn't English. */
  english?: { subject?: string; body: string };
  /** For the welcome email: what the recommendation agent picked and why. */
  suggestions?: { date: string; activity: string; reason: string }[];
  /** Staff edited the wording — never overwrite it on re-plan. */
  edited?: boolean;
  sentAt?: string;
  generatedBy: "template" | "llm";
}

/** Result returned by a channel adapter after attempting delivery. */
export interface DeliveryResult {
  ok: boolean;
  channel: Channel;
  to: string;
  detail: string;
}

// ---------------------------------------------------------------- preferences

/** Roughly when the guest expects to arrive. */
export type ArrivalWindow = "early" | "afternoon" | "evening" | "late";
/** What we stock in the villa fridge before arrival. */
export type Drink = "still_water" | "sparkling_water" | "wine" | "sparkling_wine" | "beer" | "alcohol_free";
/** Sleeping set-up: as booked, split into separate beds, or one extra bed. */
export type Beds = "as_booked" | "separate" | "extra";
/** Portugal uses EU (type F) sockets; guests from elsewhere may need an adapter. */
export type Adapter = "none" | "uk" | "us" | "other";
/** What the guest says they're celebrating ("treat" = "Do we need a reason?"). */
export type GuestOccasion = "none" | "birthday" | "anniversary" | "honeymoon" | "treat" | "other";
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
 * What the guest told us through their "prepare your stay" page (linked from
 * the 3-days-before email). Every field has a default, so a guest who is happy
 * with everything submits in one tap — they only change what matters to them.
 */
export interface GuestPreferences {
  arrival: ArrivalWindow;
  /** Fireplace laid and ready to light on arrival. */
  fireplace: boolean;
  /** Drinks waiting in the fridge. Anything beyond water is confirmed (and priced) by staff. */
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
  occasion: GuestOccasion;
  occasionNote?: string;
  /** Experiences the guest would like the team to help arrange. */
  experiences: Experience[];
  note?: string;
  /** Guest opted in to having these remembered for future stays. */
  rememberForNextTime: boolean;
  submittedAt: string;
}
