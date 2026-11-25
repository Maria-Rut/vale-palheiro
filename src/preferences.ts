import { createHmac } from "node:crypto";
import type {
  Adapter,
  ArrivalWindow,
  Beds,
  Dietary,
  Drink,
  Experience,
  GuestOccasion,
  GuestPreferences,
  Language,
  Reservation,
} from "./types.ts";

/**
 * Guest preferences — the "prepare your stay" page.
 *
 * The 3-days-before email links each guest to a personal page (no login)
 * where everything is already filled in with what most guests love. They only
 * change what matters to them, and their answers flow into:
 *   - a prep sheet for the team (dashboard → Guest preferences),
 *   - team tasks (extra bed to check, drinks to stock, experiences to arrange),
 *   - the arrival-day email ("we've prepared everything the way you asked"),
 *   - the thank-you email, if they asked us to remember them.
 *
 * Host stays the source of truth for bookings, so answers are kept in the app's
 * own store, keyed by reservation id. In production this would be a small
 * database table; here it is in memory like the rest of the prototype.
 */

/** The page closes this many hours before arrival, so the team can prepare. */
export const PREFERENCES_CUTOFF_HOURS = 24;

// ---------------------------------------------------------------- store

const store = new Map<string, GuestPreferences>();

export function getPreferences(reservationId: string): GuestPreferences | undefined {
  return store.get(reservationId);
}
export function setPreferences(reservationId: string, p: GuestPreferences): void {
  store.set(reservationId, p);
}

// ---------------------------------------------------------------- links

/**
 * The guest's personal link token: an HMAC of the reservation id. It can't be
 * guessed, needs no storage, and stays the same across restarts.
 * Set TERRA_LINK_SECRET in production.
 */
const LINK_SECRET = process.env.TERRA_LINK_SECRET ?? "terra-demo-link-secret";

export function preferencesToken(r: Reservation): string {
  return createHmac("sha256", LINK_SECRET).update(r.id).digest("base64url").slice(0, 22);
}

export function findByToken(reservations: Reservation[], token: string): Reservation | undefined {
  return reservations.find((r) => !r.cancelled && preferencesToken(r) === token);
}

/** Public address of the app, used to build the guest's personal link. */
export function publicBaseUrl(): string {
  const url =
    process.env.PUBLIC_URL ??
    process.env.RENDER_EXTERNAL_URL ?? // set automatically on Render
    `http://localhost:${process.env.PORT ?? 3000}`;
  return url.replace(/\/$/, "");
}

export function preferencesUrl(r: Reservation): string {
  return `${publicBaseUrl()}/stay/${preferencesToken(r)}`;
}

export function preferencesOpen(r: Reservation, now: Date = new Date()): boolean {
  return !r.cancelled && Date.parse(r.checkIn) - now.getTime() > PREFERENCES_CUTOFF_HOURS * 3600_000;
}

// ---------------------------------------------------------------- defaults & validation

/** Portugal uses EU (type F) sockets — guess the adapter from the guest's country. */
function likelyAdapter(country: string): Adapter {
  if (country === "GB" || country === "IE") return "uk";
  if (country === "US" || country === "CA") return "us";
  return "none";
}

/** If the front office already noted a celebration in Host, pre-select it. */
function occasionFromBooking(r: Reservation): GuestOccasion {
  if (!r.occasion) return "none";
  return r.occasion === "celebration" ? "other" : r.occasion;
}

export function defaultPreferences(r: Reservation): Omit<GuestPreferences, "submittedAt"> {
  return {
    arrival: "afternoon",
    fireplace: true,
    drinks: ["still_water"],
    beds: "as_booked",
    adapter: likelyAdapter(r.guest.country),
    dietary: [],
    allergyConsent: false,
    occasion: occasionFromBooking(r),
    experiences: [],
    rememberForNextTime: false,
  };
}

