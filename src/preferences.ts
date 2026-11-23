import { randomUUID } from "node:crypto";
import type {
  Adapter,
  ArrivalWindow,
  Beds,
  Dietary,
  Drink,
  Experience,
  GuestPreferences,
  Language,
  Occasion,
  Reservation,
} from "./types.ts";
import { BRAND } from "./brand.ts";

/**
 * Guest preferences: defaults, validation, and the short personal lines that
 * later messages use to show the guest we listened.
 *
 * Design rule: the guest should never face a questionnaire. Everything is
 * pre-filled with what most guests want, so "looks perfect" is one tap.
 */

/** The form closes this many hours before arrival, so the team can prepare. */
export const PREFERENCES_CUTOFF_HOURS = 24;

/** Public address of the app, used to build the guest's personal link. */
export function publicBaseUrl(): string {
  const url =
    process.env.PUBLIC_URL ??
    process.env.RENDER_EXTERNAL_URL ?? // set automatically on Render
    `http://localhost:${process.env.PORT ?? 3000}`;
  return url.replace(/\/$/, "");
}

export function preferencesUrl(r: Reservation): string {
  return `${publicBaseUrl()}/stay/${r.preferencesToken}`;
}

export function newPreferencesToken(): string {
  return randomUUID().replaceAll("-", "");
}

/**
 * Guess the plug adapter from the guest's phone country, so UK and US guests
 * find it already ticked. Portugal uses EU (type F) sockets.
 */
function likelyAdapter(phone: string): Adapter {
  if (phone.startsWith("+44") || phone.startsWith("+353")) return "uk";
  if (phone.startsWith("+1")) return "us";
  return "none";
}

export function defaultPreferences(r: Reservation): Omit<GuestPreferences, "submittedAt"> {
  return {
    arrival: "afternoon",
    fireplace: true,
    drinks: ["still_water"],
    beds: "as_booked",
    adapter: likelyAdapter(r.guest.phone),
    dietary: [],
    allergyConsent: false,
    occasion: "none",
    experiences: [],
    rememberForNextTime: false,
  };
}

export function preferencesOpen(r: Reservation, now: Date = new Date()): boolean {
  return Date.parse(r.checkIn) - now.getTime() > PREFERENCES_CUTOFF_HOURS * 3600_000;
}

const ARRIVALS: ArrivalWindow[] = ["early", "afternoon", "evening", "late"];
const DRINKS: Drink[] = ["still_water", "sparkling_water", "wine", "sparkling_wine", "beer", "alcohol_free"];
const BEDS: Beds[] = ["as_booked", "separate", "extra"];
const ADAPTERS: Adapter[] = ["none", "uk", "us", "other"];
const OCCASIONS: Occasion[] = ["none", "birthday", "anniversary", "honeymoon", "treat", "other"];
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
 * Deletes allergy data once the stay is over — it was only collected to cook
 * safely during this stay.
 */
export function purgeAfterStay(r: Reservation, now: Date): boolean {
  const p = r.preferences;
  if (!p || !p.allergies || Date.parse(r.checkOut) > now.getTime()) return false;
  p.allergies = undefined;
  p.allergyConsent = false;
  p.allergiesDeletedAt = now.toISOString();
  return true;
}

// ---------- personal lines for the messages ----------

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
 * One or two sentences for the welcome message that reflect what the guest
 * chose — the moment they see the preferences were actually heard.
 */
export function welcomePreferencesLine(r: Reservation, lang: Language): string {
  const p = r.preferences;
  if (!p) return "";
  const parts: string[] = [];
  const drinks = joinList(p.drinks.map((d) => DRINK_PHRASE[lang][d]), lang);
  const adapter = p.adapter !== "none" ? ADAPTER_PHRASE[lang][p.adapter] : "";

  if (lang === "pt") {
    if (p.fireplace) parts.push("a lareira pronta a acender");
    if (drinks) parts.push(`${drinks} no frigorífico`);
    if (p.beds === "extra") parts.push("a cama extra feita");
    if (p.beds === "separate") parts.push("as camas separadas");
    if (adapter) parts.push(`${adapter} à sua espera`);
    let s = parts.length ? `Preparámos tudo como pediu: ${joinList(parts, "pt")}.` : "";
    if (p.dietary.length || p.allergies) s += (s ? " " : "") + "A cozinha d'The Barn já tem as suas notas alimentares.";
    return s;
  }
  if (lang === "fr") {
    if (p.fireplace) parts.push("la cheminée prête à être allumée");
    if (drinks) parts.push(`${drinks} au frais`);
    if (p.beds === "extra") parts.push("le lit supplémentaire préparé");
    if (p.beds === "separate") parts.push("les lits séparés");
    if (adapter) parts.push(`${adapter} qui vous attend`);
    let s = parts.length ? `Tout est prêt comme vous l'avez souhaité : ${joinList(parts, "fr")}.` : "";
    if (p.dietary.length || p.allergies) s += (s ? " " : "") + "La cuisine de The Barn a bien noté vos préférences alimentaires.";
    return s;
  }
  if (p.fireplace) parts.push("the fireplace laid and ready to light");
  if (drinks) parts.push(`${drinks} in the fridge`);
  if (p.beds === "extra") parts.push("the extra bed made up");
  if (p.beds === "separate") parts.push("the beds set up separately");
  if (adapter) parts.push(`${adapter} waiting for you`);
  let s = parts.length ? `We've prepared everything the way you asked: ${joinList(parts, "en")}.` : "";
  if (p.dietary.length || p.allergies) s += (s ? " " : "") + "The kitchen at The Barn has your dietary notes.";
  return s;
}

/** Wi-Fi details for the welcome message (every guest, answered or not). */
export function wifiLine(lang: Language): string {
  const { wifiNetwork: n, wifiPassword: pw } = BRAND.practical;
  if (lang === "pt") return `Wi-Fi: rede "${n}", palavra-passe "${pw}".`;
  if (lang === "fr") return `Wi-Fi : réseau « ${n} », mot de passe « ${pw} ».`;
  return `Wi-Fi: network "${n}", password "${pw}".`;
}

/** A short line for the thank-you message when the guest opted to be remembered. */
export function postStayPreferencesLine(r: Reservation, lang: Language): string {
  if (!r.preferences?.rememberForNextTime) return "";
  if (lang === "pt") return "Guardámos as suas preferências, por isso da próxima vez o vale estará pronto à sua maneira.";
  if (lang === "fr") return "Nous avons gardé vos préférences : la prochaine fois, la vallée sera prête à votre façon.";
  return "We've kept your preferences, so next time the valley will be ready just the way you like it.";
}
