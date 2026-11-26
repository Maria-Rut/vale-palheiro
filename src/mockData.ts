import type { Guest, GuestPreferences, Reservation, ResortEvent } from "./types.ts";
import { RESORT_TZ, timeZoneFor, zonedParts, zonedTime } from "./timezone.ts";

/**
 * Fictional guests, reservations and events for the demo. Everything factual
 * about the resort is kept accurate to Vale Palheiro:
 *   - Accommodation: confirmed names (Casa Atlantica, Casa Lyra) plus generic
 *     room types (Suite, Casita, Villa) with a unit number.
 *   - Guests come from the resort's real main markets (UK, Germany, France,
 *     Switzerland, the Netherlands, Poland, Portugal) and so live in different
 *     time zones — which is exactly what the scheduler has to respect.
 *   - Events mirror what the resort really runs: Fado nights at the restaurant,
 *     guest-chef dinners, yoga / wellness sessions.
 * No real guest data is used — names, emails and phone numbers are fictional.
 *
 * Dates are relative to "now" so the demo always shows every stage of the
 * journey, whenever it is run.
 */

/** `days` from today (resort calendar), at hh:mm on the resort's clock. */
function day(days: number, hour: number, minute = 0): string {
  const p = zonedParts(new Date(), RESORT_TZ);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  return zonedTime(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), hour, minute, RESORT_TZ).toISOString();
}

function guest(g: Omit<Guest, "timeZone"> & { timeZone?: string }): Guest {
  return { ...g, timeZone: timeZoneFor(g.country, g.timeZone) };
}

export const guests: Record<string, Guest> = {
  charlotte: guest({
    id: "gst_001", firstName: "Charlotte", lastName: "Ellison",
    email: "charlotte.ellison@example.com", phone: "+447700900001",
    language: "en", country: "GB", city: "London", preferredChannels: ["email", "whatsapp"],
    marketingConsent: true,
  }),
  miguel: guest({
    id: "gst_002", firstName: "Miguel", lastName: "Santos",
    email: "miguel.santos@example.com", phone: "+351912000002",
    language: "pt", country: "PT", city: "Lisbon", preferredChannels: ["email", "whatsapp"],
    marketingConsent: true,
  }),
  sophie: guest({
    id: "gst_003", firstName: "Sophie", lastName: "Laurent",
    email: "sophie.laurent@example.com", phone: "+33612000003",
    language: "fr", country: "FR", city: "Lyon", preferredChannels: ["email"],
    marketingConsent: true,
  }),
  lukas: guest({
    id: "gst_004", firstName: "Lukas", lastName: "Weber",
    email: "lukas.weber@example.com", phone: "+491510000004",
    language: "en", country: "DE", city: "Munich", preferredChannels: ["email", "sms"],
    marketingConsent: false,
  }),
  ana: guest({
    id: "gst_005", firstName: "Ana", lastName: "Ferreira",
    email: "ana.ferreira@example.com", phone: "+351912000005",
    language: "pt", country: "PT", city: "Porto", preferredChannels: ["email"],
    marketingConsent: true,
  }),
  emma: guest({
    id: "gst_006", firstName: "Emma", lastName: "de Vries",
    email: "emma.devries@example.com", phone: "+31612000006",
    language: "en", country: "NL", city: "Amsterdam", preferredChannels: ["email"],
    marketingConsent: true,
  }),
  jean: guest({
    id: "gst_007", firstName: "Jean", lastName: "Dubois",
    email: "jean.dubois@example.com", phone: "+41790000007",
    language: "fr", country: "CH", city: "Geneva", preferredChannels: ["email"],
    marketingConsent: true,
  }),
  hanna: guest({
    id: "gst_008", firstName: "Hanna", lastName: "Kowalska",
    email: "hanna.kowalska@example.com", phone: "+48500000008",
    language: "en", country: "PL", city: "Kraków", preferredChannels: ["email"],
    marketingConsent: true,
  }),
  oliver: guest({
    id: "gst_009", firstName: "Oliver", lastName: "Grant",
    email: "oliver.grant@example.com", phone: "+447700900009",
    language: "en", country: "GB", city: "Edinburgh", preferredChannels: ["email"],
    marketingConsent: false,
  }),
};

const base = {
  ratePlan: "Flexible Rate",
  breakfastIncluded: true,
  motive: "leisure" as const,
  children: 0,
  source: "Direct (website)",
};

