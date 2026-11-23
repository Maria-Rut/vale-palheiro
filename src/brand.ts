import type { Language, Motive } from "./types.ts";

/**
 * Brand voice definition for Vale Palheiro — Earth Resort.
 *
 * Everything here exists to keep messages warm, calm and specific to the place,
 * and to keep them *out* of "spam" territory: no exclamation-heavy hype, no
 * generic marketing lines, concrete references to the valley and the resort.
 *
 * All `facts` below are verified from Vale Palheiro's own site and press
 * coverage — nothing invented. This same object is also handed to the LLM
 * generator as its style guidance when a live model is available in production.
 */

export const BRAND = {
  name: "Vale Palheiro — Earth Resort",
  shortName: "Vale Palheiro",
  signoffName: "The team at Vale Palheiro",
  /** One-line voice guide, reused for the LLM prompt. */
  voice:
    "Calm, warm and unhurried. Grounded in nature and the valley. Speaks like a thoughtful host, never like an advert. Short sentences. No hype, no exclamation marks stacked up, no pushy calls to action.",
  /** Verified, concrete details we can weave in so copy feels real, not generic. */
  facts: {
    location: "the Costa Vicentina, near Aljezur",
    setting: "a 280-acre protected valley beside the Aljezur river",
    welcomeSpace: "Casa da Ribeira", // the welcome lounge where stays begin
    restaurant: "The Barn", // on-site restaurant
    spa: "the spa", // spa / massages on site
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
 * A short, motive-specific line that makes each message feel personal rather
 * than templated — keyed by the guest's real booking "motive of stay" field,
 * so we never guess intent we don't have. It references only verified
 * facilities (The Barn, the spa, the Rota Vicentina, the valley).
 */
export const MOTIVE_LINE: Record<MessageKind_, Record<Motive, Record<Language, string>>> = {
  pre_stay: {
    business: {
      en: "The valley makes for a clear head — a good place to work as well as to rest.",
      pt: "O vale clareia as ideias — um bom lugar para trabalhar e também para descansar.",
      fr: "La vallée éclaircit l'esprit — un bon endroit pour travailler autant que pour se reposer.",
    },
    leisure: {
      en: "The valley is quiet and the pace is slow — exactly as it should be.",
      pt: "O vale está tranquilo e o ritmo é calmo — tal como deve ser.",
      fr: "La vallée est paisible et le rythme est lent — exactement comme il se doit.",
    },
    both: {
      en: "Whether you're here to work or simply to slow down, the valley has room for both.",
      pt: "Quer venha trabalhar ou apenas abrandar, o vale tem espaço para ambos.",
      fr: "Que vous veniez travailler ou simplement ralentir, la vallée a de la place pour les deux.",
    },
  },
  post_stay: {
    business: {
      en: "We hope the valley gave you some space to think.",
      pt: "Esperamos que o vale lhe tenha dado algum espaço para pensar.",
      fr: "Nous espérons que la vallée vous a offert un peu d'espace pour réfléchir.",
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
  },
};

// Local alias to avoid importing MessageKind just for this map's key type.
type MessageKind_ = "pre_stay" | "post_stay";
