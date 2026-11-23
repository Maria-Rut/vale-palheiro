import type { Language, Reservation } from "./types.ts";
import { getPreferences } from "./preferences.ts";
import { getActivities, priceLabel, type Activity, type Condition } from "./activities.ts";
import { resortDate, type DayForecast, type Forecast } from "./weather.ts";
import { LOCALE } from "./brand.ts";
import { RESORT_TZ, zonedParts } from "./timezone.ts";

/**
 * The stay-recommendation agent.
 *
 * For each full day of a guest's stay it reads the forecast (sky, rain, wind,
 * temperature and the Atlantic swell), turns it into plain conditions, and
 * picks the best-fitting experience from Vale Palheiro's catalogue:
 *   rain        → a massage in the villa, wine tasting, a workshop
 *   sun & calm  → the Vale Palheiro Trail, horse riding, a balloon flight
 *   big swell   → the cliffs at Monte Clérigo / Arrifana to watch the sea
 *   flat sea    → boats and kayaks from Lagos
 *   last day    → something to end the stay well (sunset jeep, wine, dinner)
 *
 * The choice is rule-based on purpose: the same forecast always gives the same,
 * explainable answer, and it can only ever suggest things the resort actually
 * offers. Each pick carries a short reason the team can read in the dashboard.
 */

export interface DayPick {
  date: string;
  /** Day label as the guest reads it, e.g. "Tomorrow, Tue 25 Nov". */
  isFirst: boolean;
  isLast: boolean;
  forecast?: DayForecast;
  conditions: Condition[];
  activity: Activity;
  /** On the last day, when the main pick isn't an ending: something to close the stay. */
  finale?: Activity;
  /** Why this was picked, for staff. */
  reason: string;
}

export interface StayPlan {
  days: DayPick[];
  /** Whether a forecast backed the picks (false → no weather wording). */
  basedOnForecast: boolean;
  forecastSource?: Forecast["source"];
  /** Resort-local date the message is sent, to say "today"/"tomorrow". */
  sentOn: string;
}

const MAX_DAYS = 5;

// ------------------------------------------------------------ forecast → conditions

export function conditionsFor(f: DayForecast): Condition[] {
  const c: Condition[] = [];
  const wetCode = (f.weatherCode >= 61 && f.weatherCode <= 67) || f.weatherCode >= 95 || f.weatherCode === 81 || f.weatherCode === 82;
  const rainy = f.rainChance >= 60 || f.rainMm >= 3 || wetCode;
  const showers = !rainy && (f.rainChance >= 30 || (f.weatherCode >= 51 && f.weatherCode <= 57) || f.weatherCode === 80);
  if (rainy) c.push("rainy");
  else if (showers) c.push("showers");
  else if (f.weatherCode <= 2) c.push("sunny");
  else c.push("cloudy");
  if (f.gustMaxKmh >= 50 || f.windMaxKmh >= 35) c.push("windy");
  if (f.gustMaxKmh < 30 && f.windMaxKmh < 20) c.push("calm");
  if (f.waveHeightM >= 3.5) c.push("big_sea");
  if (f.waveHeightM >= 0.8 && f.waveHeightM <= 2.5 && f.windMaxKmh < 25) c.push("surf_sea");
  if (f.waveHeightM > 0 && f.waveHeightM < 1.5 && f.windMaxKmh < 20) c.push("flat_sea");
  if (f.tempMax >= 24) c.push("warm");
  return c;
}

// ------------------------------------------------------------ scoring

/** "Prepare your stay" page choices → catalogue ids. */
const EXPERIENCE_TO_ACTIVITY: Record<string, string[]> = {
  trail: ["trail", "guided_walk"], wine_tasting: ["wine"], yoga: ["yoga", "pilates"], barn: [],
};

interface Context {
  /** Catalogue ids the guest said they'd like on their "prepare your stay" page. */
  wanted: string[];
  kids: boolean;
  couple: boolean;
  business: boolean;
  occasion: boolean;
}

