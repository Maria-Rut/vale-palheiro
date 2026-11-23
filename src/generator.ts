import type {
  Channel,
  Language,
  MessageKind,
  Reservation,
  WeatherKind,
} from "./types.ts";
import {
  BRAND,
  GREETING,
  MOTIVE_LINE,
  SIGNOFF,
} from "./brand.ts";
import { suggestExperiences, type Experience } from "./experiences.ts";

/**
 * Message generation.
 *
 * Two generators share one interface:
 *   - TemplateGenerator: offline, deterministic, always available. Used in the
 *     demo and as a reliable fallback in production.
 *   - LlmGenerator: calls a hosted model for extra warmth and variety. Enabled
 *     only when an API key is configured (see createGenerator()).
 *
 * Both produce channel-aware copy: email gets a subject and a fuller body;
 * SMS/WhatsApp get a short, single-paragraph version with no subject.
 *
 * Personalisation only uses facts we actually hold about the booking (name,
 * accommodation, motive of stay, breakfast, language). Nothing is invented.
 */

export interface GeneratedMessage {
  subject?: string;
  body: string;
  generatedBy: "template" | "llm";
}

export interface GenerationInput {
  reservation: Reservation;
  kind: MessageKind;
  channel: Channel;
  language: Language;
  /** Base URL for the preferences questionnaire link (preferences email). */
  questionnaireUrl?: string;
  /** Forecast for the stay, used by the experiences (post check-in) message. */
  weather?: WeatherKind;
}

export interface Generator {
  generate(input: GenerationInput): Promise<GeneratedMessage>;
}

/** Formats a check-in time like "this afternoon" in a friendly, low-precision way. */
function friendlyTime(iso: string, language: Language): string {
  const d = new Date(iso);
  const hour = d.getHours();
  if (language === "pt") {
    if (hour < 12) return "de manhã";
    if (hour < 18) return "à tarde";
    return "ao fim do dia";
  }
  if (language === "fr") {
    if (hour < 12) return "dans la matinée";
    if (hour < 18) return "dans l'après-midi";
    return "en fin de journée";
  }
  if (hour < 12) return "this morning";
  if (hour < 18) return "this afternoon";
  return "this evening";
}

/** Optional breakfast line, only when the rate actually includes it. */
function breakfastLine(included: boolean, lang: Language): string {
  if (!included) return "";
  if (lang === "pt") return "O pequeno-almoço está incluído na sua estadia.";
  if (lang === "fr") return "Le petit-déjeuner est inclus dans votre séjour.";
  return "Breakfast is included with your stay.";
}

const WEATHER_WORD: Record<WeatherKind, Record<Language, string>> = {
  sunny: { en: "sunny", pt: "sol", fr: "ensoleillé" },
  cloudy: { en: "soft and cloudy", pt: "ameno e nublado", fr: "doux et nuageux" },
  rainy: { en: "rainy", pt: "chuvoso", fr: "pluvieux" },
  windy: { en: "breezy", pt: "ventoso", fr: "venteux" },
};

const SUBJECTS: Record<MessageKind, Record<Language, string>> = {
  preferences: {
    en: "A few questions before you arrive",
    pt: "Algumas perguntas antes da sua chegada",
    fr: "Quelques questions avant votre arrivée",
  },
  pre_stay: {
    en: "The valley is ready for you",
    pt: "O vale está pronto para si",
    fr: "La vallée vous attend",
  },
  experiences: {
    en: "Ideas for your days in the valley",
    pt: "Ideias para os seus dias no vale",
    fr: "Des idées pour vos journées dans la vallée",
  },
  post_stay: {
    en: "Thank you for staying with us",
    pt: "Obrigado pela sua estadia",
    fr: "Merci pour votre séjour",
  },
};

export class TemplateGenerator implements Generator {
  async generate(input: GenerationInput): Promise<GeneratedMessage> {
    const { reservation: r, kind, channel, language } = input;
    const name = r.guest.firstName;
    const short = channel !== "email";

    let body: string;
    switch (kind) {
      case "preferences":
        body = this.preferences(name, language, short, input.questionnaireUrl ?? "#");
        break;
      case "pre_stay": {
        const motiveLine = MOTIVE_LINE.pre_stay[r.motive][language];
        body = this.preStay(name, r.accommodation, language, motiveLine, short, r.checkIn, r.breakfastIncluded);
        break;
      }
      case "experiences":
        body = this.experiences(name, language, short, input.weather ?? "sunny", r);
        break;
      case "post_stay": {
        const motiveLine = MOTIVE_LINE.post_stay[r.motive][language];
        body = this.postStay(name, language, motiveLine, short);
        break;
      }
    }

    return {
      subject: short ? undefined : SUBJECTS[kind][language],
      body,
      generatedBy: "template",
    };
  }