export const reservations: Reservation[] = [
  // ---- upcoming & current stays -------------------------------------------
  {
    ...base,
    id: "res_001", reference: "VP-7F3A", guest: guests.charlotte,
    accommodation: "Casa Atlantica",
    // Arrives in 3 days, late in the evening (after reception closes).
    checkIn: day(3, 21, 30), checkOut: day(8, 11),
    adults: 2, children: 3,
    ratePlan: "Early Booking Rate", source: "Booking.com",
    notes: "Travelling with three children on a late flight. Asked for a cot.",
  },
  {
    ...base,
    id: "res_002", reference: "VP-2B9C", guest: guests.miguel,
    accommodation: "Casa Lyra",
    // Returning guest arriving this afternoon.
    checkIn: day(0, 16), checkOut: day(4, 11),
    adults: 2, motive: "both",
    notes: "Second stay with us. Loved the spa last time.",
  },
  {
    ...base,
    id: "res_003", reference: "VP-5K1D", guest: guests.sophie,
    accommodation: "Suite", unit: "4",
    checkIn: day(5, 16), checkOut: day(8, 11),
    adults: 2, occasion: "anniversary",
    ratePlan: "Early Booking Rate",
    notes: "10th wedding anniversary. Planning to walk the Rota Vicentina.",
  },
  {
    ...base,
    id: "res_004", reference: "VP-9Q4E", guest: guests.lukas,
    accommodation: "Casita", unit: "2",
    // Checked in yesterday — in-stay info message already went out.
    checkIn: day(-1, 16), checkOut: day(3, 11),
    adults: 1, motive: "business",
    ratePlan: "Non-refundable Rate", breakfastIncluded: false,
    source: "Expedia",
    notes: "Working remotely — asked about Wi-Fi.",
  },
  // ---- just left ----------------------------------------------------------
  {
    ...base,
    id: "res_005", reference: "VP-3T8F", guest: guests.ana,
    accommodation: "Villa", unit: "7",
    checkIn: day(-5, 16), checkOut: day(-2, 11),
    adults: 4,
    notes: "Group of friends. Enjoyed dinner at The Barn.",
  },
  {
    ...base,
    id: "res_006", reference: "VP-6M2H", guest: guests.emma,
    accommodation: "Suite", unit: "1",
    checkIn: day(-3, 16), checkOut: day(0, 11),
    adults: 2, occasion: "birthday",
    source: "Booking.com",
  },
  // ---- past stays (history — drives "welcome back" and event invites) ------
  {
    ...base,
    id: "res_h01", reference: "VP-1A0M", guest: guests.miguel,
    accommodation: "Casa Lyra",
    checkIn: day(-240, 16), checkOut: day(-236, 11),
    adults: 2,
  },
  {
    ...base,
    id: "res_h02", reference: "VP-4C7R", guest: guests.jean,
    accommodation: "Casita", unit: "3",
    checkIn: day(-95, 16), checkOut: day(-91, 11),
    adults: 2,
  },
  {
    ...base,
    id: "res_h03", reference: "VP-8D2S", guest: guests.hanna,
    accommodation: "Suite", unit: "2",
    checkIn: day(-150, 16), checkOut: day(-143, 11),
    adults: 1, motive: "both",
    notes: "Stayed a week, working remotely.",
  },
  {
    ...base,
    id: "res_h04", reference: "VP-2E9T", guest: guests.oliver,
    accommodation: "Villa", unit: "5",
    checkIn: day(-60, 16), checkOut: day(-56, 11),
    adults: 3,
  },
];

/** Event calendar. Times are on the resort's clock (Europe/Lisbon). */
export const events: ResortEvent[] = [
  {
    id: "evt_001",
    title: {
      en: "Fado night at The Barn",
      pt: "Noite de Fado no The Barn",
      fr: "Soirée Fado à The Barn",
    },
    description: {
      en: "An evening of traditional Portuguese music over dinner.",
      pt: "Uma noite de música tradicional portuguesa ao jantar.",
      fr: "Une soirée de musique traditionnelle portugaise autour du dîner.",
    },
    start: day(2, 20, 30),
    place: "The Barn",
    audience: "in_house",
    inviteLeadDays: 0,
  },
  {
    id: "evt_002",
    title: {
      en: "Sunrise yoga in the valley",
      pt: "Yoga ao nascer do sol no vale",
      fr: "Yoga au lever du soleil dans la vallée",
    },
    description: {
      en: "A gentle morning session outdoors. All levels welcome.",
      pt: "Uma sessão suave ao ar livre. Para todos os níveis.",
      fr: "Une séance douce en plein air. Tous niveaux bienvenus.",
    },
    start: day(1, 8),
    place: "The valley",
    audience: "in_house",
    inviteLeadDays: 0,
  },
  {
    id: "evt_003",
    title: {
      en: "Guest chef dinner",
      pt: "Jantar com chef convidado",
      fr: "Dîner avec un chef invité",
    },
    description: {
      en: "One night only: a guest chef cooks with produce from our garden and local farms.",
      pt: "Uma só noite: um chef convidado cozinha com produtos da nossa horta e de produtores locais.",
      fr: "Un seul soir : un chef invité cuisine les produits de notre potager et des fermes voisines.",
    },
    start: day(16, 20),
    place: "The Barn",
    audience: "everyone",
    inviteLeadDays: 12,
  },
  {
    id: "evt_004",
    title: {
      en: "A Fado weekend",
      pt: "Um fim de semana de Fado",
      fr: "Un week-end Fado",
    },
    description: {
      en: "Two evenings of Fado, with a long Sunday lunch in between.",
      pt: "Duas noites de Fado, com um longo almoço de domingo pelo meio.",
      fr: "Deux soirées de Fado, avec un long déjeuner du dimanche entre les deux.",
    },
    start: day(42, 20, 30),
    place: "The Barn",
    audience: "everyone",
    inviteLeadDays: 21,
  },
];

/**
 * Answers already given on the "prepare your stay" page, keyed by reservation
 * id. Sophie (anniversary, arriving in 5 days) filled hers in early, so the
 * demo shows a prep sheet, the team tasks it raises, and how the arrival-day
 * email reflects her choices.
 */
export const preferenceSeeds: Record<string, GuestPreferences> = {
  res_003: {
    arrivalTime: "21:30",
    earlyCheckIn: false,
    fireplace: true,
    minibarExtras: ["Sparkling wine"],
    minibarRequest: "A few strawberries if possible",
    beds: "as_booked",
    adapter: "none",
    dietary: ["vegetarian"],
    allergies: "Tree nuts (walnuts, almonds)",
    allergyConsent: true,
    occasion: "anniversary",
    occasionNote: "Our 10th wedding anniversary",
    experiences: ["trail", "massage", "barn"],
    note: "We'd love a table by the window at The Barn on our first night.",
    rememberForNextTime: true,
    submittedAt: day(-1, 18),
  },
};
