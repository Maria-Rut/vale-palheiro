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
  | "breakfastHours" | "restaurantHours" | "restaurantClosedDay" | "barHours"
  | "wifiNetwork" | "wifiPassword" | "checkOutTime"
  | "brochureLink" | "wellnessInfo" | "wellnessMenuLink"
  | "minibarStandard" | "minibarExtras" | "villasWithoutMinibar"
  | "tripadvisorLink" | "reviewLink" | "newsletterLink";

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
  whatsappNumber: { group: "contact", label: "WhatsApp (front office)", value: "+351 933 979 043", sample: false, help: "The number guests can write to on WhatsApp. Mobile coverage can be limited here, so we suggest WhatsApp." },
  emergencyPhone: { group: "contact", label: "All-hours contact number", value: "+351 933 979 043", sample: false, help: "One number, reachable at any time." },

  // ---- arrival & check-in
  receptionHours: { group: "arrival", label: "Front office hours", value: "08:00–20:00", sample: false },
  receptionClose: { group: "arrival", label: "Front office closes at", value: "20:00", sample: false, help: "Arrivals after this time create a late check-in task for the team." },
  checkInTime: { group: "arrival", label: "Standard check-in from", value: "15:00", sample: false, help: "Confirmed by management." },
  earlyCheckIn: { group: "arrival", label: "Early check-in", value: "Subject to availability", sample: true, help: "Shown to guests who ask for early check-in." },
  lateArrivalFee: { group: "arrival", label: "Late-arrival fee (20:00–08:00)", value: "€35", sample: false, help: "Charged for arrivals after the front office closes (20:00). Leave empty for no fee." },
  meetingPoint: { group: "arrival", label: "Where we welcome guests", value: "Casa da Ribeira", sample: false, help: "The welcome lounge where stays begin." },
  mapsLink: { group: "arrival", label: "Google Maps link", value: "https://maps.google.com/?q=Rua+Vale+Palheiro+8670-016+Aljezur", sample: true },
  directions: {
    group: "arrival", long: true, label: "Directions & access road (English)", sample: false,
    value: "Set your GPS to Aljezur; once you reach Aljezur, update it to Vale Palheiro. Entering Aljezur, follow the historic centre towards the Igreja da Misericórdia. By the church, turn right and go down on the left, following the signs for Fonte das Mentiras. At the bottom you'll meet an unpaved track — keep straight ahead until you see the entrance gate of Vale Palheiro Earth Resort.\n\nLarge, heavy or low vehicles: head towards Praia da Amoreira, continuing past the municipal pools. Just after the picnic area, take the entrance on the left. Continue along this road to a bend/junction; there, take the dirt road away from the Aljezur entrance, keeping right, and continue to the Vale Palheiro gate.\n\nMobile coverage can be limited in the area — for any contact, we suggest WhatsApp.",
    help: "Full driving directions, the alternative route for large vehicles, and the mobile-coverage note.",
  },
  directionsPt: {
    group: "arrival", long: true, label: "Directions & access road (Portuguese)", sample: false,
    value: "Defina o GPS com destino a Aljezur; ao chegar a Aljezur, atualize o GPS para Vale Palheiro. Ao entrar em Aljezur, siga pela zona histórica em direção à Igreja da Misericórdia. Junto à igreja, vire à direita e desça pela esquerda, seguindo as indicações para a Fonte das Mentiras. No final da descida encontrará um caminho de terra batida — siga sempre em frente até avistar o portão de entrada do Vale Palheiro Earth Resort.\n\nPercurso alternativo (veículos grandes, pesados ou baixos): siga na direção da Praia da Amoreira, continuando em frente depois das piscinas municipais. Imediatamente após a zona de merendas, vire na entrada à esquerda. Continue em frente por esta estrada até chegar a uma curva/interseção. Nesse ponto, entre na estrada de terra em sentido contrário à entrada de Aljezur, mantendo-se à direita, e siga até ao portão de entrada de Vale Palheiro.\n\nA rede móvel poderá ser limitada na zona — para qualquer contacto, sugerimos a utilização do WhatsApp.",
  },
  directionsFr: {
    group: "arrival", long: true, label: "Directions & access road (French)", sample: false,
    value: "Réglez votre GPS sur Aljezur ; une fois à Aljezur, mettez-le à jour vers Vale Palheiro. En entrant dans Aljezur, suivez le centre historique en direction de l'Igreja da Misericórdia. Près de l'église, tournez à droite et descendez par la gauche en suivant les panneaux « Fonte das Mentiras ». En bas, vous trouverez une piste en terre — continuez tout droit jusqu'au portail d'entrée de Vale Palheiro Earth Resort.\n\nItinéraire alternatif (véhicules grands, lourds ou bas) : dirigez-vous vers la Praia da Amoreira, en continuant après les piscines municipales. Juste après l'aire de pique-nique, prenez l'entrée à gauche. Continuez jusqu'à un virage/une intersection ; là, prenez la piste en terre dans le sens opposé à l'entrée d'Aljezur, en gardant la droite, jusqu'au portail de Vale Palheiro.\n\nLe réseau mobile peut être limité dans la zone — pour tout contact, nous suggérons WhatsApp.",
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
  restaurantHours: { group: "dining", label: "The Barn — opening hours", value: "12:00–21:30", sample: false, help: "Lunch and dinner. From the Google listing." },
  restaurantClosedDay: { group: "dining", label: "The Barn — closed on", value: "Monday", sample: false, help: "Day of the week in English (e.g. Monday). Leave empty if open every day." },
  barHours: { group: "dining", label: "Bar hours", value: "", sample: true, help: "Leave empty and the bar line is left out of emails." },

  // ---- during the stay
  wifiNetwork: { group: "stay", label: "Wi-Fi network", value: "Vale Palheiro", sample: false, help: "Free Wi-Fi across the whole property." },
  wifiPassword: { group: "stay", label: "Wi-Fi password", value: "", sample: true, help: "Leave empty if the network is open / given on arrival. Free Wi-Fi across the property." },
  checkOutTime: { group: "stay", label: "Check-out time", value: "11:00", sample: true },

  // ---- brochure, minibar, wellness
  brochureLink: { group: "menus", label: "Experiences brochure (link or file)", value: "/brochure.pdf", sample: false, help: "The Experiences Menu (v4). Replace with a new PDF link when it changes." },
  wellnessInfo: { group: "menus", label: "Wellness (one line)", value: "Wellness da Ribeira — massages and treatments, in the spa or the privacy of your villa", sample: false, help: "Shown in the welcome message. Book at least 24h ahead." },
  wellnessMenuLink: { group: "menus", label: "Wellness menu link", value: "/wellness.html", sample: false, help: "The Wellness da Ribeira massages menu." },
  minibarStandard: { group: "menus", label: "Standard minibar (already in the villa)", value: "Still water, sparkling water, Coca-Cola, Fanta", sample: false, help: "Comma-separated. Shown to guests as information — not something they need to ask for." },
  minibarExtras: { group: "menus", label: "Extras guests can ask for", value: "A bottle of regional wine, Sparkling wine, Local craft beer, Alcohol-free drinks, Fresh fruit", sample: false, help: "Comma-separated. Guests can also write their own request." },
  villasWithoutMinibar: { group: "menus", label: "Villas without a minibar", value: "Casita Jasmim, Casita Lavanda, Casita Alecrim", sample: false, help: "All villas have a minibar except the Casitas. Comma-separated, as written in the booking." },

  // ---- reviews
  tripadvisorLink: { group: "reviews", label: "TripAdvisor review page", value: "https://www.tripadvisor.com.br/ShowUserReviews-g1021467-d33410224-r1041781103-Vale_Palheiro_Earth_Resort-Aljezur_Faro_District_Algarve.html", sample: false, help: "The resort's TripAdvisor review page." },
  reviewLink: { group: "reviews", label: "Google review link", value: "https://maps.app.goo.gl/4qwaaYqz6PNLxm8T8", sample: false, help: "Google Maps / Reviews link. Shown under the TripAdvisor button." },
  newsletterLink: { group: "menus", label: "Newsletter / stay-in-touch sign-up", value: "https://www.valepalheiro.com/newsletter", sample: true, help: "Where guests subscribe for events, Fado nights and updates. Shown as the \"Stay in touch\" button in the good-morning message." },
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