const ARRIVALS: ArrivalWindow[] = ["early", "afternoon", "evening", "late"];
const DRINKS: Drink[] = ["still_water", "sparkling_water", "wine", "sparkling_wine", "beer", "alcohol_free"];
const BEDS: Beds[] = ["as_booked", "separate", "extra"];
const ADAPTERS: Adapter[] = ["none", "uk", "us", "other"];
const OCCASIONS: GuestOccasion[] = ["none", "birthday", "anniversary", "honeymoon", "treat", "other"];
const DIETARY: Dietary[] = ["vegetarian", "vegan", "pescatarian", "gluten_free", "lactose_free"];
const EXPERIENCES: Experience[] = [
  "trail", "picnic", "jeep", "horse", "balloon", "bikes",
  "surf", "boat", "kayak",
  "yoga", "massage",
  "wine_tasting", "barn", "private_dinner", "cooking",
  "workshop",
  "transfer", "babysitting",
];

function pick<T extends string>(v: unknown, allowed: T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}
function pickMany<T extends string>(v: unknown, allowed: T[]): T[] {
  return Array.isArray(v) ? [...new Set(v.filter((x): x is T => allowed.includes(x as T)))] : [];
}
function text(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim().slice(0, max);
  return t || undefined;
}

export type ParseResult =
  | { ok: true; preferences: GuestPreferences }
  | { ok: false; error: string };

/** Validates untrusted input from the guest page against the allowed values. */
export function parsePreferences(r: Reservation, input: Record<string, unknown>): ParseResult {
  const d = defaultPreferences(r);
  const allergies = text(input.allergies, 500);
  const allergyConsent = input.allergyConsent === true;

  if (allergies && !allergyConsent) {
    return { ok: false, error: "allergy_consent_required" };
  }
  const occasion = pick(input.occasion, OCCASIONS, d.occasion);

  return {
    ok: true,
    preferences: {
      arrival: pick(input.arrival, ARRIVALS, d.arrival),
      fireplace: typeof input.fireplace === "boolean" ? input.fireplace : d.fireplace,
      drinks: Array.isArray(input.drinks) ? pickMany(input.drinks, DRINKS) : d.drinks,
      beds: pick(input.beds, BEDS, d.beds),
      adapter: pick(input.adapter, ADAPTERS, d.adapter),
      dietary: pickMany(input.dietary, DIETARY),
      // Without consent we never keep the allergy text.
      allergies: allergyConsent ? allergies : undefined,
      allergyConsent: allergyConsent && !!allergies,
      occasion,
      occasionNote: occasion === "none" ? undefined : text(input.occasionNote, 200),
      experiences: pickMany(input.experiences, EXPERIENCES),
      note: text(input.note, 600),
      rememberForNextTime: input.rememberForNextTime === true,
      submittedAt: new Date().toISOString(),
    },
  };
}

/**
 * Deletes allergy data once a stay is over — it was only collected to cook
 * safely during that stay.
 */
export function purgeAfterStay(reservations: Reservation[], now: Date): void {
  for (const r of reservations) {
    const p = store.get(r.id);
    if (!p || !p.allergies || Date.parse(r.checkOut) > now.getTime()) continue;
    p.allergies = undefined;
    p.allergyConsent = false;
    p.allergiesDeletedAt = now.toISOString();
  }
}

// ---------------------------------------------------------------- for the team

const DRINK_EN: Record<Drink, string> = {
  still_water: "still water", sparkling_water: "sparkling water", wine: "regional wine",
  sparkling_wine: "sparkling wine", beer: "beer", alcohol_free: "alcohol-free drinks",
};
export const EXPERIENCE_EN: Record<Experience, string> = {
  trail: "Vale Palheiro Trail", picnic: "Picnic", jeep: "Jeep tour", horse: "Horse riding",
  balloon: "Balloon flight", bikes: "Bicycles", surf: "Surf lessons", boat: "Boat trip (Lagos)",
  kayak: "Kayak (Lagos)", yoga: "Yoga / Pilates / Barre", massage: "Massage in villa",
  wine_tasting: "Wine tasting", barn: "Table at The Barn", private_dinner: "Private lunch/dinner",
  cooking: "Cooking workshop", workshop: "Creative workshop", transfer: "Airport transfer",
  babysitting: "Babysitting",
};
const OCCASION_EN: Record<Exclude<GuestOccasion, "none">, string> = {
  birthday: "a birthday", anniversary: "an anniversary", honeymoon: "their honeymoon",
  treat: "nothing in particular (\"do we need a reason?\") — a small treat", other: "something special",
};

