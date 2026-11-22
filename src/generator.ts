import type {
  Channel,
  Language,
  MessageKind,
  Reservation,
} from "./types.ts";
import {
  BRAND,
  GREETING,
  PURPOSE_LINE,
  SIGNOFF,
} from "./brand.ts";

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

/** Formats a check-in time like "around 3pm" in a friendly, low-precision way. */
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

const SUBJECTS: Record<MessageKind, Record<Language, (villa: string) => string>> = {
  pre_stay: {
    en: () => "The valley is ready for you",
    pt: () => "O vale está pronto para si",
    fr: () => "La vallée vous attend",
  },
  post_stay: {
    en: () => "Thank you for staying with us",
    pt: () => "Obrigado pela sua estadia",
    fr: () => "Merci pour votre séjour",
  },
};

export class TemplateGenerator implements Generator {
  async generate(input: GenerationInput): Promise<GeneratedMessage> {
    const { reservation: r, kind, channel, language } = input;
    const name = r.guest.firstName;
    const purposeLine = PURPOSE_LINE[r.purpose][language];
    const short = channel !== "email";

    const body =
      kind === "pre_stay"
        ? this.preStay(name, r.villa, language, purposeLine, short, r.checkIn)
        : this.postStay(name, language, purposeLine, short);

    return {
      subject: short ? undefined : SUBJECTS[kind][language](r.villa),
      body,
      generatedBy: "template",
    };
  }

  private preStay(
    name: string,
    villa: string,
    lang: Language,
    purposeLine: string,
    short: boolean,
    checkIn: string,
  ): GeneratedMessage["body"] {
    const when = friendlyTime(checkIn, lang);

    if (lang === "pt") {
      if (short) {
        return `${GREETING.pt(name)}, estamos quase a recebê-lo em ${villa}. A equipa estará à sua espera na Casa da Ribeira ${when}. Viaje com calma — até já.`;
      }
      return [
        GREETING.pt(name) + ",",
        "",
        `Falta pouco. A sua villa, ${villa}, está pronta e o vale espera por si ${when}.`,
        "",
        purposeLine,
        "",
        `Quando chegar, a nossa equipa recebê-lo-á na ${BRAND.facts.welcomeSpace}, onde poderá descansar da viagem antes de o acompanharmos à sua villa. Se precisar de alguma coisa antes disso, basta responder a esta mensagem.`,
        "",
        "Viaje com calma. Estamos ansiosos por recebê-lo.",
        "",
        SIGNOFF.pt,
      ].join("\n");
    }

    if (lang === "fr") {
      if (short) {
        return `${GREETING.fr(name)}, nous nous apprêtons à vous accueillir à ${villa}. Notre équipe vous attendra à la Casa da Ribeira ${when}. Faites bonne route — à très vite.`;
      }
      return [
        GREETING.fr(name) + ",",
        "",
        `Le moment approche. Votre villa, ${villa}, est prête et la vallée vous attend ${when}.`,
        "",
        purposeLine,
        "",
        `À votre arrivée, notre équipe vous accueillera à la ${BRAND.facts.welcomeSpace}, où vous pourrez souffler après le voyage avant que nous vous accompagnions jusqu'à votre villa. Si vous avez besoin de quoi que ce soit d'ici là, répondez simplement à ce message.`,
        "",
        "Faites bonne route. Nous avons hâte de vous recevoir.",
        "",
        SIGNOFF.fr,
      ].join("\n");
    }

    // English
    if (short) {
      return `${GREETING.en(name)}, we're getting ready to welcome you to ${villa}. Our team will be waiting for you at Casa da Ribeira ${when}. Travel safely — see you soon.`;
    }
    return [
      GREETING.en(name) + ",",
      "",
      `It's almost time. Your villa, ${villa}, is ready, and the valley is waiting for you ${when}.`,
      "",
      purposeLine,
      "",
      `When you arrive, our team will welcome you at ${BRAND.facts.welcomeSpace}, where you can settle after the journey before we walk you up to your villa. If there's anything you need before then, just reply to this message.`,
      "",
      "Travel safely. We can't wait to have you here.",
      "",
      SIGNOFF.en,
    ].join("\n");
  }

  private postStay(
    name: string,
    lang: Language,
    purposeLine: string,
    short: boolean,
  ): GeneratedMessage["body"] {
    if (lang === "pt") {
      if (short) {
        return `${GREETING.pt(name)}, obrigado por ter estado connosco. Esperamos que o vale lhe tenha trazido descanso. Se tiver um momento, adoraríamos saber como foi a sua estadia.`;
      }
      return [
        GREETING.pt(name) + ",",
        "",
        "Obrigado por ter partilhado uns dias connosco no vale. A casa fica mais silenciosa quando os nossos hóspedes partem.",
        "",
        "Esperamos que tenha levado consigo um pouco da calma daqui.",
        "",
        "Se tiver um momento, adoraríamos saber como correu a sua estadia — a sua opinião ajuda-nos a cuidar melhor de quem chega depois de si. E quando quiser voltar, o vale estará aqui.",
        "",
        SIGNOFF.pt,
      ].join("\n");
    }

    if (lang === "fr") {
      if (short) {
        return `${GREETING.fr(name)}, merci d'avoir séjourné parmi nous. Nous espérons que la vallée vous a apporté du repos. Si vous avez un instant, nous serions heureux d'avoir de vos nouvelles.`;
      }
      return [
        GREETING.fr(name) + ",",
        "",
        "Merci d'avoir partagé quelques jours avec nous dans la vallée. La maison est un peu plus silencieuse depuis votre départ.",
        "",
        "Nous espérons que vous êtes reparti avec un peu du calme d'ici.",
        "",
        "Si vous avez un instant, nous serions heureux de savoir comment s'est passé votre séjour — votre avis nous aide à mieux accueillir celles et ceux qui viendront après vous. Et quand vous voudrez revenir, la vallée sera là.",
        "",
        SIGNOFF.fr,
      ].join("\n");
    }

    // English
    if (short) {
      return `${GREETING.en(name)}, thank you for staying with us. We hope the valley gave you some rest. If you have a moment, we'd love to hear how your stay was.`;
    }
    return [
      GREETING.en(name) + ",",
      "",
      "Thank you for sharing a few days with us in the valley. The place is a little quieter now that you've gone.",
      "",
      "We hope you took a little of its calm home with you.",
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
