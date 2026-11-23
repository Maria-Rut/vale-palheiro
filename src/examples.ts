import type { Language, Reservation } from "./types.ts";
import { RESORT_TZ, timeZoneFor, zonedParts, zonedTime } from "./timezone.ts";

/**
 * Example guests for the Emails tab: made-up people from different places and
 * with different stays, so staff can see how one template reads for each of
 * them. They all stay the same week, so the weather-based suggestions share
 * the same forecast and only the personal parts change.
 * They are never scheduled or sent.
 */

function day(days: number, hour: number): string {
  const p = zonedParts(new Date(), RESORT_TZ);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  return zonedTime(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), hour, 0, RESORT_TZ).toISOString();
}

export interface Example {
  reservation: Reservation;
  returning: boolean;
  /** One line for staff: who they are and what's different about them. */
  about: string;
}

function ex(
  id: string, first: string, last: string, city: string, country: string, language: Language,
  stay: Partial<Reservation> & Pick<Reservation, "accommodation" | "adults" | "children" | "motive">,
  about: string, returning = false,
): Example {
  return {
    returning, about,
    reservation: {
      id: `example_${id}`, reference: `EX-${id.toUpperCase()}`,
      guest: {
        id: `example_guest_${id}`, firstName: first, lastName: last,
        email: `${first.toLowerCase()}@example.com`, phone: "+000000000",
        language, country, city, timeZone: timeZoneFor(country),
        preferredChannels: ["email"], marketingConsent: true,
      },
      checkIn: day(3, 16), checkOut: day(7, 11),
      ratePlan: "Flexible", breakfastIncluded: true, source: "Direct",
      ...stay,
    },
  };
}

export function exampleGuests(): Example[] {
  return [
    ex("emma", "Emma", "de Vries", "Amsterdam", "NL", "en",
      { accommodation: "Casa Lyra", adults: 2, children: 0, motive: "leisure" },
      "Couple from Amsterdam, first stay"),
    ex("olivia", "Olivia", "Hughes", "Bristol", "GB", "en",
      { accommodation: "Villa", unit: "3", adults: 2, children: 2, motive: "leisure" },
      "Family of four from Bristol, coming back for a second stay", true),
    ex("camille", "Camille", "Moreau", "Lyon", "FR", "fr",
      { accommodation: "Suite", unit: "2", adults: 2, children: 0, motive: "leisure", occasion: "anniversary" },
      "Couple from Lyon celebrating their anniversary (speaks French)"),
    ex("rafael", "Rafael", "Costa", "São Paulo", "BR", "pt",
      { accommodation: "Casita", unit: "1", adults: 1, children: 0, motive: "business", breakfastIncluded: false },
      "Travelling alone from São Paulo for work, no breakfast booked (speaks Portuguese)"),
    ex("jonas", "Jonas", "Keller", "Zurich", "CH", "en",
      { accommodation: "Casa Atlantica", adults: 3, children: 0, motive: "both", occasion: "birthday" },
      "Three friends from Zurich, one of them has a birthday"),
  ];
}
