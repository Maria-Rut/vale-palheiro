import { createHmac } from "node:crypto";
import { propList, propMinutes, prop } from "./property.ts";
import { RESORT_TZ, zonedParts, zonedTime } from "./timezone.ts";
import type {
  Adapter,
  Beds,
  Dietary,
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
//
// In-memory map is the synchronous source of truth (all callers stay sync).
// When Supabase is configured, it is loaded into the map at startup and every
// save is written through to Supabase. A Supabase outage never blocks a guest:
// the in-memory copy always holds, the write is best-effort.

import { supabaseEnabled, selectAll, upsert } from "./supabase.ts";

const store = new Map<string, GuestPreferences>();

export function getPreferences(reservationId: string): GuestPreferences | undefined {
  return store.get(reservationId);
}

export function setPreferences(reservationId: string, p: GuestPreferences): void {
  store.set(reservationId, p);
  if (supabaseEnabled) {
    void upsert("guest_preferences", {
      reservation_id: reservationId,
      data: p,
      updated_at: new Date().toISOString(),
    });
  }
}

/** Load persisted preferences into memory at startup (no-op without Supabase). */
export async function loadPreferences(): Promise<number> {
  if (!supabaseEnabled) return 0;
  const rows = await selectAll<{ reservation_id: string; data: GuestPreferences }>(
    "guest_preferences",
    "reservation_id,data",
  );
  for (const row of rows) {
    if (row.reservation_id && row.data) store.set(row.reservation_id, row.data);
  }
  return rows.length;
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

/** Check-in time from Resort settings, as the default arrival time. */
function defaultArrival(r: Reservation): string {
  const m = propMinutes("checkInTime", 15 * 60);
  // If the booking already carries a later expected time, start from that.
  const p = zonedParts(new Date(r.checkIn), RESORT_TZ);
  const booked = p.hour * 60 + p.minute;
  const v = booked > m ? booked : m;
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
}

export function defaultPreferences(r: Reservation): Omit<GuestPreferences, "submittedAt"> {
  return {
    arrivalTime: defaultArrival(r),
    earlyCheckIn: false,
    fireplace: true,
    minibarExtras: [],
    beds: "as_booked",
    adapter: likelyAdapter(r.guest.country),
    dietary: [],
    allergyConsent: false,
    occasion: occasionFromBooking(r),
    experiences: [],
    rememberForNextTime: false,
  };
}

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
      arrivalTime: typeof input.arrivalTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(input.arrivalTime) ? input.arrivalTime : d.arrivalTime,
      earlyCheckIn: input.earlyCheckIn === true,
      fireplace: typeof input.fireplace === "boolean" ? input.fireplace : d.fireplace,
      minibarExtras: pickMany(input.minibarExtras, propList("minibarExtras")),
      minibarRequest: text(input.minibarRequest, 300),
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
  if (p.minibarExtras.length || p.minibarRequest) {
    const bits = [...p.minibarExtras.map((x) => x.toLowerCase()), p.minibarRequest ? `"${p.minibarRequest}"` : ""].filter(Boolean);
    out.push({ key: "minibar", text: `Special minibar request for ${place} (${who}): ${bits.join(", ")} — confirm any price with them, then stock it before arrival.` });
  }
  if (p.beds !== "as_booked") {
    out.push({ key: "beds", text: `${who} asked for ${p.beds === "extra" ? "an additional bed" : "separate beds"} — check ${place} can do it and confirm with them.` });
  }
  if (p.adapter !== "none") {
    out.push({ key: "adapter", text: `Prepare a ${p.adapter === "uk" ? "UK" : p.adapter === "us" ? "US" : "travel (ask which)"} plug adapter in ${place} for ${who}.` });
  }
  if (p.dietary.length || p.allergies) {
    const diet = [...p.dietary.map((d) => d.replace("_", "-")), p.allergies ? `allergies: ${p.allergies}` : ""].filter(Boolean).join("; ");
    out.push({ key: "kitchen", text: `Tell the kitchen (breakfast and The Barn) about ${who}: ${diet}.` });
  }
  if (p.experiences.length) {
    out.push({ key: "experiences", text: `${who} would like help arranging: ${p.experiences.map((e) => EXPERIENCE_EN[e]).join(", ")} — get in touch with times and prices.` });
  }
  // Only when the booking has no occasion noted (otherwise the occasion task covers it).
  if (p.occasion !== "none" && !r.occasion) {
    out.push({ key: "occasion", text: `${who} says they're celebrating ${OCCASION_EN[p.occasion]}${p.occasionNote ? ` ("${p.occasionNote}")` : ""} — prepare a small arrangement in ${place}.` });
  }
  return out;
}

/**
 * When the guest expects to arrive: their answer on the page if they gave one
 * (same day as the booking, resort clock), otherwise the booking's time.
 */
export function expectedArrival(r: Reservation): Date {
  const p = store.get(r.id);
  if (!p?.arrivalTime) return new Date(r.checkIn);
  const [h, m] = p.arrivalTime.split(":").map(Number);
  const d = zonedParts(new Date(r.checkIn), RESORT_TZ);
  return zonedTime(d.year, d.month, d.day, h, m, RESORT_TZ);
}

/** Most villas have a standard minibar; a few small ones don't (Resort settings). */
export function hasMinibar(placeLabel: string): boolean {
  const label = placeLabel.toLowerCase();
  // Rule from management: every villa has a minibar except the Casitas.
  if (label.includes("casita")) return false;
  // Plus any specific names listed in Resort settings.
  const without = propList("villasWithoutMinibar").map((x) => x.toLowerCase());
  return !without.includes(label);
}

// ---------------------------------------------------------------- for the guest emails


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
  const extras = [...p.minibarExtras.map((x) => x.toLowerCase()), p.minibarRequest ?? ""].filter(Boolean);
  const drinks = extras.length ? joinList(extras, lang) : "";
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
  if (lang === "pt") return "Guardámos as suas preferências, por isso da próxima vez Vale Palheiro estará pronto à sua maneira.";
  if (lang === "fr") return "Nous avons gardé vos préférences : la prochaine fois, Vale Palheiro sera prêt à votre façon.";
  return "We've kept your preferences, so next time Vale Palheiro will be ready just the way you like it.";
}
