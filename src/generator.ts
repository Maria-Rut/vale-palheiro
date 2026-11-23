import type {
  Channel,
  Language,
  MessageKind,
  Reservation,
  ResortEvent,
} from "./types.ts";
import { GREETING, LOCALE, OCCASION, POST_STAY_LINE, SIGNOFF } from "./brand.ts";
import { prop } from "./property.ts";
import { RESORT_TZ } from "./timezone.ts";

/**
 * Message generation.
 *
 * Two generators share one interface:
 *   - TemplateGenerator: offline, deterministic, always available. Used in the
 *     demo and as a reliable fallback in production.
 *   - LlmGenerator: calls a hosted model for extra warmth and variety. Enabled
 *     only when an API key is configured (see createGenerator()).
 *
 * Personalisation only uses facts we actually hold about the booking (name,
 * accommodation, dates, party, occasion, past stays, events during the stay)
 * plus the property info staff maintain. Nothing is invented.
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
  /** Guest has stayed with us before this reservation. */
  returning: boolean;
  /** Calendar events that fall inside this stay. */
  eventsDuringStay: ResortEvent[];
  /** For event invites. */
  event?: ResortEvent;
}

export interface Generator {
  generate(input: GenerationInput): Promise<GeneratedMessage>;
}

// ---------------------------------------------------------------- formatting

function day(iso: string, lang: Language): string {
  return new Intl.DateTimeFormat(LOCALE[lang], {
    weekday: "long", day: "numeric", month: "long", timeZone: RESORT_TZ,
  }).format(new Date(iso));
}
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function shortDay(iso: string, lang: Language): string {
  return new Intl.DateTimeFormat(LOCALE[lang], {
    weekday: "short", day: "numeric", month: "short", timeZone: RESORT_TZ,
  }).format(new Date(iso));
}
function time(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit", minute: "2-digit", timeZone: RESORT_TZ, hourCycle: "h23",
  }).format(new Date(iso));
}

/** "Casa Lyra" or "Suite 4". */
export function placeLabel(r: Reservation): string {
  return r.unit ? `${r.accommodation} ${r.unit}` : r.accommodation;
}

function party(r: Reservation, lang: Language): string {
  const a = r.adults, c = r.children;
  if (lang === "pt") {
    const ad = `${a} ${a === 1 ? "adulto" : "adultos"}`;
    return c ? `${ad} e ${c} ${c === 1 ? "criança" : "crianças"}` : ad;
  }
  if (lang === "fr") {
    const ad = `${a} ${a === 1 ? "adulte" : "adultes"}`;
    return c ? `${ad} et ${c} ${c === 1 ? "enfant" : "enfants"}` : ad;
  }
  const ad = `${a} ${a === 1 ? "adult" : "adults"}`;
  return c ? `${ad} and ${c} ${c === 1 ? "child" : "children"}` : ad;
}

function headcountPhrase(r: Reservation, lang: Language): string {
  const n = r.adults + r.children;
  if (lang === "pt") return n === 1 ? "para si" : n === 2 ? "para os dois" : `para os ${n}`;
  if (lang === "fr") return n === 1 ? "pour vous" : n === 2 ? "pour vous deux" : `pour vous ${n}`;
  if (n === 1) return "for you";
  if (n === 2) return "for the two of you";
  const words = ["", "", "", "three", "four", "five", "six", "seven", "eight"];
  return `for the ${words[n] ?? n} of you`;
}

function eventLine(e: ResortEvent, lang: Language): string {
  return `• ${e.title[lang]} — ${shortDay(e.start, lang)}, ${time(e.start)} · ${e.place}`;
}

const lines = (...parts: (string | false | undefined)[]) =>
  parts.filter((p) => p !== false && p !== undefined).join("\n");

// ---------------------------------------------------------------- templates

export class TemplateGenerator implements Generator {
  async generate(input: GenerationInput): Promise<GeneratedMessage> {
    const short = input.channel !== "email";
    const out = (() => {
      switch (input.kind) {
        case "pre_arrival": return preArrival(input);
        case "arrival_day": return short ? arrivalDayShort(input) : arrivalDay(input);
        case "in_stay": return inStay(input);
        case "post_stay": return postStay(input);
        case "event_invite": return eventInvite(input);
      }
    })();
    return { ...out, subject: short ? undefined : out.subject, generatedBy: "template" };
  }
}