function score(a: Activity, conds: Condition[], hasForecast: boolean, isLast: boolean, ctx: Context, prevCategory?: string): { s: number; why: string[] } {
  const why: string[] = [];
  if (!a.enabled) return { s: -Infinity, why: ["switched off"] };
  if (hasForecast && a.notIn.some((c) => conds.includes(c))) return { s: -Infinity, why: ["wrong weather"] };
  if (a.needs && (!hasForecast || !a.needs.every((c) => conds.includes(c)))) return { s: -Infinity, why: ["conditions not met"] };
  if (ctx.kids && a.family === false) return { s: -Infinity, why: ["not for children"] };

  let s = 0;
  if (ctx.wanted.includes(a.id)) { s += 3; why.push("they asked about it"); }
  if (hasForecast) {
    const hits = a.goodIn.filter((c) => conds.includes(c));
    s += hits.length * 2;
    if (hits.length) why.push(`suits ${hits.join(", ").replace(/_/g, " ")}`);
  } else {
    s += a.indoor ? 0.5 : 1;
  }
  if (a.id === "sea_watch") { s += 5; why.push("big swell is worth seeing"); }
  if (isLast && a.finale) { s += 4; why.push("a good way to end the stay"); }
  if (!isLast && a.finale) s -= 1;
  if (a.id === "private_dinner") {
    if (ctx.occasion && isLast) { s += 4; why.push("they are celebrating"); } else s -= 3;
  }
  if (ctx.kids && a.family) { s += 1; why.push("good with children"); }
  if (ctx.couple && ["massage", "balloon", "wine"].includes(a.id)) { s += 1; why.push("good for two"); }
  if (ctx.business && a.category === "wellbeing") { s += 1; why.push("a reset from work"); }
  if (prevCategory && prevCategory === a.category) s -= 1;
  return { s, why };
}

// ------------------------------------------------------------ the agent

export function recommend(r: Reservation, sendAt: Date, forecast: Forecast | undefined): StayPlan | undefined {
  const sentOn = resortDate(sendAt);
  const startOffset = zonedParts(sendAt, RESORT_TZ).hour < 12 ? 0 : 1;
  const lastFullDay = resortDate(new Date(r.checkOut), -1);

  const dates: string[] = [];
  for (let i = startOffset; dates.length < MAX_DAYS; i++) {
    const d = resortDate(sendAt, i);
    if (d > lastFullDay) break;
    dates.push(d);
  }
  if (dates.length === 0) return undefined;

  const ctx: Context = {
    wanted: (getPreferences(r.id)?.experiences ?? []).flatMap((e) => EXPERIENCE_TO_ACTIVITY[e] ?? [e]),
    kids: r.children > 0,
    couple: r.adults === 2 && r.children === 0,
    business: r.motive === "business",
    occasion: !!r.occasion,
  };
  const byDate = new Map((forecast?.days ?? []).map((d) => [d.date, d]));
  const used = new Set<string>();
  const days: DayPick[] = [];
  let prevCategory: string | undefined;

  dates.forEach((date, i) => {
    const f = byDate.get(date);
    const conds = f ? conditionsFor(f) : [];
    const isLast = i === dates.length - 1 && dates.length > 1;
    let best: { a: Activity; s: number; why: string[] } | undefined;
    for (const a of getActivities()) {
      if (used.has(a.id)) continue;
      const { s, why } = score(a, conds, !!f, isLast, ctx, prevCategory);
      if (s === -Infinity) continue;
      if (!best || s > best.s) best = { a, s, why };
    }
    if (!best) return;
    used.add(best.a.id);
    prevCategory = best.a.category;

    // Last day: if the best fit isn't itself an ending, add one that is.
    let finale: Activity | undefined;
    if (isLast && !best.a.finale) {
      let top = -Infinity;
      for (const a of getActivities()) {
        if (!a.finale || used.has(a.id)) continue;
        const { s } = score(a, conds, !!f, true, ctx);
        if (s > top) { top = s; finale = a; }
      }
      if (finale) used.add(finale.id);
    }

    days.push({
      date, isFirst: i === 0, isLast, forecast: f, conditions: conds, activity: best.a, finale,
      reason: `${f ? conds.join(" + ").replace(/_/g, " ") : "no forecast"} → ${best.a.name.en}${best.why.length ? ` (${best.why.join("; ")})` : ""}${finale ? `, then ${finale.name.en} to end the stay` : ""}`,
    });
  });

  return {
    days,
    basedOnForecast: days.some((d) => d.forecast),
    forecastSource: forecast?.source,
    sentOn,
  };
}

// ------------------------------------------------------------ wording