/** Team-task texts raised by what the guest asked for. */
export function preferenceTasks(r: Reservation, place: string): { key: string; text: string }[] {
  const p = store.get(r.id);
  if (!p) return [];
  const who = `${r.guest.firstName} ${r.guest.lastName}`;
  const out: { key: string; text: string }[] = [];
  const paid = p.drinks.filter((d) => d !== "still_water" && d !== "sparkling_water");
  if (paid.length) {
    out.push({ key: "drinks", text: `${who} would like ${paid.map((d) => DRINK_EN[d]).join(", ")} in the fridge — confirm price with them, then stock ${place}.` });
  }
  if (p.beds !== "as_booked") {
    out.push({ key: "beds", text: `${who} asked for ${p.beds === "extra" ? "an extra bed" : "separate beds"} — check ${place} can do it and confirm with them.` });
  }
  if (p.experiences.length) {
    out.push({ key: "experiences", text: `${who} would like help arranging: ${p.experiences.map((e) => EXPERIENCE_EN[e]).join(", ")} — get in touch with times and prices.` });
  }
  // Only when Host has no occasion noted (otherwise the existing occasion task covers it).
  if (p.occasion !== "none" && !r.occasion) {
    out.push({ key: "occasion", text: `${who} says they're celebrating ${OCCASION_EN[p.occasion]}${p.occasionNote ? ` ("${p.occasionNote}")` : ""} — a small touch in ${place}?` });
  }
  return out;
}

// ---------------------------------------------------------------- for the guest emails

const DRINK_PHRASE: Record<Language, Record<Drink, string>> = {
  en: {
    still_water: "still water", sparkling_water: "sparkling water", wine: "a bottle of regional wine",
    sparkling_wine: "something sparkling", beer: "cold beer", alcohol_free: "alcohol-free drinks",
  },
  pt: {
    still_water: "água sem gás", sparkling_water: "água com gás", wine: "uma garrafa de vinho da região",
    sparkling_wine: "um espumante", beer: "cerveja fresca", alcohol_free: "bebidas sem álcool",
  },
  fr: {
    still_water: "de l'eau plate", sparkling_water: "de l'eau pétillante", wine: "une bouteille de vin de la région",
    sparkling_wine: "des bulles", beer: "de la bière fraîche", alcohol_free: "des boissons sans alcool",
  },
};

const ADAPTER_PHRASE: Record<Language, Record<Exclude<Adapter, "none">, string>> = {
  en: { uk: "a UK plug adapter", us: "a US plug adapter", other: "a plug adapter" },
  pt: { uk: "um adaptador de tomada britânico", us: "um adaptador de tomada americano", other: "um adaptador de tomada" },
  fr: { uk: "un adaptateur de prise britannique", us: "un adaptateur de prise américain", other: "un adaptateur de prise" },
};

function joinList(items: string[], lang: Language): string {
  if (items.length <= 1) return items[0] ?? "";
  const and = lang === "pt" ? " e " : lang === "fr" ? " et " : " and ";
  return items.slice(0, -1).join(", ") + and + items[items.length - 1];
}

/**
 * For the 3-days-before email: the invitation to the personal page, or — if
 * the guest already answered — a thank-you with the link to change anything.
 */