type Copy = { subject: string; body: string };

/** 3 days before: the room is being prepared, we can't wait. */
function preArrival({ reservation: r, language: l, returning, eventsDuringStay }: GenerationInput): Copy {
  const p = prop();
  const place = placeLabel(r);
  const name = r.guest.firstName;
  const occ = r.occasion ? OCCASION[r.occasion][l] : undefined;
  const ev = eventsDuringStay.map((e) => eventLine(e, l));
  const stay = `${shortDay(r.checkIn, l)} – ${shortDay(r.checkOut, l)}`;

  if (l === "pt") {
    return {
      subject: returning ? `Bem-vindo de volta, ${name}` : "Faltam três dias — estamos a preparar tudo",
      body: lines(
        GREETING.pt(name), "",
        `Daqui a três dias recebemo-lo no vale. ${place} está a ser preparada ${headcountPhrase(r, l)} e estamos muito contentes por o ter connosco.`,
        returning && "\nÉ uma alegria tê-lo de volta. Como agradecimento por regressar, terá um pequeno presente de boas-vindas à sua espera.",
        occ && `\nSabemos que esta estadia assinala ${occ} — gostaríamos muito de ajudar a torná-la especial. Se tiver alguma ideia, diga-nos.`,
        ev.length > 0 && `\nDurante a sua estadia:\n${ev.join("\n")}\nOs nossos hóspedes têm prioridade — responda e guardamos-lhe lugar.`,
        "",
        `A sua estadia: ${stay} · ${place} · ${party(r, l)}${r.breakfastIncluded ? " · pequeno-almoço incluído" : ""}`,
        "",
        `Para prepararmos tudo, responda com a sua hora prevista de chegada e qualquer pedido especial. A receção está aberta (${p.receptionHours}); se chegar mais tarde, avise-nos e alguém estará à sua espera.`,
        "", SIGNOFF.pt,
      ),
    };
  }
  if (l === "fr") {
    return {
      subject: returning ? `Bon retour parmi nous, ${name}` : "Plus que trois jours — nous préparons tout",
      body: lines(
        GREETING.fr(name), "",
        `Dans trois jours, nous vous accueillerons dans la vallée. ${place} est en cours de préparation ${headcountPhrase(r, l)}, et nous avons hâte de vous recevoir.`,
        returning && "\nQuel plaisir de vous revoir. Pour vous remercier de revenir, un petit cadeau de bienvenue vous attendra.",
        occ && `\nNous savons que ce séjour marque ${occ} — nous aimerions beaucoup contribuer à le rendre spécial. Si vous avez une idée en tête, dites-le-nous.`,
        ev.length > 0 && `\nPendant votre séjour :\n${ev.join("\n")}\nNos hôtes sont prioritaires — répondez-nous et nous vous réservons une place.`,
        "",
        `Votre séjour : ${stay} · ${place} · ${party(r, l)}${r.breakfastIncluded ? " · petit-déjeuner inclus" : ""}`,
        "",
        `Pour tout préparer, répondez-nous simplement avec votre heure d'arrivée prévue et vos éventuelles demandes. La réception est ouverte (${p.receptionHours}) ; si vous arrivez plus tard, prévenez-nous et quelqu'un vous attendra.`,
        "", SIGNOFF.fr,
      ),
    };
  }
  return {
    subject: returning ? `Welcome back, ${name}` : "Three days to go — we're getting ready for you",
    body: lines(
      GREETING.en(name), "",
      `In three days we'll welcome you to the valley. ${place} is being prepared ${headcountPhrase(r, l)}, and we're really looking forward to having you here.`,
      returning && "\nIt's lovely to have you back. As a thank-you for returning, a small welcome-back gift will be waiting for you.",
      occ && `\nWe know this stay marks ${occ} — we'd love to help make it special. If there's anything you have in mind, just tell us.`,
      ev.length > 0 && `\nWhile you're here:\n${ev.join("\n")}\nGuests staying with us have priority — reply and we'll keep you a place.`,
      "",
      `Your stay: ${stay} · ${place} · ${party(r, l)}${r.breakfastIncluded ? " · breakfast included" : ""}`,
      "",
      `To help us prepare, just reply with your expected arrival time and anything you'd like us to arrange. Reception is open ${p.receptionHours}; if you'll arrive later, let us know and someone will be there for you.`,
      "", SIGNOFF.en,
    ),
  };
}

