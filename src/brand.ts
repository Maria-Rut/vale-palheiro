import type { Language, TripPurpose } from "./types.ts";

/**
 * Brand voice definition for Vale Palheiro — Earth Resort.
 *
 * Everything here exists to keep messages warm, calm and specific to the place,
 * and to keep them *out* of "spam" territory: no exclamation-heavy hype, no
 * generic marketing lines, concrete references to the valley and the resort.
 *
 * This same object is also handed to the LLM generator as its system/style
 * guidance when a live model is available in production.
 */

export const BRAND = {
  name: "Vale Palheiro — Earth Resort",
  shortName: "Vale Palheiro",
  signoffName: "The team at Vale Palheiro",
  /** One-line voice guide, reused for the LLM prompt. */
  voice:
    "Calm, warm and unhurried. Grounded in nature and the valley. Speaks like a thoughtful host, never like an advert. Short sentences. No hype, no exclamation marks stacked up, no pushy calls to action.",
  /** Concrete, true details we can weave in so copy feels real, not generic. */
  facts: {
    location: "the Costa Vicentina, near Aljezur",
    setting: "a 280-acre protected valley beside the Aljezur river",
    welcomeSpace: "Casa da Ribeira", // the welcome lounge
    restaurant: "The Barn", // on-site restaurant
    trail: "the Rota Vicentina", // nearby hiking trail
    material: "taipa", // compressed-earth walls
  },
} as const;

/** Localised greeting by language. */
export const GREETING: Record<Language, (name: string) => string> = {
  en: (name) => `Dear ${name}`,
  pt: (name) => `Caro(a) ${name}`,
  fr: (name) => `Cher/Chère ${name}`,
};

/** Localised sign-off. */
export const SIGNOFF: Record<Language, string> = {
  en: "Warmly,\nThe team at Vale Palheiro",
  pt: "Com carinho,\nA equipa do Vale Palheiro",
  fr: "Chaleureusement,\nL'équipe de Vale Palheiro",
};

/**
 * A short, purpose-specific line that makes each message feel personal rather
 * than templated. Keyed by trip purpose and language.
 */
export const PURPOSE_LINE: Record<
  TripPurpose,
  Record<Language, string>
> = {
  couple: {
    en: "We've set aside a quiet corner of the valley for the two of you.",
    pt: "Reservámos um recanto tranquilo do vale para os dois.",
    fr: "Nous vous avons réservé un coin paisible de la vallée, rien que pour vous deux.",
  },
  family: {
    en: "There's plenty of room for everyone to roam, and little hands are always welcome in the kitchen garden.",
    pt: "Há muito espaço para todos explorarem, e as mãos pequeninas são sempre bem-vindas na horta.",
    fr: "Il y a de la place pour que chacun s'évade, et les petites mains sont toujours bienvenues au potager.",
  },
  solo: {
    en: "We'll keep things gentle and unintrusive, so you can simply be here.",
    pt: "Manteremos tudo sereno e discreto, para que possa simplesmente estar aqui.",
    fr: "Nous resterons discrets, pour que vous puissiez simplement être ici.",
  },
  friends: {
    en: "The long table and the wine cellar are ready whenever you are.",
    pt: "A mesa comprida e a garrafeira estão prontas quando quiserem.",
    fr: "La grande table et la cave à vin vous attendent.",
  },
  hiking: {
    en: "The Rota Vicentina starts almost at our doorstep — we'll have an early breakfast ready for you.",
    pt: "A Rota Vicentina começa quase à nossa porta — teremos um pequeno-almoço cedo à sua espera.",
    fr: "La Rota Vicentina commence presque à notre porte — un petit-déjeuner matinal vous attendra.",
  },
  celebration: {
    en: "We'd love to help mark the occasion — let us know if there's anything we can quietly arrange.",
    pt: "Gostaríamos de ajudar a celebrar a ocasião — diga-nos se houver algo que possamos preparar discretamente.",
    fr: "Nous serions ravis de célébrer l'occasion — dites-nous si nous pouvons organiser quelque chose en toute discrétion.",
  },
  business: {
    en: "The valley makes for a clear head — a good place to think as well as to rest.",
    pt: "O vale clareia as ideias — um bom lugar para pensar e também para descansar.",
    fr: "La vallée éclaircit l'esprit — un bon endroit pour réfléchir autant que pour se reposer.",
  },
};
