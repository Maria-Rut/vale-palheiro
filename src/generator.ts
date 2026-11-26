import type {
  Channel,
  Language,
  MessageKind,
  Reservation,
  ResortEvent,
} from "./types.ts";
import { LOCALE, OCCASION, POST_STAY_LINE } from "./brand.ts";
import { prop, propMinutes } from "./property.ts";
import { expectedArrival, getPreferences, hasMinibar, postStayPreferencesLine, preferencesOpen, preferencesUrl, publicBaseUrl, welcomePreferencesLine } from "./preferences.ts";
import { zonedParts } from "./timezone.ts";
import { fill, getTemplate, toPlainText, type TemplateKey } from "./templates.ts";
import { RESORT_TZ } from "./timezone.ts";
import { renderStayPlan, type StayPlan } from "./recommender.ts";

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
  /** For the welcome (in-stay) email: the recommendation agent's picks. */
  stayPlan?: StayPlan;
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


// ---------------------------------------------------------------- templates

const CITY: Record<string, Partial<Record<Language, string>>> = {
  London: { pt: "Londres", fr: "Londres" }, Lisbon: { pt: "Lisboa", fr: "Lisbonne" },
  Geneva: { pt: "Genebra", fr: "Genève" }, Munich: { pt: "Munique" },
  Edinburgh: { pt: "Edimburgo", fr: "Édimbourg" }, "Kraków": { pt: "Cracóvia", fr: "Cracovie" },
  Amsterdam: { pt: "Amesterdão" }, Zurich: { pt: "Zurique", fr: "Zurich" },
};

