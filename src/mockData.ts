import type { Reservation } from "./types.ts";

/**
 * Fictional reservations for the demo. Everything factual is kept accurate to
 * Vale Palheiro:
 *   - Accommodation: only confirmed real names (Casa Atlantica, Casa Lyra,
 *     Villa Terracotta, Casa da Taipa — all listed on valepalheiro.com) plus
 *     generic room *types* (Suite, Casita) for the rest. No invented names.
 *   - preferencesToken values are fixed so demo links keep working after a
 *     restart; real bookings would get one from newPreferencesToken().
 *   - Rate plans and fields mirror the real booking flow (Early Booking Rate,
 *     Non-refundable, breakfast included, motive of stay, EUR, +351).
 * No real guest data is used — names, emails and phone numbers are fictional.
 *
 * Dates are generated relative to "now" so the demo always has a reservation
 * arriving soon (for the pre-stay demo) and one that just checked out (for the
 * post-stay demo), regardless of when it is run.
 */

function iso(offsetHours: number): string {
  return new Date(Date.now() + offsetHours * 60 * 60 * 1000).toISOString();
}

const DAY = 24;

export const reservations: Reservation[] = [
  {
    id: "res_001",
    preferencesToken: "k3VtQ8rN2xLpA7cW",
    reference: "VP-7F3A",
    accommodation: "Casa Atlantica",
    // Arrives in ~3h, so the pre-stay message (2h before) is imminent.
    checkIn: iso(3),
    checkOut: iso(3 + 5 * DAY),
    partySize: 6,
    motive: "leisure",
    ratePlan: "Early Booking Rate",
    breakfastIncluded: true,
    notes: "Travelling with children. Requested a cot and a late dinner at The Barn.",
    guest: {
      id: "gst_001",
      firstName: "Charlotte",
      lastName: "Ellison",
      email: "charlotte.ellison@example.com",
      phone: "+447700900001",
      language: "en",
      preferredChannels: ["email", "whatsapp"],
    },
  },
  {
    id: "res_002",
    preferencesToken: "Zp4mR9sT1vYqB6dE",
    reference: "VP-2B9C",
    accommodation: "Casa Lyra",
    // Checked out ~20h ago, so the post-stay message (1 day after) is due.
    checkIn: iso(-6 * DAY),
    checkOut: iso(-20),
    partySize: 2,
    motive: "both",
    ratePlan: "Flexible Rate",
    breakfastIncluded: true,
    notes: "Returning guests. Enjoyed the spa.",
    guest: {
      id: "gst_002",
      firstName: "Miguel",
      lastName: "Santos",
      email: "miguel.santos@example.com",
      phone: "+351912000002",
      language: "pt",
      preferredChannels: ["whatsapp", "email"],
    },
  },
  {
    id: "res_003",
    preferencesToken: "Hn8wF2jK5uXcM3gR",
    reference: "VP-5K1D",
    accommodation: "Suite",
    // Arrives in ~30h — upcoming, pre-stay still scheduled for later.
    checkIn: iso(30),
    checkOut: iso(30 + 3 * DAY),
    partySize: 2,
    motive: "leisure",
    ratePlan: "Early Booking Rate",
    breakfastIncluded: true,
    notes: "Planning to walk the Rota Vicentina. Early breakfast requested.",
    // Already answered the "prepare your stay" page — shows the prep sheet and
    // how the welcome message reflects her choices.
    preferences: {
      arrival: "evening",
      fireplace: true,
      drinks: ["sparkling_water", "sparkling_wine"],
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
      submittedAt: iso(-2 * DAY),
    },
    guest: {
      id: "gst_003",
      firstName: "Sophie",
      lastName: "Laurent",
      email: "sophie.laurent@example.com",
      phone: "+33612000003",
      language: "fr",
      preferredChannels: ["email"],
    },
  },
  {
    id: "res_004",
    preferencesToken: "Qe7tL1yV4bNzS9hP",
    reference: "VP-9Q4E",
    accommodation: "Casita",
    // Arrives in ~1h — pre-stay window already passed, good to show "sent".
    checkIn: iso(1),
    checkOut: iso(1 + 2 * DAY),
    partySize: 1,
    motive: "business",
    ratePlan: "Non-refundable Rate",
    breakfastIncluded: false,
    notes: "Here to work for a few days. Prefers minimal contact.",
    guest: {
      id: "gst_004",
      firstName: "James",
      lastName: "Okafor",
      email: "james.okafor@example.com",
      phone: "+447700900004",
      language: "en",
      preferredChannels: ["sms"],
    },
  },
  {
    id: "res_005",
    preferencesToken: "Wr2kD6pJ8aGfT5mC",
    reference: "VP-3T8F",
    accommodation: "Villa",
    // Checked out ~2 days ago.
    checkIn: iso(-5 * DAY),
    checkOut: iso(-2 * DAY),
    partySize: 4,
    motive: "leisure",
    ratePlan: "Flexible Rate",
    breakfastIncluded: true,
    notes: "Group travelling together. Enjoyed dinner at The Barn.",
    guest: {
      id: "gst_005",
      firstName: "Ana",
      lastName: "Ferreira",
      email: "ana.ferreira@example.com",
      phone: "+351912000005",
      language: "pt",
      preferredChannels: ["whatsapp"],
    },
  },
  {
    id: "res_006",
    preferencesToken: "Bv5nX3qW7eKsJ1tY",
    reference: "VP-6M2G",
    accommodation: "Villa Terracotta",
    // Arrives in ~5 days — inside the 7-day window, so the "prepare your
    // stay" invite goes out straight away and is waiting for an answer.
    checkIn: iso(5 * DAY),
    checkOut: iso(5 * DAY + 4 * DAY),
    partySize: 4,
    motive: "leisure",
    ratePlan: "Flexible Rate",
    breakfastIncluded: true,
    guest: {
      id: "gst_006",
      firstName: "Hannah",
      lastName: "Becker",
      email: "hannah.becker@example.com",
      phone: "+4915100000006",
      language: "en",
      preferredChannels: ["email"],
    },
  },
  {
    id: "res_007",
    preferencesToken: "Jc9pL4zR6wHmU2xN",
    reference: "VP-8R5H",
    accommodation: "Casa da Taipa",
    // Arrives in ~9 days — the invite is scheduled for 7 days before arrival.
    checkIn: iso(9 * DAY),
    checkOut: iso(9 * DAY + 3 * DAY),
    partySize: 2,
    motive: "both",
    ratePlan: "Early Booking Rate",
    breakfastIncluded: true,
    guest: {
      id: "gst_007",
      firstName: "Inês",
      lastName: "Moura",
      email: "ines.moura@example.com",
      phone: "+351912000007",
      language: "pt",
      preferredChannels: ["email", "whatsapp"],
    },
  },
];