/** ~3 hours before arrival: the practical details. */
function arrivalDay({ reservation: r, language: l }: GenerationInput): Copy {
  const p = prop();
  const place = placeLabel(r);
  const name = r.guest.firstName;
  const arrive = time(r.checkIn);

  if (l === "pt") {
    return {
      subject: "Hoje: tudo para a sua chegada",
      body: lines(
        GREETING.pt(name), "",
        "Até daqui a pouco. Aqui fica tudo o que precisa para hoje:", "",
        `• O seu alojamento: ${place}`,
        `• Onde o esperamos: ${p.meetingPoint}, o nosso espaço de boas-vindas — daí acompanhamo-lo até à ${place}`,
        `• Como chegar: ${p.directionsPt}`,
        `• Mapa: ${p.mapsLink}`,
        `• Receção: ${p.receptionHours}. Se chegar depois, ligue para ${p.emergencyPhone} e estaremos lá.`,
        `• Alguma dúvida pelo caminho: ${p.whatsappNumber} (WhatsApp) ou ${p.receptionPhone}`,
        "", `Contamos consigo por volta das ${arrive}. Boa viagem.`,
        "", SIGNOFF.pt,
      ),
    };
  }
  if (l === "fr") {
    return {
      subject: `Aujourd'hui : tout pour votre arrivée à ${place}`,
      body: lines(
        GREETING.fr(name), "",
        "À tout à l'heure. Voici l'essentiel pour aujourd'hui :", "",
        `• Votre hébergement : ${place}`,
        `• Où nous vous attendons : ${p.meetingPoint}, notre espace d'accueil — nous vous accompagnerons ensuite jusqu'à ${place}`,
        `• Pour venir : ${p.directionsFr}`,
        `• Plan : ${p.mapsLink}`,
        `• Réception : ${p.receptionHours}. Si vous arrivez plus tard, appelez le ${p.emergencyPhone} et nous serons là.`,
        `• Une question en route : ${p.whatsappNumber} (WhatsApp) ou ${p.receptionPhone}`,
        "", `Nous vous attendons vers ${arrive}. Bonne route.`,
        "", SIGNOFF.fr,
      ),
    };
  }
  return {
    subject: `Today: everything for your arrival at ${place}`,
    body: lines(
      GREETING.en(name), "",
      "See you in a few hours. Here's everything you need for today:", "",
      `• Your accommodation: ${place}`,
      `• Where we'll meet you: ${p.meetingPoint}, our welcome lounge — we'll walk you to ${place} from there`,
      `• Getting here: ${p.directions}`,
      `• Map: ${p.mapsLink}`,
      `• Reception: ${p.receptionHours}. Arriving later? Call ${p.emergencyPhone} and we'll be there.`,
      `• Questions on the way: ${p.whatsappNumber} (WhatsApp) or ${p.receptionPhone}`,
      "", `We're expecting you around ${arrive}. Travel safely.`,
      "", SIGNOFF.en,
    ),
  };
}

function arrivalDayShort({ reservation: r, language: l }: GenerationInput): Copy {
  const p = prop();
  const place = placeLabel(r);
  const name = r.guest.firstName;
  const body =
    l === "pt"
      ? `Olá ${name}, até já. Esperamo-lo na ${p.meetingPoint} e acompanhamo-lo até à ${place}. Mapa: ${p.mapsLink} · Dúvidas: ${p.whatsappNumber} — Vale Palheiro`
      : l === "fr"
        ? `Bonjour ${name}, à tout à l'heure. Nous vous attendons à ${p.meetingPoint} et vous accompagnerons jusqu'à ${place}. Plan : ${p.mapsLink} · Questions : ${p.whatsappNumber} — Vale Palheiro`
        : `Hi ${name}, see you soon. We'll meet you at ${p.meetingPoint} and walk you to ${place}. Map: ${p.mapsLink} · Questions: ${p.whatsappNumber} — Vale Palheiro`;
  return { subject: "", body };
}