/** The values for every {{field}} a template can use, in the guest's language. */
function fieldValues(input: GenerationInput): Record<string, string> {
  const { reservation: r, language: l, returning, eventsDuringStay, stayPlan, event } = input;
  const p = prop();
  const place = placeLabel(r);
  const prefs = getPreferences(r.id);
  const occ = r.occasion ? OCCASION[r.occasion][l] : undefined;
  const ev = eventsDuringStay.map((e) => eventLine(e, l));
  const city = r.guest.city ? (CITY[r.guest.city]?.[l] ?? r.guest.city) : undefined;
  const pick = <T,>(o: Record<Language, T>) => o[l];
  const absolute = (link: string) => (link.startsWith("/") ? publicBaseUrl() + link : link);
  // Arrival: the time they gave us on their page, else the booking's.
  const arrive = expectedArrival(r);
  const ap = zonedParts(arrive, RESORT_TZ);
  const late = ap.hour * 60 + ap.minute >= propMinutes("receptionClose", 20 * 60) || ap.hour < 7;
  const arrivalLine = (): string => {
    if (!prefs?.arrivalTime) {
      if (late) {
        const hhmm = time(arrive.toISOString());
        return pick({
          en: `We have you arriving around ${hhmm}${preferencesOpen(r) ? " — if that changes, just update it on your page" : ""}.`,
          pt: `Temos a sua chegada prevista por volta das ${hhmm}${preferencesOpen(r) ? " — se mudar, atualize-a na sua página" : ""}.`,
          fr: `Nous avons noté votre arrivée vers ${hhmm}${preferencesOpen(r) ? " — si cela change, mettez-la à jour sur votre page" : ""}.`,
        });
      }
      return !preferencesOpen(r) ? "" : pick({
        en: "Let us know your arrival time on your page, so we're ready for you.",
        pt: "Indique-nos a sua hora de chegada na sua página, para estarmos prontos.",
        fr: "Indiquez-nous votre heure d'arrivée sur votre page, pour que nous soyons prêts.",
      });
    }
    const early = prefs.earlyCheckIn ? pick({
      en: ` You asked for early check-in: we'll do our best (${p.earlyCheckIn.toLowerCase()}).`,
      pt: ` Pediu check-in antecipado: faremos o possível (sujeito a disponibilidade).`,
      fr: ` Vous avez demandé une arrivée anticipée : nous ferons de notre mieux (selon disponibilité).`,
    }) : "";
    return pick({
      en: `You told us you'll arrive around ${prefs.arrivalTime} — noted.`,
      pt: `Disse-nos que chega por volta das ${prefs.arrivalTime} — está anotado.`,
      fr: `Vous nous avez indiqué une arrivée vers ${prefs.arrivalTime} — c'est noté.`,
    }) + early;
  };

  const v: Record<string, string> = {
    first_name: r.guest.firstName,
    villa: place,
    stay_dates: `${shortDay(r.checkIn, l)} – ${shortDay(r.checkOut, l)}`,
    party: party(r, l),
    for_party: headcountPhrase(r, l),
    breakfast_note: r.breakfastIncluded ? pick({ en: " · breakfast included", pt: " · pequeno-almoço incluído", fr: " · petit-déjeuner inclus" }) : "",
    arrival_time: time(arrive.toISOString()),
    check_in_time: p.checkInTime,
    arrival_line: arrivalLine(),
    late_arrival_line: !late ? "" : pick({
      en: `As you'll arrive after the front office closes at ${p.receptionClose}, we'll arrange a late check-in for you${p.lateArrivalFee ? ` (a late-arrival fee of ${p.lateArrivalFee} may apply)` : ""}.`,
      pt: `Como vai chegar depois de a receção fechar (${p.receptionClose}), preparamos um check-in tardio para si${p.lateArrivalFee ? ` (pode aplicar-se uma taxa de chegada tardia de ${p.lateArrivalFee})` : ""}.`,
      fr: `Comme vous arriverez après la fermeture de la réception (${p.receptionClose}), nous organiserons une arrivée tardive${p.lateArrivalFee ? ` (des frais d'arrivée tardive de ${p.lateArrivalFee} peuvent s'appliquer)` : ""}.`,
    }),
    restaurant_intro: pick({ en: p.restaurantIntro, pt: p.restaurantIntroPt, fr: p.restaurantIntroFr }),
    bar_line: !p.barHours ? "" : `• ${pick({ en: "Bar", pt: "Bar", fr: "Bar" })}: ${p.barHours}`,
    minibar_line: !hasMinibar(place) || !p.minibarStandard ? "" : pick({
      en: `• In your minibar: ${p.minibarStandard} — ask us for anything else`,
      pt: `• No seu minibar: ${p.minibarStandard} — peça-nos o que mais quiser`,
      fr: `• Dans votre minibar : ${p.minibarStandard} — demandez-nous ce qui vous ferait plaisir`,
    }),
    wellness_line: !p.wellnessInfo ? "" : `• ${pick({ en: "Wellness", pt: "Bem-estar", fr: "Bien-être" })}: ${p.wellnessInfo}${p.wellnessMenuLink ? ` — ${absolute(p.wellnessMenuLink)}` : ""}`,
    brochure_link: absolute(p.brochureLink),
    tripadvisor_link: p.tripadvisorLink,
    checkout: `${p.checkOutTime}, ${shortDay(r.checkOut, l)}`,
    reception_hours: p.receptionHours,
    reception_phone: p.receptionPhone,
    out_of_hours_phone: p.emergencyPhone,
    whatsapp: p.whatsappNumber,
    email: p.email,
    wifi_network: p.wifiNetwork,
    wifi_password: p.wifiPassword,
    meeting_point: p.meetingPoint,
    directions: pick({ en: p.directions, pt: p.directionsPt, fr: p.directionsFr }),
    map_link: p.mapsLink,
    breakfast_line: r.breakfastIncluded
      ? `${p.breakfastHours} ${pick({ en: "(included)", pt: "(incluído)", fr: "(inclus)" })}`
      : `${p.breakfastHours} — ${pick({ en: "you can add it any time", pt: "pode acrescentá-lo a qualquer momento", fr: "vous pouvez l'ajouter à tout moment" })}`,
    dinner_hours: p.restaurantHours,
    review_link: p.reviewLink,

    personalise_link: preferencesOpen(r) ? preferencesUrl(r) : "",
    personalise_intro: !preferencesOpen(r) ? "" : prefs
      ? pick({
          en: "Thank you for telling us how you like things — it's all noted. You can still change anything:",
          pt: "Obrigado por nos dizer como gosta das coisas — já está tudo anotado. Ainda pode mudar o que quiser:",
          fr: "Merci de nous avoir dit comment vous aimez les choses — tout est noté. Vous pouvez encore tout modifier :",
        })
      : pick({
          en: "Tell us your arrival time, any dietary needs or celebration, and add anything you'd like waiting for you — a bottle of regional wine, an extra bed, a plug adapter, a sunset horse ride. It takes a minute.",
          pt: "Diga-nos a hora de chegada, as suas necessidades alimentares ou o que vai celebrar, e acrescente o que gostaria de ter à sua espera — uma garrafa de vinho da região, uma cama extra, um adaptador, um passeio a cavalo ao pôr do sol. Demora um minuto.",
          fr: "Indiquez-nous votre heure d'arrivée, vos besoins alimentaires ou ce que vous célébrez, et ajoutez ce qui vous ferait plaisir à l'arrivée — une bouteille de vin de la région, un lit supplémentaire, un adaptateur, une balade à cheval au coucher du soleil. Cela prend une minute.",
        }),
    returning_line: !returning ? "" : pick({
      en: "It's lovely to have you back. As a thank-you for returning, a small welcome-back gift will be waiting for you.",
      pt: "É uma alegria tê-lo de volta. Como agradecimento por regressar, terá um pequeno presente de boas-vindas à sua espera.",
      fr: "Quel plaisir de vous revoir. Pour vous remercier de revenir, un petit cadeau de bienvenue vous attendra.",
    }),
    occasion_line: !occ ? "" : pick({
      en: `We know this stay marks ${occ} — we'd love to help make it special. If there's anything you have in mind, just tell us.`,
      pt: `Sabemos que esta estadia assinala ${occ} — gostaríamos muito de ajudar a torná-la especial. Se tiver alguma ideia, diga-nos.`,
      fr: `Nous savons que ce séjour marque ${occ} — nous aimerions beaucoup contribuer à le rendre spécial. Si vous avez une idée en tête, dites-le-nous.`,
    }),
    events_block: ev.length === 0 ? "" : input.kind === "pre_arrival"
      ? [pick({ en: "While you're here:", pt: "Durante a sua estadia:", fr: "Pendant votre séjour :" }), ...ev,
         pick({ en: "Guests staying with us have priority — reply and we'll keep you a place.", pt: "Os nossos hóspedes têm prioridade — responda e guardamos-lhe lugar.", fr: "Nos hôtes sont prioritaires — répondez-nous et nous vous réservons une place." })].join("\n")
      : [pick({ en: "What's on while you're here:", pt: "Durante a sua estadia:", fr: "Pendant votre séjour :" }), ...ev].join("\n"),
    prepared_line: welcomePreferencesLine(r, l),
    journey_line: !city ? "" : pick({
      en: `We hope the journey from ${city} was an easy one.`,
      pt: `Esperamos que a viagem desde ${city} tenha corrido bem.`,
      fr: `Nous espérons que le voyage depuis ${city} s'est bien passé.`,
    }),
    suggestions: stayPlan && stayPlan.days.length > 0
      ? "## " + renderStayPlan(stayPlan, l, p.receptionPhone)
      : pick({
          en: "We can arrange a massage in your villa, a guided walk or a wine tasting — just ask.",
          pt: "Podemos marcar uma massagem na sua casa, uma caminhada guiada ou uma prova de vinhos — é só pedir.",
          fr: "Nous pouvons organiser un massage dans votre villa, une randonnée guidée ou une dégustation de vins — il suffit de demander.",
        }),
    returning_thanks: !returning ? "" : pick({ en: " — and for coming back", pt: " — e por ter voltado", fr: " — et d'être revenu" }),
    motive_line: POST_STAY_LINE[r.motive][l],
    remember_line: postStayPreferencesLine(r, l),
  };
  if (event) {
    v.event_title = event.title[l];
    v.event_when = `${cap(day(event.start, l))}, ${time(event.start)}`;
    v.event_date_short = shortDay(event.start, l);
    v.event_place = event.place;
    v.event_description = event.description[l];
  }
  return v;
}

export class TemplateGenerator implements Generator {
  async generate(input: GenerationInput): Promise<GeneratedMessage> {
    const short = input.channel !== "email";
    const key: TemplateKey = input.kind === "arrival_day" && short ? "arrival_text" : input.kind;
    if (input.kind === "event_invite" && !input.event) throw new Error("event_invite needs an event");
    const out = fill(getTemplate(key, input.language), fieldValues(input));
    return short
      ? { body: toPlainText(out.body), generatedBy: "template" }
      : { subject: out.subject, body: out.body, generatedBy: "template" };
  }
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
