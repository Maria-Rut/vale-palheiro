import type { Language, Motive, Occasion } from "./types.ts";

/**
 * Brand voice definition for Vale Palheiro — Earth Resort.
 *
 * Everything here exists to keep messages warm, calm and specific to the place,
 * and to keep them *out* of "spam" territory: no hype, no stacked exclamation
 * marks, concrete references to the valley. Messages stay short — guests should
 * be able to read each one in under a minute.
 *
 * Facts below are verified from Vale Palheiro's own site, press coverage and
 * interviews with the team — nothing invented. The same object is handed to the
 * LLM generator as style guidance when a live model is enabled.
 */

export const BRAND = {
  name: "Vale Palheiro — Earth Resort",
  shortName: "Vale Palheiro",
  voice:
    "Calm, warm and unhurried. Grounded in nature and the valley. Speaks like a thoughtful host, never like an advert. Short sentences. Concise: practical details first, no filler. No hype, no exclamation marks, no pushy calls to action.",
  facts: {
    location: "the Costa Vicentina, near Aljezur",
    setting: "a protected valley beside the Aljezur river",
    welcomeSpace: "Casa da Ribeira",
    restaurant: "The Barn",
    spa: "the spa",
    trail: "the Rota Vicentina",
    material: "taipa (rammed earth)",
    produce: "eggs, honey and vegetables from our own garden",
  },
} as const;

export const LOCALE: Record<Language, string> = { en: "en-GB", pt: "pt-PT", fr: "fr-FR" };

export const GREETING: Record<Language, (name: string) => string> = {
  en: (name) => `Dear ${name},`,
  pt: (name) => `Olá ${name},`,
  fr: (name) => `Bonjour ${name},`,
};

export const SIGNOFF: Record<Language, string> = {
  en: "Warmly,\nThe team at Vale Palheiro",
  pt: "Com carinho,\nA equipa do Vale Palheiro",
  fr: "Chaleureusement,\nL'équipe de Vale Palheiro",
};

export const OCCASION: Record<Occasion, Record<Language, string>> = {
  birthday: { en: "your birthday", pt: "o seu aniversário", fr: "votre anniversaire" },
  anniversary: {
    en: "your anniversary",
    pt: "o vosso aniversário de casamento",
    fr: "votre anniversaire de mariage",
  },
  honeymoon: { en: "your honeymoon", pt: "a vossa lua de mel", fr: "votre lune de miel" },
  celebration: { en: "a celebration", pt: "uma celebração", fr: "une célébration" },
};

/** One personal line for the thank-you, keyed by the real "motive of stay" field. */
export const POST_STAY_LINE: Record<Motive, Record<Language, string>> = {
  business: {
    en: "We hope Vale Palheiro gave you some space to think.",
    pt: "Esperamos que Vale Palheiro lhe tenha dado espaço para pensar.",
    fr: "Nous espérons que Vale Palheiro vous a offert un peu d'espace pour réfléchir.",
  },
  leisure: {
    en: "We hope you took a little of its calm home with you.",
    pt: "Esperamos que tenha levado consigo um pouco da calma daqui.",
    fr: "Nous espérons que vous êtes reparti avec un peu du calme d'ici.",
  },
  both: {
    en: "We hope you found both the quiet and the focus you came for.",
    pt: "Esperamos que tenha encontrado o sossego e a concentração que procurava.",
    fr: "Nous espérons que vous avez trouvé le calme et la concentration que vous cherchiez.",
  },
};