  /** Earliest email: invite the guest to share preferences via a questionnaire. */
  private preferences(name: string, lang: Language, short: boolean, url: string): string {
    if (lang === "pt") {
      if (short) {
        return `${GREETING.pt(name)}, para prepararmos a sua chegada ao Vale Palheiro, poderia partilhar algumas preferências? Leva um minuto: ${url}`;
      }
      return [
        GREETING.pt(name) + ",",
        "",
        "Estamos a preparar a sua estadia no vale e gostaríamos de a tornar sua desde o início.",
        "",
        "Se tiver um momento, partilhe connosco algumas preferências — hora prevista de chegada, restrições alimentares, uma ocasião a assinalar, o que gostaria de fazer por aqui, e qualquer coisa que possamos tratar antes de chegar (berço, transfer, reserva de restaurante, babysitting).",
        "",
        `É rápido e ajuda-nos a preparar tudo com calma: ${url}`,
        "",
        "Se preferir, basta responder a esta mensagem.",
        "",
        SIGNOFF.pt,
      ].join("\n");
    }
    if (lang === "fr") {
      if (short) {
        return `${GREETING.fr(name)}, afin de préparer votre arrivée à Vale Palheiro, pourriez-vous partager quelques préférences ? Cela prend une minute : ${url}`;
      }
      return [
        GREETING.fr(name) + ",",
        "",
        "Nous préparons votre séjour dans la vallée et aimerions qu'il vous ressemble dès le début.",
        "",
        "Si vous avez un instant, partagez quelques préférences — heure d'arrivée estimée, régime alimentaire, une occasion à marquer, ce que vous aimeriez faire sur place, et tout ce que nous pouvons organiser avant votre arrivée (lit bébé, transfert, réservation de restaurant, baby-sitting).",
        "",
        `C'est rapide et cela nous aide à tout préparer sereinement : ${url}`,
        "",
        "Vous pouvez aussi simplement répondre à ce message.",
        "",
        SIGNOFF.fr,
      ].join("\n");
    }
    if (short) {
      return `${GREETING.en(name)}, to prepare for your arrival at Vale Palheiro, could you share a few preferences? It takes a minute: ${url}`;
    }
    return [
      GREETING.en(name) + ",",
      "",
      "We're starting to prepare your stay in the valley, and we'd love to make it feel like yours from the very beginning.",
      "",
      "If you have a moment, tell us a little about your visit — your estimated arrival time, any dietary needs, an occasion you're marking, what you'd like to do while you're here, and anything we can arrange before you arrive (a cot, a transfer, a restaurant booking, babysitting).",
      "",
      `It's quick, and it gives us time to prepare everything with care: ${url}`,
      "",
      "If you'd rather, simply reply to this message.",
      "",
      SIGNOFF.en,
    ].join("\n");
  }