/** After check-in: the things to keep handy, and what's on. */
function inStay({ reservation: r, language: l, eventsDuringStay }: GenerationInput): Copy {
  const p = prop();
  const place = placeLabel(r);
  const name = r.guest.firstName;
  const ev = eventsDuringStay.map((e) => eventLine(e, l));
  const out = shortDay(r.checkOut, l);

  if (l === "pt") {
    return {
      subject: "Para ter à mão durante a estadia",
      body: lines(
        GREETING.pt(name), "",
        `Bem-vindo — esperamos que já se sinta em casa na ${place}. Algumas coisas para ter à mão:`, "",
        `Wi-Fi: ${p.wifiNetwork} · palavra-passe ${p.wifiPassword}`,
        r.breakfastIncluded
          ? `Pequeno-almoço: ${p.breakfastHours} (incluído)`
          : `Pequeno-almoço: ${p.breakfastHours} — pode acrescentá-lo a qualquer momento`,
        `The Barn (jantar): ${p.restaurantHours} — responda para reservar mesa`,
        `Receção: ${p.receptionPhone} (${p.receptionHours}) · Fora de horas: ${p.emergencyPhone}`,
        `Check-out: ${p.checkOutTime}, ${out}`,
        "",
        ev.length > 0 ? `Durante a sua estadia:\n${ev.join("\n")}` : "",
        "Também podemos marcar uma massagem no spa ou sugerir um troço da Rota Vicentina — é só pedir.",
        "", SIGNOFF.pt,
      ).replace(/\n\n\n/g, "\n\n"),
    };
  }
  if (l === "fr") {
    return {
      subject: "À garder sous la main pendant votre séjour",
      body: lines(
        GREETING.fr(name), "",
        `Bienvenue — nous espérons que vous vous sentez déjà chez vous à ${place}. Quelques informations utiles :`, "",
        `Wi-Fi : ${p.wifiNetwork} · mot de passe ${p.wifiPassword}`,
        r.breakfastIncluded
          ? `Petit-déjeuner : ${p.breakfastHours} (inclus)`
          : `Petit-déjeuner : ${p.breakfastHours} — vous pouvez l'ajouter à tout moment`,
        `The Barn (dîner) : ${p.restaurantHours} — répondez-nous pour réserver une table`,
        `Réception : ${p.receptionPhone} (${p.receptionHours}) · En dehors des horaires : ${p.emergencyPhone}`,
        `Départ : ${p.checkOutTime}, ${out}`,
        "",
        ev.length > 0 ? `Pendant votre séjour :\n${ev.join("\n")}` : "",
        "Nous pouvons aussi réserver un massage au spa ou vous conseiller une étape de la Rota Vicentina — il suffit de demander.",
        "", SIGNOFF.fr,
      ).replace(/\n\n\n/g, "\n\n"),
    };
  }
  return {
    subject: "Good to have to hand during your stay",
    body: lines(
      GREETING.en(name), "",
      `Welcome — we hope ${place} already feels like home. A few things to keep handy:`, "",
      `Wi-Fi: ${p.wifiNetwork} · password ${p.wifiPassword}`,
      r.breakfastIncluded
        ? `Breakfast: ${p.breakfastHours} (included)`
        : `Breakfast: ${p.breakfastHours} — you can add it any time`,
      `The Barn (dinner): ${p.restaurantHours} — reply to book a table`,
      `Reception: ${p.receptionPhone} (${p.receptionHours}) · Out of hours: ${p.emergencyPhone}`,
      `Check-out: ${p.checkOutTime}, ${out}`,
      "",
      ev.length > 0 ? `While you're here:\n${ev.join("\n")}` : "",
      "We can also book a massage at the spa or suggest a stretch of the Rota Vicentina — just ask.",
      "", SIGNOFF.en,
    ).replace(/\n\n\n/g, "\n\n"),
  };
}

