import type { Reservation } from "./types.ts";

/**
 * Fictional reservations for the demo. Everything factual is kept accurate to
 * Vale Palheiro:
 *   - Accommodation: only confirmed real names (Casa Atlantica — the 5-bedroom
 *     villa; Casa Lyra — the two-bedroom villa) plus generic room *types*
 *     (Suite, Casita) for the rest. No invented proper names.
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
    preferences: {
      estimatedArrival: iso(3),
      dietary: "One child is dairy-free.",
      occasion: "Family summer holiday",
      interests: ["land_trails", "food_wine", "crafts"],
      pace: "balanced",
      arrangements: ["Cot", "Restaurant booking at The Barn", "Babysitting one evening"],
      notes: "Would love something the children can join in with.",
      submittedAt: iso(-5 * DAY),
    },
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
    preferences: {
      estimatedArrival: iso(30),
      dietary: "Vegetarian.",
      occasion: "Walking holiday",
      interests: ["land_trails", "sea_coast", "wellbeing"],
      pace: "active",
      arrangements: ["Early breakfast", "Packed picnic for the trail"],
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
];