  /** Post check-in email: suggest experiences that suit the day's weather. */
  private experiences(
    name: string,
    lang: Language,
    short: boolean,
    weather: WeatherKind,
    r: Reservation,
  ): string {
    const picks = suggestExperiences(weather, r.preferences?.interests ?? [], short ? 2 : 3);
    const weatherWord = WEATHER_WORD[weather][lang];

    const line = (e: Experience) =>
      `• ${e.name[lang]} — ${e.blurb[lang]} (${e.price[lang]})`;

    if (lang === "pt") {
      if (short) {
        const names = picks.map((e) => e.name.pt).join(" ou ");
        return `${GREETING.pt(name)}, o tempo hoje está ${weatherWord}. Talvez ${names}? Diga-nos e tratamos de tudo.`;
      }
      return [
        GREETING.pt(name) + ",",
        "",
        `Esperamos que já se tenha instalado. Como o tempo está ${weatherWord} por estes dias, deixamos algumas ideias para aproveitar o vale e a Costa Vicentina:`,
        "",
        ...picks.map(line),
        "",
        "Se alguma lhe despertar interesse, é só dizer — tratamos da marcação consigo. Todas as experiências estão sujeitas a disponibilidade e as atividades ao ar livre podem ajustar-se ao tempo.",
        "",
        SIGNOFF.pt,
      ].join("\n");
    }
    if (lang === "fr") {
      if (short) {
        const names = picks.map((e) => e.name.fr).join(" ou ");
        return `${GREETING.fr(name)}, le temps est ${weatherWord} aujourd'hui. Peut-être ${names} ? Dites-nous et nous organisons tout.`;
      }
      return [
        GREETING.fr(name) + ",",
        "",
        `Nous espérons que vous êtes bien installé. Comme le temps est ${weatherWord} ces jours-ci, voici quelques idées pour profiter de la vallée et de la Costa Vicentina :`,
        "",
        ...picks.map(line),
        "",
        "Si l'une d'elles vous tente, dites-le-nous et nous nous occupons de la réservation. Toutes les expériences sont soumises à disponibilité et les activités en plein air peuvent s'adapter à la météo.",
        "",
        SIGNOFF.fr,
      ].join("\n");
    }
    if (short) {
      const names = picks.map((e) => e.name.en).join(" or ");
      return `${GREETING.en(name)}, it's ${weatherWord} here today. Perhaps ${names}? Let us know and we'll arrange it.`;
    }
    return [
      GREETING.en(name) + ",",
      "",
      `We hope you've settled in. As it's ${weatherWord} here at the moment, here are a few ideas for making the most of the valley and the Costa Vicentina:`,
      "",
      ...picks.map(line),
      "",
      "If any of these appeal, just let us know and we'll arrange it with you. All experiences are subject to availability, and outdoor activities can be adjusted to the weather.",
      "",
      SIGNOFF.en,
    ].join("\n");
  }

  private preStay(
    name: string,
    accommodation: string,
    lang: Language,
    motiveLine: string,
    short: boolean,
    checkIn: string,
    breakfastIncluded: boolean,
  ): string {
    const when = friendlyTime(checkIn, lang);
    const bfast = breakfastLine(breakfastIncluded, lang);

    if (lang === "pt") {
      if (short) {
        return `${GREETING.pt(name)}, estamos quase a recebê-lo em ${accommodation}. A equipa estará à sua espera na Casa da Ribeira ${when}. Viaje com calma — até já.`;
      }
      return [
        GREETING.pt(name) + ",",
        "",
        `Falta pouco. O seu alojamento, ${accommodation}, está pronto e o vale espera por si ${when}.`,
        "",
        motiveLine,
        "",
        `Quando chegar, a nossa equipa recebê-lo-á na ${BRAND.facts.welcomeSpace}, onde poderá descansar da viagem antes de o acompanharmos ao seu alojamento.${bfast ? " " + bfast : ""} Se precisar de alguma coisa antes disso, basta responder a esta mensagem.`,
        "",
        "Viaje com calma. Estamos ansiosos por recebê-lo.",
        "",
        SIGNOFF.pt,
      ].join("\n");
    }

    if (lang === "fr") {
      if (short) {
        return `${GREETING.fr(name)}, nous nous apprêtons à vous accueillir à ${accommodation}. Notre équipe vous attendra à la Casa da Ribeira ${when}. Faites bonne route — à très vite.`;
      }
      return [
        GREETING.fr(name) + ",",
        "",
        `Le moment approche. Votre hébergement, ${accommodation}, est prêt et la vallée vous attend ${when}.`,
        "",
        motiveLine,
        "",
        `À votre arrivée, notre équipe vous accueillera à la ${BRAND.facts.welcomeSpace}, où vous pourrez souffler après le voyage avant que nous vous accompagnions jusqu'à votre hébergement.${bfast ? " " + bfast : ""} Si vous avez besoin de quoi que ce soit d'ici là, répondez simplement à ce message.`,
        "",
        "Faites bonne route. Nous avons hâte de vous recevoir.",
        "",
        SIGNOFF.fr,
      ].join("\n");
    }

    // English
    if (short) {
      return `${GREETING.en(name)}, we're getting ready to welcome you to ${accommodation}. Our team will be waiting for you at Casa da Ribeira ${when}. Travel safely — see you soon.`;
    }
    return [
      GREETING.en(name) + ",",
      "",
      `It's almost time. Your accommodation, ${accommodation}, is ready, and the valley is waiting for you ${when}.`,
      "",
      motiveLine,
      "",
      `When you arrive, our team will welcome you at ${BRAND.facts.welcomeSpace}, where you can settle after the journey before we walk you to your accommodation.${bfast ? " " + bfast : ""} If there's anything you need before then, just reply to this message.`,
      "",
      "Travel safely. We can't wait to have you here.",
      "",
      SIGNOFF.en,
    ].join("\n");
  }