function dateLabel(date: string, lang: Language): string {
  const d = new Date(`${date}T12:00:00Z`);
  return new Intl.DateTimeFormat(LOCALE[lang], { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(d);
}

function dayLabel(p: DayPick, plan: StayPlan, lang: Language): string {
  const dl = dateLabel(p.date, lang);
  const tomorrow = resortDate(new Date(`${plan.sentOn}T12:00:00Z`), 1);
  const rel = p.date === plan.sentOn
    ? { en: "Today", pt: "Hoje", fr: "Aujourd'hui" }[lang]
    : p.date === tomorrow ? { en: "Tomorrow", pt: "Amanhã", fr: "Demain" }[lang] : undefined;
  if (p.isLast) {
    return { en: `Your last full day, ${dl}`, pt: `O seu último dia, ${dl}`, fr: `Votre dernier jour, ${dl}` }[lang];
  }
  return rel ? `${rel}, ${dl}` : dl.charAt(0).toUpperCase() + dl.slice(1);
}

function weatherPhrase(p: DayPick, lang: Language): string {
  const f = p.forecast;
  if (!f) return "";
  const c = p.conditions;
  const sky = c.includes("rainy")
    ? { en: "rain expected", pt: "chuva prevista", fr: "pluie prévue" }
    : c.includes("showers")
      ? { en: "a few showers", pt: "alguns aguaceiros", fr: "quelques averses" }
      : c.includes("sunny")
        ? { en: "sunny", pt: "sol", fr: "ensoleillé" }
        : { en: "dry and cloudy", pt: "seco e nublado", fr: "sec et nuageux" };
  const parts = [`${sky[lang]}, ${Math.round(f.tempMax)}°C`];
  if (c.includes("windy")) parts.push({ en: "windy", pt: "com vento", fr: "venteux" }[lang]);
  if (c.includes("big_sea")) {
    const m = Math.round(f.waveHeightM);
    parts.push({ en: `a big Atlantic swell (around ${m} m)`, pt: `mar forte no Atlântico (ondas de cerca de ${m} m)`, fr: `une grosse houle atlantique (environ ${m} m)` }[lang]);
  }
  const and = { en: " and ", pt: " e ", fr: " et " }[lang];
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")}${and}${parts.at(-1)}` : parts[0];
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The "Our suggestions for your stay" block for the welcome email. */
export function renderStayPlan(plan: StayPlan, lang: Language, phone: string): string {
  const head = {
    en: "Our suggestions for your stay",
    pt: "As nossas sugestões para a sua estadia",
    fr: "Nos suggestions pour votre séjour",
  }[lang];
  const intro = plan.basedOnForecast
    ? {
        en: "We've looked at the weather and sea forecast for your days with us. Here's what we'd suggest:",
        pt: "Vimos a previsão do tempo e do mar para os seus dias connosco. Eis o que sugerimos:",
        fr: "Nous avons regardé les prévisions météo et l'état de la mer pour vos journées ici. Voici ce que nous vous suggérons :",
      }[lang]
    : {
        en: "A few ideas for your days with us:",
        pt: "Algumas ideias para os seus dias connosco:",
        fr: "Quelques idées pour vos journées ici :",
      }[lang];
  const endWith = { en: "to end your stay, ", pt: "para terminar a estadia, ", fr: "pour finir le séjour, " }[lang];

  const lines = plan.days.map((p) => {
    const label = dayLabel(p, plan, lang);
    const w = weatherPhrase(p, lang);
    const what = `${p.isLast && p.activity.finale ? endWith : ""}${p.activity.pitch[lang]} (${priceLabel(p.activity, lang)})`;
    const colon = lang === "fr" ? " :" : ":";
    const close = p.finale
      ? ` ${cap(endWith)}${p.finale.pitch[lang]} (${priceLabel(p.finale, lang)}).`
      : "";
    return `• ${label}${w ? ` — ${w}` : ""}${colon} ${cap(what)}.${close}`;
  });

  const outro = {
    en: `The weather changes quickly on this coast, and we're happy to adjust. For any question about these suggestions or any of our experiences, just reply or call us on ${phone}.`,
    pt: `O tempo muda depressa nesta costa e teremos todo o gosto em ajustar. Para qualquer questão sobre estas sugestões ou as nossas experiências, responda a este email ou ligue-nos para o ${phone}.`,
    fr: `La météo change vite sur cette côte et nous adapterons volontiers. Pour toute question sur ces suggestions ou nos expériences, répondez simplement ou appelez-nous au ${phone}.`,
  }[lang];

  return [head, intro, ...lines, "", outro].join("\n");
}
