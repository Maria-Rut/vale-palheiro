/**
 * Practical property information that goes into guest messages: Wi-Fi, phone
 * numbers, where we meet guests, directions, restaurant hours, the review link.
 *
 * Staff edit all of this from the dashboard ("Property info" tab). Values that
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
}

export type PropertyKey =
  | "wifiNetwork"
  | "wifiPassword"
  | "receptionPhone"
  | "whatsappNumber"
  | "emergencyPhone"
  | "receptionHours"
  | "meetingPoint"
  | "directions"
  | "directionsPt"
  | "directionsFr"
  | "mapsLink"
  | "breakfastHours"
  | "restaurantHours"
  | "checkOutTime"
  | "reviewLink";

export type PropertyInfo = Record<PropertyKey, PropertyField>;

const initial: PropertyInfo = {
  wifiNetwork: {
    label: "Wi-Fi network",
    value: "ValePalheiro",
    sample: true,
  },
  wifiPassword: {
    label: "Wi-Fi password",
    value: "terra-guest",
    sample: true,
  },
  receptionPhone: {
    label: "Reception phone",
    value: "+351 282 000 000",
    sample: true,
  },
  whatsappNumber: {
    label: "WhatsApp (front office)",
    value: "+351 910 000 000",
    sample: true,
  },
  emergencyPhone: {
    label: "Out-of-hours / emergency number",
    value: "+351 910 000 001",
    sample: true,
    help: "Reception closes at 20:00 — this is the number guests call after that.",
  },
  receptionHours: {
    label: "Reception hours",
    value: "08:00–20:00",
    sample: false,
  },
  meetingPoint: {
    label: "Where we welcome guests",
    value: "Casa da Ribeira",
    sample: false,
    help: "The welcome lounge where stays begin.",
  },
  directions: {
    label: "Directions (English)",
    value:
      "From Aljezur, follow the signs towards the valley; the last stretch is an unpaved road, so take it slowly.",
    sample: true,
    help: "Two short sentences. Keep it practical.",
  },
  directionsPt: {
    label: "Directions (Portuguese)",
    value:
      "A partir de Aljezur, siga as indicações para o vale; o último troço é em terra batida, por isso conduza devagar.",
    sample: true,
  },
  directionsFr: {
    label: "Directions (French)",
    value:
      "Depuis Aljezur, suivez les panneaux vers la vallée ; le dernier tronçon est une piste non goudronnée, roulez doucement.",
    sample: true,
  },
  mapsLink: {
    label: "Map link",
    value: "https://maps.google.com/?q=Vale+Palheiro+Aljezur",
    sample: true,
  },
  breakfastHours: {
    label: "Breakfast hours",
    value: "08:00–10:30",
    sample: true,
  },
  restaurantHours: {
    label: "The Barn — dinner",
    value: "19:30–22:00",
    sample: true,
  },
  checkOutTime: {
    label: "Check-out time",
    value: "11:00",
    sample: true,
  },
  reviewLink: {
    label: "Review link",
    value: "https://g.page/r/vale-palheiro/review",
    sample: true,
    help: "Google review link (Google reviews matter most — only 27 so far).",
  },
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

export function sampleFieldCount(): number {
  return Object.values(info).filter((f) => f.sample).length;
}
