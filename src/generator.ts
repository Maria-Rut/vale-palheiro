import type {
  Channel,
  Language,
  MessageKind,
  Reservation,
} from "./types.ts";
import {
  BRAND,
  GREETING,
  MOTIVE_LINE,
  SIGNOFF,
} from "./brand.ts";
import {
  postStayPreferencesLine,
  preferencesUrl,
  welcomePreferencesLine,
  wifiLine,
} from "./preferences.ts";

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

const SUBJECTS: Record<MessageKind, Record<Language, string>> = {
  preferences: {
    en: "Let's prepare your stay",
    pt: "Vamos preparar a sua estadia",
    fr: "Préparons votre séjour",
  },
  pre_stay: {
    en: "The valley is ready for you",
    pt: "O vale está pronto para si",
    fr: "La vallée vous attend",
  },
  post_stay: {
    en: "Thank you for staying with us",
    pt: "Obrigado pela sua estadia",
    fr: "Merci pour votre séjour",
  },
};

/**
 * Adds a personal line to a message: as its own paragraph before the sign-off
 * in an email, or appended to the single paragraph of a short message.
 */
function weaveIn(body: string, line: string, short: boolean): string {
  if (!line) return body;
  if (short) return `${body} ${line}`;
  const paras = body.split("\n\n");
  // Insert before the final two paragraphs (closing line + sign-off).
  paras.splice(Math.max(1, paras.length - 2), 0, line);
  return paras.join("\n\n");
}

export class TemplateGenerator implements Generator {
  async generate(input: GenerationInput): Promise<GeneratedMessage> {
    const { reservation: r, kind, channel, language } = input;
    const name = r.guest.firstName;
    const motiveLine = kind === "preferences" ? "" : MOTIVE_LINE[kind][r.motive][language];
    const short = channel !== "email";

    let body: string;
    if (kind === "preferences") {
      body = this.preferencesInvite(r, language, short);
    } else if (kind === "pre_stay") {
      body = this.preStay(name, r.accommodation, language, motiveLine, short, r.checkIn, r.breakfastIncluded);
      body = weaveIn(body, welcomePreferencesLine(r, language), short);
      body = weaveIn(body, wifiLine(language), short);
    } else {
      body = this.postStay(name, language, motiveLine, short);
      body = weaveIn(body, postStayPreferencesLine(r, language), short);
    }

    return {
      subject: short ? undefined : SUBJECTS[kind][language],
      body,
      generatedBy: "template",
    };
  }

  /**
   * The "let's prepare your stay" invite. Framed as a treat, not a form: the
   * guest is told everything is already set and they only change what they like.
   */
  private preferencesInvite(r: Reservation, lang: Language, short: boolean): string {
    const name = r.guest.firstName;
    const link = preferencesUrl(r);
    const place = r.accommodation;

    if (lang === "pt") {
      if (short) {
        return `${GREETING.pt(name)}, estamos a preparar ${place} para si. Bebidas no frigorífico, lareira, experiências — ajuste em 30 segundos: ${link}`;
      }
      return [
        GREETING.pt(name) + ",",
        "",
        `Já começámos a preparar ${place} para a sua chegada.`,
        "",
        "Deixámos tudo como a maioria dos nossos hóspedes gosta: a lareira pronta a acender e água fresca no frigorífico. Apetece-lhe uma garrafa de vinho da região, uma cama extra, um passeio a cavalo ao pôr do sol? Basta ajustar aqui:",
        "",
        link,
        "",
        "Demora cerca de 30 segundos. Se estiver tudo bem assim, não precisa de fazer nada.",
        "",
        SIGNOFF.pt,
      ].join("\n");
    }
    if (lang === "fr") {
      if (short) {
        return `${GREETING.fr(name)}, nous préparons ${place} pour vous. Boissons au frais, cheminée, expériences — ajustez en 30 secondes : ${link}`;
      }
      return [
        GREETING.fr(name) + ",",
        "",
        `Nous avons déjà commencé à préparer ${place} pour votre arrivée.`,
        "",
        "Tout est réglé comme la plupart de nos hôtes l'aiment : la cheminée prête à être allumée et de l'eau fraîche au réfrigérateur. Envie d'une bouteille de vin de la région, d'un lit supplémentaire, d'une balade à cheval au coucher du soleil ? Il suffit d'ajuster ici :",
        "",
        link,
        "",
        "Cela prend environ 30 secondes. Si tout vous convient, vous n'avez rien à faire.",
        "",
        SIGNOFF.fr,
      ].join("\n");
    }
    if (short) {
      return `${GREETING.en(name)}, we're preparing ${place} for you. Drinks in the fridge, the fireplace, experiences — adjust it all in 30 seconds: ${link}`;
    }
    return [
      GREETING.en(name) + ",",
      "",
      `We've started preparing ${place} for your arrival.`,
      "",
      "We've set it up the way most of our guests love it: the fireplace laid and ready to light, and fresh water in the fridge. Fancy a bottle of regional wine, an extra bed, or a sunset horse ride? Just adjust it here:",
      "",
      link,
      "",
      "It takes about 30 seconds. If everything sounds right, there's nothing you need to do.",
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