/** After check-out: thank you + a quick review. */
function postStay({ reservation: r, language: l, returning }: GenerationInput): Copy {
  const p = prop();
  const place = placeLabel(r);
  const name = r.guest.firstName;
  const motive = POST_STAY_LINE[r.motive][l];

  if (l === "pt") {
    return {
      subject: `Obrigado, ${name}`,
      body: lines(
        GREETING.pt(name), "",
        `Obrigado por ter ficado connosco na ${place}${returning ? " — e por ter voltado" : ""}. ${motive}`, "",
        "Se tiver um minuto, uma breve avaliação significa muito para um lugar pequeno e independente como o nosso:",
        p.reviewLink, "",
        "Quando quiser voltar, o vale estará aqui — e nós também.",
        "", SIGNOFF.pt,
      ),
    };
  }
  if (l === "fr") {
    return {
      subject: `Merci, ${name}`,
      body: lines(
        GREETING.fr(name), "",
        `Merci d'avoir séjourné à ${place}${returning ? " — et d'être revenu" : ""}. ${motive}`, "",
        "Si vous avez une minute, un court avis compte beaucoup pour une petite maison indépendante comme la nôtre :",
        p.reviewLink, "",
        "Quand vous voudrez revenir, la vallée sera là — et nous aussi.",
        "", SIGNOFF.fr,
      ),
    };
  }
  return {
    subject: `Thank you, ${name}`,
    body: lines(
      GREETING.en(name), "",
      `Thank you for staying with us in ${place}${returning ? " — and for coming back" : ""}. ${motive}`, "",
      "If you have a minute, a short review means a great deal to a small, independent place like ours:",
      p.reviewLink, "",
      "Whenever you'd like to return, the valley will be here — and so will we.",
      "", SIGNOFF.en,
    ),
  };
}

/** To opted-in past guests: an upcoming event, and a welcome-back gift if they come. */
function eventInvite({ reservation: r, language: l, event }: GenerationInput): Copy {
  if (!event) throw new Error("event_invite needs an event");
  const name = r.guest.firstName;
  const when = `${cap(day(event.start, l))}, ${time(event.start)}`;

  if (l === "pt") {
    return {
      subject: `${event.title.pt} — ${shortDay(event.start, l)}`,
      body: lines(
        GREETING.pt(name), "",
        "Esperamos que esteja bem desde a sua estadia connosco.", "",
        `${when}: ${event.title.pt}, no ${event.place}. ${event.description.pt}`, "",
        "Se quiser juntar-se a nós, responda e guardamos-lhe lugar. E se quiser ficar uns dias, como hóspede que regressa terá um presente de boas-vindas à sua espera.",
        "", SIGNOFF.pt, "",
        "Recebe esta mensagem porque aceitou ter notícias nossas. Responda \"cancelar\" e deixamos de escrever.",
      ),
    };
  }
  if (l === "fr") {
    return {
      subject: `${event.title.fr} — ${shortDay(event.start, l)}`,
      body: lines(
        GREETING.fr(name), "",
        "Nous espérons que vous allez bien depuis votre séjour parmi nous.", "",
        `${when} : ${event.title.fr}, à ${event.place}. ${event.description.fr}`, "",
        "Si vous souhaitez vous joindre à nous, répondez-nous et nous vous gardons une place. Et si vous restez quelques jours, un cadeau de bienvenue vous attendra pour vous remercier de revenir.",
        "", SIGNOFF.fr, "",
        "Vous recevez ce message car vous avez accepté d'avoir de nos nouvelles. Répondez « désinscrire » et nous ne vous écrirons plus.",
      ),
    };
  }
  return {
    subject: `${event.title.en} — ${shortDay(event.start, l)}`,
    body: lines(
      GREETING.en(name), "",
      "We hope you've been well since your stay with us.", "",
      `${when}: ${event.title.en}, at ${event.place}. ${event.description.en}`, "",
      "If you'd like to join us, reply and we'll keep you a place. And if you'd like to stay a few nights, a welcome-back gift will be waiting for you as a thank-you for returning.",
      "", SIGNOFF.en, "",
      "You're receiving this because you agreed to hear from us. Reply \"unsubscribe\" and we won't write again.",
    ),
  };
}

// ---------------------------------------------------------------- LLM seam

/**
 * Production generator that would call a hosted LLM. In this prototype there is
 * no key, so it is never actually used — but the seam is here so that enabling
 * it is a config change, not a rewrite.
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
      void this.apiKey;
      throw new Error("LLM disabled in this environment");
    } catch {
      return this.fallback.generate(input);
    }
  }
}

/** Picks a generator based on environment. Template-only by default. */
export function createGenerator(): Generator {
  const key = process.env.OPENAI_API_KEY;
  if (key) return new LlmGenerator(key);
  return new TemplateGenerator();
}
