/**
 * Resort settings: the practical information that goes into guest messages and
 * the guest page — contacts, front-office hours, check-in rules, directions,
 * restaurant and bar, Wi-Fi, the brochure, the minibar, wellness, review links.
 * Updated in one place, used everywhere.
 *
 * Staff edit all of this from the dashboard ("Resort settings" tab). Values that
 * have not been confirmed by the team are flagged `sample: true` and shown with
 * a warning, so nothing invented can reach a real guest unnoticed.
 *
 * Facts already confirmed by Vale Palheiro (interviews / site) are marked
 * `sample: false`: reception closes at 20:00, guests are welcomed at Casa da
 * Ribeira, the restaurant is The Barn, the resort is near Aljezur.
 */

export interface PropertyField {
  label: string;
  value: string;
  /** true until a staff member confirms or replaces the value. */
  sample: boolean;
  /** Optional help text for staff. */
  help?: string;
  /** Section in the Resort settings tab. */
  group: SettingsGroup;
  /** Shown as a text area. */
  long?: boolean;
}

export type SettingsGroup = "contact" | "arrival" | "dining" | "stay" | "menus" | "reviews";
export const GROUP_LABEL: Record<SettingsGroup, string> = {
  contact: "Contact details",
  arrival: "Arrival, access & check-in",
  dining: "Restaurant & bar",
  stay: "During the stay",
  menus: "Brochure, minibar & wellness",
  reviews: "Reviews",
};

export type PropertyKey =
  | "receptionPhone" | "email" | "address" | "whatsappNumber" | "emergencyPhone"
  | "receptionHours" | "receptionClose" | "checkInTime" | "earlyCheckIn" | "lateArrivalFee"
  | "meetingPoint" | "mapsLink" | "directions" | "directionsPt" | "directionsFr"
  | "restaurantIntro" | "restaurantIntroPt" | "restaurantIntroFr"
  | "breakfastHours" | "restaurantHours" | "barHours"
  | "wifiNetwork" | "wifiPassword" | "checkOutTime"
  | "brochureLink" | "wellnessInfo" | "wellnessMenuLink"
  | "minibarStandard" | "minibarExtras" | "villasWithoutMinibar"
  | "tripadvisorLink" | "reviewLink";

export type PropertyInfo = Record<PropertyKey, PropertyField>;

/**
 * Starting values. Anything Vale Palheiro has not confirmed yet is `sample`,
 * so the dashboard counts it and nothing invented reaches a guest unnoticed.
 */