export function preferencesInviteLine(r: Reservation, lang: Language): string {
  const link = preferencesUrl(r);
  const answered = store.has(r.id);
  if (lang === "pt") {
    return answered
      ? `Obrigado por nos dizer como gosta das coisas — já está tudo anotado. Se quiser mudar algo: ${link}`
      : `Já deixámos tudo como a maioria dos hóspedes gosta: a lareira pronta a acender e água fresca no frigorífico. Apetece-lhe uma garrafa de vinho da região, uma cama extra, um passeio a cavalo ao pôr do sol? Diga-nos a hora de chegada e ajuste o que quiser em 30 segundos:\n${link}`;
  }
  if (lang === "fr") {
    return answered
      ? `Merci de nous avoir dit comment vous aimez les choses — tout est noté. Pour changer quoi que ce soit : ${link}`
      : `Tout est déjà réglé comme la plupart de nos hôtes l'aiment : la cheminée prête à être allumée et de l'eau fraîche au réfrigérateur. Envie d'une bouteille de vin de la région, d'un lit supplémentaire, d'une balade à cheval au coucher du soleil ? Indiquez votre heure d'arrivée et ajustez ce que vous voulez en 30 secondes :\n${link}`;
  }
  return answered
    ? `Thank you for telling us how you like things — it's all noted. If you'd like to change anything: ${link}`
    : `We've already set things up the way most guests love them: the fireplace laid and ready to light, and fresh water in the fridge. Fancy a bottle of regional wine, an extra bed, or a sunset horse ride? Tell us your arrival time and adjust anything you like in 30 seconds:\n${link}`;
}

/**
 * For the arrival-day email: one or two sentences reflecting what the guest
 * chose — the moment they see the preferences were actually heard.
 */
export function welcomePreferencesLine(r: Reservation, lang: Language): string {
  const p = store.get(r.id);
  if (!p) return "";
  const parts: string[] = [];
  const drinks = joinList(p.drinks.map((d) => DRINK_PHRASE[lang][d]), lang);
  const adapter = p.adapter !== "none" ? ADAPTER_PHRASE[lang][p.adapter] : "";
  const food = p.dietary.length > 0 || !!p.allergies;

  if (lang === "pt") {
    if (p.fireplace) parts.push("a lareira pronta a acender");
    if (drinks) parts.push(`${drinks} no frigorífico`);
    if (adapter) parts.push(`${adapter} à sua espera`);
    let s = parts.length ? `Preparámos tudo como pediu: ${joinList(parts, "pt")}.` : "";
    if (food) s += (s ? " " : "") + "A cozinha d'The Barn já tem as suas notas alimentares.";
    return s;
  }
  if (lang === "fr") {
    if (p.fireplace) parts.push("la cheminée prête à être allumée");
    if (drinks) parts.push(`${drinks} au frais`);
    if (adapter) parts.push(`${adapter} qui vous attend`);
    let s = parts.length ? `Tout est prêt comme vous l'avez souhaité : ${joinList(parts, "fr")}.` : "";
    if (food) s += (s ? " " : "") + "La cuisine de The Barn a bien noté vos préférences alimentaires.";
    return s;
  }
  if (p.fireplace) parts.push("the fireplace laid and ready to light");
  if (drinks) parts.push(`${drinks} in the fridge`);
  if (adapter) parts.push(`${adapter} waiting for you`);
  let s = parts.length ? `We've prepared everything the way you asked: ${joinList(parts, "en")}.` : "";
  if (food) s += (s ? " " : "") + "The kitchen at The Barn has your dietary notes.";
  return s;
}

/** For the thank-you email, when the guest asked us to remember them. */
export function postStayPreferencesLine(r: Reservation, lang: Language): string {
  if (!store.get(r.id)?.rememberForNextTime) return "";
  if (lang === "pt") return "Guardámos as suas preferências, por isso da próxima vez o vale estará pronto à sua maneira.";
  if (lang === "fr") return "Nous avons gardé vos préférences : la prochaine fois, la vallée sera prête à votre façon.";
  return "We've kept your preferences, so next time the valley will be ready just the way you like it.";
}
