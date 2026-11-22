import type { Reservation } from "./types.ts";

/**
 * Fictional reservations for the demo. Villa names and the surrounding detail
 * are drawn from Vale Palheiro's real offering (13 villas, suites and casitas;
 * Casa Atlantica is their five-bedroom family villa) so the messages feel true
 * to the place. No real guest data is used.
 *
 * Dates are generated relative to "now" so the demo always has a reservation
 * arriving soon (good for the pre-stay demo) and one that just checked out
 * (good for the post-stay demo), regardless of when it is run.
 */

function iso(offsetHours: number): string {
  return new Date(Date.now() + offsetHours * 60 * 60 * 1000).toISOString();
}

const DAY = 24;

export const reservations: Reservation[] = [
  {
    id: "res_001",
    reference: "VP-7F3A",
    villa: "Casa Atlantica",
    // Arrives in ~3h, so the pre-stay message (2h before) is imminent.
    checkIn: iso(3),
    checkOut: iso(3 + 5 * DAY),
    partySize: 6,
    purpose: "family",
    notes: "Two young children. Requested a cot and late dinner at The Barn.",
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
    villa: "Casita Oliveira",
    // Checked out ~20h ago, so the post-stay message (1 day after) is due.
    checkIn: iso(-6 * DAY),
    checkOut: iso(-20),
    partySize: 2,
    purpose: "couple",
    notes: "Celebrating a 10th wedding anniversary.",
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
    villa: "Suite Cistus",
    // Arrives in ~30h — upcoming, pre-stay still scheduled for later.
    checkIn: iso(30),
    checkOut: iso(30 + 3 * DAY),
    partySize: 2,
    purpose: "hiking",
    notes: "Walking the Rota Vicentina. Early breakfast requested.",
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
    villa: "Casita Medronho",
    // Arrives in ~1h — pre-stay window already passed, good to show "sent".
    checkIn: iso(1),
    checkOut: iso(1 + 2 * DAY),
    partySize: 1,
    purpose: "solo",
    notes: "Writer on a quiet retreat. Prefers minimal contact.",
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
    villa: "Villa Figueira",
    // Checked out ~2 days ago.
    checkIn: iso(-5 * DAY),
    checkOut: iso(-2 * DAY),
    partySize: 4,
    purpose: "friends",
    notes: "Group of old university friends. Loved the wine cellar.",
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