const initial: PropertyInfo = {
  // ---- contact
  receptionPhone: { group: "contact", label: "Reception phone", value: "+351 933 979 043", sample: false, help: "From the Experiences Menu." },
  email: { group: "contact", label: "Guest email", value: "info@valepalheiro.com", sample: false },
  address: { group: "contact", label: "Address", value: "Rua Vale Palheiro, 8670-016 Aljezur", sample: false },
  whatsappNumber: { group: "contact", label: "WhatsApp (front office)", value: "+351 933 979 043", sample: true, help: "The number guests can write to on WhatsApp." },
  emergencyPhone: { group: "contact", label: "Out-of-hours number", value: "+351 910 000 001", sample: true, help: "Who guests call after reception closes." },

  // ---- arrival & check-in
  receptionHours: { group: "arrival", label: "Front office hours", value: "08:00–20:00", sample: false },
  receptionClose: { group: "arrival", label: "Front office closes at", value: "20:00", sample: false, help: "Arrivals after this time create a late check-in task for the team." },
  checkInTime: { group: "arrival", label: "Standard check-in from", value: "15:00", sample: true, help: "To confirm with management: 14:00 or 15:00." },
  earlyCheckIn: { group: "arrival", label: "Early check-in", value: "Subject to availability", sample: true, help: "Shown to guests who ask for early check-in." },
  lateArrivalFee: { group: "arrival", label: "Late-arrival fee (after the front office closes)", value: "€30", sample: true, help: "Approximate — to confirm with management. Leave empty for no fee." },
  meetingPoint: { group: "arrival", label: "Where we welcome guests", value: "Casa da Ribeira", sample: false, help: "The welcome lounge where stays begin." },
  mapsLink: { group: "arrival", label: "Google Maps link", value: "https://maps.google.com/?q=Rua+Vale+Palheiro+8670-016+Aljezur", sample: true },
  directions: {
    group: "arrival", long: true, label: "Directions & access road (English)", sample: true,
    value: "From Aljezur, take the road towards the valley. There are few signs in the village, so follow the map link rather than the signposts. The last stretch is an unpaved road — drive slowly; any car can make it.",
    help: "Which road to take, where the signs are missing, what the last stretch is like.",
  },
  directionsPt: {
    group: "arrival", long: true, label: "Directions & access road (Portuguese)", sample: true,
    value: "A partir de Aljezur, siga a estrada em direção ao vale. Há poucas placas na vila, por isso siga o link do mapa em vez das indicações. O último troço é em terra batida — conduza devagar; qualquer carro passa.",
  },
  directionsFr: {
    group: "arrival", long: true, label: "Directions & access road (French)", sample: true,
    value: "Depuis Aljezur, prenez la route vers la vallée. Il y a peu de panneaux dans le village : suivez plutôt le lien du plan. Le dernier tronçon est une piste non goudronnée — roulez doucement, toute voiture passe.",
  },

  // ---- restaurant & bar
  restaurantIntro: {
    group: "dining", long: true, label: "Restaurant introduction (English)", sample: true,
    value: "The Barn is our restaurant: seasonal cooking with produce from the region and our own garden. Booking a table ahead is a good idea.",
  },
  restaurantIntroPt: {
    group: "dining", long: true, label: "Restaurant introduction (Portuguese)", sample: true,
    value: "O The Barn é o nosso restaurante: cozinha da estação com produtos da região e da nossa horta. Vale a pena reservar mesa com antecedência.",
  },
  restaurantIntroFr: {
    group: "dining", long: true, label: "Restaurant introduction (French)", sample: true,
    value: "The Barn est notre restaurant : une cuisine de saison avec les produits de la région et de notre potager. Mieux vaut réserver une table à l'avance.",
  },
  breakfastHours: { group: "dining", label: "Breakfast hours", value: "08:00–10:30", sample: true },
  restaurantHours: { group: "dining", label: "The Barn — dinner hours", value: "19:30–22:00", sample: true },
  barHours: { group: "dining", label: "Bar hours", value: "", sample: true, help: "Leave empty and the bar line is left out of emails." },

  // ---- during the stay
  wifiNetwork: { group: "stay", label: "Wi-Fi network", value: "ValePalheiro", sample: true },
  wifiPassword: { group: "stay", label: "Wi-Fi password", value: "terra-guest", sample: true },
  checkOutTime: { group: "stay", label: "Check-out time", value: "11:00", sample: true },

  // ---- brochure, minibar, wellness
  brochureLink: { group: "menus", label: "Experiences brochure (link or file)", value: "/brochure.pdf", sample: false, help: "The Experiences Menu (v4). Replace with a new PDF link when it changes." },
  wellnessInfo: { group: "menus", label: "Wellness (one line)", value: "Massages in your villa, yoga, Pilates and barre", sample: true, help: "Shown in the welcome message. From the Experiences Menu." },
  wellnessMenuLink: { group: "menus", label: "Wellness menu link", value: "/brochure.pdf#page=11", sample: true, help: "For now: the Body, movement & wellbeing pages of the Experiences Menu (p. 11–13). Replace with the wellness menu when it exists." },
  minibarStandard: { group: "menus", label: "Standard minibar (already in the villa)", value: "Still water, sparkling water, Coca-Cola, Fanta", sample: true, help: "Comma-separated. Shown to guests as information — not something they need to ask for." },
  minibarExtras: { group: "menus", label: "Extras guests can ask for", value: "A bottle of regional wine, Sparkling wine, Local craft beer, Alcohol-free drinks, Fresh fruit", sample: true, help: "Comma-separated. Placeholder until the minibar menu arrives. Guests can also write their own request." },
  villasWithoutMinibar: { group: "menus", label: "Villas without a minibar", value: "Casita 1, Casita 2, Casita 3", sample: true, help: "Comma-separated, as written in the booking (e.g. Casita 2)." },

  // ---- reviews
  tripadvisorLink: { group: "reviews", label: "TripAdvisor review page", value: "https://www.tripadvisor.com/Search?q=Vale%20Palheiro%20Earth%20Resort", sample: true, help: "Paste the resort's direct \"write a review\" link." },
  reviewLink: { group: "reviews", label: "Google review link (optional)", value: "https://g.page/r/vale-palheiro/review", sample: true, help: "Shown under the TripAdvisor button. Leave empty to hide." },
};

let info: PropertyInfo = structuredClone(initial);

export function getPropertyInfo(): PropertyInfo {
  return info;
}

/** Plain key → value view used by the message templates. */
export function prop(): Record<PropertyKey, string> {
  const out = {} as Record<PropertyKey, string>;
  for (const k of Object.keys(info) as PropertyKey[]) out[k] = info[k].value;
  return out;
}

/** Staff update: any field they save counts as confirmed (no longer sample). */
export function updatePropertyInfo(patch: Partial<Record<PropertyKey, string>>): PropertyInfo {
  for (const [k, v] of Object.entries(patch)) {
    const key = k as PropertyKey;
    if (!(key in info) || typeof v !== "string") continue;
    info[key] = { ...info[key], value: v.trim(), sample: false };
  }
  return info;
}

/** Comma-separated setting → clean list. */
export function propList(key: PropertyKey): string[] {
  return info[key].value.split(",").map((x) => x.trim()).filter(Boolean);
}

/** "HH:MM" setting → minutes after midnight (fallback if unparseable). */
export function propMinutes(key: PropertyKey, fallback: number): number {
  const m = info[key].value.match(/(\d{1,2})[:h.](\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : fallback;
}

export function sampleFieldCount(): number {
  return Object.values(info).filter((f) => f.sample).length;
}