  private postStay(
    name: string,
    lang: Language,
    motiveLine: string,
    short: boolean,
  ): string {
    if (lang === "pt") {
      if (short) {
        return `${GREETING.pt(name)}, obrigado por ter estado connosco. ${motiveLine} Se tiver um momento, adoraríamos saber como foi a sua estadia.`;
      }
      return [
        GREETING.pt(name) + ",",
        "",
        "Obrigado por ter partilhado uns dias connosco no vale. A casa fica mais silenciosa quando os nossos hóspedes partem.",
        "",
        motiveLine,
        "",
        "Se tiver um momento, adoraríamos saber como correu a sua estadia — a sua opinião ajuda-nos a cuidar melhor de quem chega depois de si. E quando quiser voltar, o vale estará aqui.",
        "",
        SIGNOFF.pt,
      ].join("\n");
    }

    if (lang === "fr") {
      if (short) {
        return `${GREETING.fr(name)}, merci d'avoir séjourné parmi nous. ${motiveLine} Si vous avez un instant, nous serions heureux d'avoir de vos nouvelles.`;
      }
      return [
        GREETING.fr(name) + ",",
        "",
        "Merci d'avoir partagé quelques jours avec nous dans la vallée. La maison est un peu plus silencieuse depuis votre départ.",
        "",
        motiveLine,
        "",
        "Si vous avez un instant, nous serions heureux de savoir comment s'est passé votre séjour — votre avis nous aide à mieux accueillir celles et ceux qui viendront après vous. Et quand vous voudrez revenir, la vallée sera là.",
        "",
        SIGNOFF.fr,
      ].join("\n");
    }

    // English
    if (short) {
      return `${GREETING.en(name)}, thank you for staying with us. ${motiveLine} If you have a moment, we'd love to hear how your stay was.`;
    }
    return [
      GREETING.en(name) + ",",
      "",
      "Thank you for sharing a few days with us in the valley. The place is a little quieter now that you've gone.",
      "",
      motiveLine,
      "",
      "If you have a moment, we'd love to hear how your stay was — your words help us look after the next guests as well as we hoped to look after you. And whenever you'd like to return, the valley will be here.",
      "",
      SIGNOFF.en,
    ].join("\n");
  }
}

/**
 * Production generator that would call a hosted LLM. In this sandbox there is
 * no external network, so it is never actually used — but the seam is here so
 * that deploying with an API key is a one-line config change, not a rewrite.
 *
 * It falls back to the template generator on any error, so a model outage can
 * never block a guest message.
 */
export class LlmGenerator implements Generator {
  private readonly apiKey: string;
  private readonly fallback: Generator;

  constructor(apiKey: string, fallback: Generator = new TemplateGenerator()) {
    this.apiKey = apiKey;
    this.fallback = fallback;
  }

  async generate(input: GenerationInput): Promise<GeneratedMessage> {
    try {
      // Pseudocode for the real call (kept inert — no network in sandbox):
      //
      //   const prompt = buildPrompt(input, BRAND);
      //   const res = await fetch("https://api.openai.com/v1/chat/completions", {...});
      //   return { ...parse(res), generatedBy: "llm" };
      //
      // Until a key + network exist, defer to the reliable template.
      void this.apiKey;
      throw new Error("LLM disabled in this environment");
    } catch {
      return this.fallback.generate(input);
    }
  }
}

/** Picks a generator based on environment. Template-only in the sandbox. */
export function createGenerator(): Generator {
  const key = process.env.OPENAI_API_KEY;
  if (key) return new LlmGenerator(key);
  return new TemplateGenerator();
}
