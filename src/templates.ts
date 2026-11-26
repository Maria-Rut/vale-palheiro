import type { Language, MessageKind } from "./types.ts";
import { publicBaseUrl } from "./preferences.ts";

/**
 * Editable email templates.
 *
 * Each moment in the guest journey has one template per language. Staff edit
 * the wording in the dashboard (Emails tab); the system fills in the {{fields}} for
 * each guest. Two kinds of field:
 *   - simple facts: {{first_name}}, {{villa}}, {{wifi_password}}…
 *   - smart blocks that the system writes in the guest's language and leaves out
 *     when they don't apply: {{occasion_line}}, {{events_block}},
 *     {{suggestions}}… A line that ends up empty is removed.
 *
 * Two bits of formatting:
 *   [Button text](link)   on its own line becomes a button in the email
 *   ## Heading            on its own line becomes a small heading
 * In a WhatsApp / SMS text they become "Button text: link" and plain text.
 */

export type TemplateKey = MessageKind | "arrival_text" | "pre_arrival_text" | "post_stay_text";

/** Templates written for WhatsApp: short, no subject; buttons become link buttons. */
export const TEXT_TEMPLATES: TemplateKey[] = ["pre_arrival_text", "arrival_text", "morning", "post_stay_text"];

export interface Template {
  subject: string;
  body: string;
}

export interface FieldInfo {
  token: string;
  /** What staff see in the legend. */
  help: string;
  /** Smart blocks are written by the system and can disappear. */
  smart?: boolean;
}

// ---------------------------------------------------------------- fields

const F = {
  first_name: { token: "first_name", help: "Guest's first name" },
  villa: { token: "villa", help: "Their villa / room, e.g. Casa Lyra or Suite 4" },
  stay_dates: { token: "stay_dates", help: "Arrival – departure, e.g. Tue 24 Nov – Fri 27 Nov" },
  party: { token: "party", help: "e.g. 2 adults and 1 child" },
  for_party: { token: "for_party", help: "\"for the two of you\", \"for the four of you\"…" },
  breakfast_note: { token: "breakfast_note", help: "\" · breakfast included\" when it is", smart: true },
  arrival_time: { token: "arrival_time", help: "Expected arrival time, resort clock" },
  checkout: { token: "checkout", help: "Check-out time and day" },
  reception_hours: { token: "reception_hours", help: "From Resort settings" },
  reception_phone: { token: "reception_phone", help: "From Resort settings" },
  out_of_hours_phone: { token: "out_of_hours_phone", help: "From Resort settings" },
  whatsapp: { token: "whatsapp", help: "From Resort settings" },
  email: { token: "email", help: "From Resort settings" },
  wifi_network: { token: "wifi_network", help: "From Resort settings" },
  wifi_password: { token: "wifi_password", help: "From Resort settings" },
  meeting_point: { token: "meeting_point", help: "Where we meet guests (Resort settings)" },
  directions: { token: "directions", help: "Directions in the guest's language (Resort settings)" },
  map_link: { token: "map_link", help: "Google Maps link" },
  breakfast_line: { token: "breakfast_line", help: "Breakfast hours, and whether it's included" },
  dinner_hours: { token: "dinner_hours", help: "The Barn's hours" },
  review_link: { token: "review_link", help: "Google review link (optional — the button disappears when empty)" },
  tripadvisor_link: { token: "tripadvisor_link", help: "TripAdvisor review page (Resort settings)" },
  check_in_time: { token: "check_in_time", help: "Standard check-in time (Resort settings)" },
  restaurant_intro: { token: "restaurant_intro", help: "A few words about The Barn, in the guest's language" },
  bar_line: { token: "bar_line", help: "Bar hours as a line — left out if no hours are set", smart: true },
  wellness_line: { token: "wellness_line", help: "Wellness in one line, with the menu link if there is one", smart: true },
  brochure_link: { token: "brochure_link", help: "The Experiences brochure (Resort settings)" },
  minibar_line: { token: "minibar_line", help: "What's in the minibar — or nothing for villas without one", smart: true },
  arrival_line: { token: "arrival_line", help: "The arrival time they told us — or a request to tell us", smart: true },
  today_line: { token: "today_line", help: "Today's weather and the agent's pick for today (from the Experiences Menu)", smart: true },
  wellness_link: { token: "wellness_link", help: "Wellness menu (Resort settings) — for now the wellbeing pages of the brochure" },
  late_arrival_line: { token: "late_arrival_line", help: "If they arrive after the front office closes: late check-in note and fee", smart: true },
  personalise_link: { token: "personalise_link", help: "The guest's own \"prepare your stay\" page" },
  personalise_intro: { token: "personalise_intro", help: "Invites them to personalise their stay — or thanks them if they already did", smart: true },
  returning_line: { token: "returning_line", help: "Only for returning guests: the welcome-back gift", smart: true },
  occasion_line: { token: "occasion_line", help: "Only if they're celebrating: birthday, anniversary…", smart: true },
  events_block: { token: "events_block", help: "Resort events during their stay, if any", smart: true },
  prepared_line: { token: "prepared_line", help: "What we've prepared from their answers (fireplace, wine…)", smart: true },
  journey_line: { token: "journey_line", help: "\"We hope the journey from Amsterdam was an easy one.\"", smart: true },
  suggestions: { token: "suggestions", help: "Day-by-day ideas from the weather & sea forecast", smart: true },
  returning_thanks: { token: "returning_thanks", help: "\" — and for coming back\" for returning guests", smart: true },
  motive_line: { token: "motive_line", help: "One line matched to why they came (leisure / business)", smart: true },
  remember_line: { token: "remember_line", help: "If they asked us to remember their preferences", smart: true },
  event_title: { token: "event_title", help: "Event name" },
  event_when: { token: "event_when", help: "Event day and time" },
  event_date_short: { token: "event_date_short", help: "e.g. Sat 12 Dec" },
  event_place: { token: "event_place", help: "Where on the estate" },
  event_description: { token: "event_description", help: "The event's short description" },
} satisfies Record<string, FieldInfo>;

export const FIELDS: Record<TemplateKey, FieldInfo[]> = {
  pre_arrival: [F.first_name, F.villa, F.for_party, F.stay_dates, F.party, F.breakfast_note, F.directions, F.map_link, F.restaurant_intro, F.dinner_hours, F.brochure_link, F.check_in_time, F.arrival_line, F.late_arrival_line, F.personalise_intro, F.personalise_link, F.returning_line, F.occasion_line, F.events_block, F.reception_hours],
  arrival_day: [F.first_name, F.villa, F.meeting_point, F.directions, F.map_link, F.check_in_time, F.reception_hours, F.late_arrival_line, F.out_of_hours_phone, F.whatsapp, F.reception_phone, F.prepared_line, F.arrival_time],
  arrival_text: [F.first_name, F.villa, F.meeting_point, F.map_link, F.whatsapp, F.arrival_time],
  in_stay: [F.first_name, F.villa, F.journey_line, F.wifi_network, F.wifi_password, F.breakfast_line, F.dinner_hours, F.bar_line, F.minibar_line, F.wellness_line, F.brochure_link, F.reception_phone, F.reception_hours, F.out_of_hours_phone, F.email, F.checkout, F.events_block, F.suggestions],
  post_stay: [F.first_name, F.villa, F.returning_thanks, F.motive_line, F.tripadvisor_link, F.review_link, F.remember_line],
  pre_arrival_text: [F.first_name, F.villa, F.stay_dates, F.personalise_link, F.check_in_time],
  morning: [F.first_name, F.villa, F.today_line, F.wellness_link, F.brochure_link],
  post_stay_text: [F.first_name, F.villa, F.tripadvisor_link],
  event_invite: [F.first_name, F.event_title, F.event_when, F.event_date_short, F.event_place, F.event_description],
};

// ---------------------------------------------------------------- defaults

const SIGN = {
  en: "Warmly,\nThe team at Vale Palheiro",
  pt: "Com carinho,\nA equipa do Vale Palheiro",
  fr: "Chaleureusement,\nL'équipe de Vale Palheiro",
};

const t = (subject: string, ...body: string[]): Template => ({ subject, body: body.join("\n") });

export const DEFAULT_TEMPLATES: Record<TemplateKey, Record<Language, Template>> = {
  pre_arrival: {
    en: t("Three days to go — we're getting ready for you, {{first_name}}",
      "Dear {{first_name}},", "",
      "In three days we'll welcome you to the valley. {{villa}} is being prepared {{for_party}}, and we're really looking forward to having you here.", "",
      "{{returning_line}}", "",
      "{{occasion_line}}", "",
      "Your stay: {{stay_dates}} · {{villa}} · {{party}}{{breakfast_note}}", "",
      "## Getting here",
      "{{directions}}",
      "[Open the route in Google Maps]({{map_link}})", "",
      "Check-in is from {{check_in_time}}; the front office is open {{reception_hours}}. {{arrival_line}} {{late_arrival_line}}", "",
      "## Dining at The Barn",
      "{{restaurant_intro}} Dinner is served {{dinner_hours}}.", "",
      "## Experiences",
      "From a sunset horse ride to a massage in your villa, our Experiences Menu has everything we can arrange for you. Tick what tempts you on your page and we'll take care of the rest.",
      "[See the Experiences Menu]({{brochure_link}})", "",
      "{{events_block}}", "",
      "## Make it yours",
      "{{personalise_intro}}",
      "[Click here to personalise your stay]({{personalise_link}})", "",
      SIGN.en),
    pt: t("Faltam três dias — estamos a preparar tudo, {{first_name}}",
      "Olá {{first_name}},", "",
      "Daqui a três dias recebemo-lo no vale. {{villa}} está a ser preparada {{for_party}} e estamos muito contentes por o ter connosco.", "",
      "{{returning_line}}", "",
      "{{occasion_line}}", "",
      "A sua estadia: {{stay_dates}} · {{villa}} · {{party}}{{breakfast_note}}", "",
      "## Como chegar",
      "{{directions}}",
      "[Abrir o percurso no Google Maps]({{map_link}})", "",
      "O check-in é a partir das {{check_in_time}}; a receção está aberta {{reception_hours}}. {{arrival_line}} {{late_arrival_line}}", "",
      "## Jantar no The Barn",
      "{{restaurant_intro}} O jantar é servido {{dinner_hours}}.", "",
      "## Experiências",
      "De um passeio a cavalo ao pôr do sol a uma massagem na sua casa, o nosso Menu de Experiências tem tudo o que podemos organizar para si. Marque o que lhe apetece na sua página e tratamos do resto.",
      "[Ver o Menu de Experiências]({{brochure_link}})", "",
      "{{events_block}}", "",
      "## À sua medida",
      "{{personalise_intro}}",
      "[Clique aqui para personalizar a sua estadia]({{personalise_link}})", "",
      SIGN.pt),
    fr: t("Plus que trois jours — nous préparons tout pour vous, {{first_name}}",
      "Bonjour {{first_name}},", "",
      "Dans trois jours, nous vous accueillerons dans la vallée. {{villa}} est en cours de préparation {{for_party}}, et nous avons hâte de vous recevoir.", "",
      "{{returning_line}}", "",
      "{{occasion_line}}", "",
      "Votre séjour : {{stay_dates}} · {{villa}} · {{party}}{{breakfast_note}}", "",
      "## Pour venir",
      "{{directions}}",
      "[Ouvrir l'itinéraire dans Google Maps]({{map_link}})", "",
      "L'arrivée se fait à partir de {{check_in_time}} ; la réception est ouverte {{reception_hours}}. {{arrival_line}} {{late_arrival_line}}", "",
      "## Dîner à The Barn",
      "{{restaurant_intro}} Le dîner est servi {{dinner_hours}}.", "",
      "## Expériences",
      "D'une balade à cheval au coucher du soleil à un massage dans votre villa, notre carte des Expériences rassemble tout ce que nous pouvons organiser pour vous. Cochez ce qui vous tente sur votre page et nous nous occupons du reste.",
      "[Voir la carte des Expériences]({{brochure_link}})", "",
      "{{events_block}}", "",
      "## À votre goût",
      "{{personalise_intro}}",
      "[Cliquez ici pour personnaliser votre séjour]({{personalise_link}})", "",
      SIGN.fr),
  },
  arrival_day: {
    en: t("Today: everything for your arrival at {{villa}}",
      "Dear {{first_name}},", "",
      "See you later today. Here's everything you need:", "",
      "• Your accommodation: {{villa}}",
      "• Where we'll meet you: {{meeting_point}}, our welcome lounge — we'll walk you to {{villa}} from there",
      "• Check-in from {{check_in_time}} · front office {{reception_hours}}",
      "• Getting here: {{directions}}",
      "• Questions on the way: {{whatsapp}} (WhatsApp) or {{reception_phone}} · out of hours {{out_of_hours_phone}}", "",
      "[Open the map]({{map_link}})", "",
      "{{late_arrival_line}}", "",
      "{{prepared_line}}", "",
      "We're expecting you around {{arrival_time}}. Travel safely.", "",
      SIGN.en),
    pt: t("Hoje: tudo para a sua chegada",
      "Olá {{first_name}},", "",
      "Até logo. Aqui fica tudo o que precisa para hoje:", "",
      "• O seu alojamento: {{villa}}",
      "• Onde o esperamos: {{meeting_point}}, o nosso espaço de boas-vindas — daí acompanhamo-lo até à {{villa}}",
      "• Check-in a partir das {{check_in_time}} · receção {{reception_hours}}",
      "• Como chegar: {{directions}}",
      "• Alguma dúvida pelo caminho: {{whatsapp}} (WhatsApp) ou {{reception_phone}} · fora de horas {{out_of_hours_phone}}", "",
      "[Abrir o mapa]({{map_link}})", "",
      "{{late_arrival_line}}", "",
      "{{prepared_line}}", "",
      "Contamos consigo por volta das {{arrival_time}}. Boa viagem.", "",
      SIGN.pt),
    fr: t("Aujourd'hui : tout pour votre arrivée à {{villa}}",
      "Bonjour {{first_name}},", "",
      "À tout à l'heure. Voici l'essentiel pour aujourd'hui :", "",
      "• Votre hébergement : {{villa}}",
      "• Où nous vous attendons : {{meeting_point}}, notre espace d'accueil — nous vous accompagnerons ensuite jusqu'à {{villa}}",
      "• Arrivée à partir de {{check_in_time}} · réception {{reception_hours}}",
      "• Pour venir : {{directions}}",
      "• Une question en route : {{whatsapp}} (WhatsApp) ou {{reception_phone}} · en dehors des horaires {{out_of_hours_phone}}", "",
      "[Ouvrir le plan]({{map_link}})", "",
      "{{late_arrival_line}}", "",
      "{{prepared_line}}", "",
      "Nous vous attendons vers {{arrival_time}}. Bonne route.", "",
      SIGN.fr),
  },
  arrival_text: {
    en: t("", "Hi {{first_name}}, see you today around {{arrival_time}}. We'll meet you at {{meeting_point}} and walk you to {{villa}}. Map: {{map_link}} · Questions: {{whatsapp}} — Vale Palheiro"),
    pt: t("", "Olá {{first_name}}, até hoje por volta das {{arrival_time}}. Esperamo-lo na {{meeting_point}} e acompanhamo-lo até à {{villa}}. Mapa: {{map_link}} · Dúvidas: {{whatsapp}} — Vale Palheiro"),
    fr: t("", "Bonjour {{first_name}}, à aujourd'hui vers {{arrival_time}}. Nous vous attendons à {{meeting_point}} et vous accompagnerons jusqu'à {{villa}}. Plan : {{map_link}} · Questions : {{whatsapp}} — Vale Palheiro"),
  },
  pre_arrival_text: {
    en: t("", "Hello {{first_name}},", "",
      "We're so looking forward to welcoming you to Vale Palheiro, {{stay_dates}}.", "",
      "Let us know your expected arrival time so we can have everything ready for you — just reply here, or tell us on your page, where you can also personalise your stay (check-in from {{check_in_time}}).", "",
      "Need a transfer, or help planning your days — from the trails to the sea? We'll gladly help.", "",
      "See you soon,", "The Vale Palheiro team", "",
      "[Personalise your stay]({{personalise_link}})"),
    pt: t("", "Olá {{first_name}},", "",
      "Estamos entusiasmados por recebê-lo no Vale Palheiro, {{stay_dates}}.", "",
      "Indique-nos a sua hora prevista de chegada, para que possamos ter tudo preparado para si — responda aqui ou diga-nos na sua página, onde pode também personalizar a sua estadia (check-in a partir das {{check_in_time}}).", "",
      "Precisa de transporte ou de ajuda para planear os seus dias — dos trilhos ao mar? Teremos todo o gosto em ajudar.", "",
      "Até breve,", "Equipa Vale Palheiro", "",
      "[Personalizar a estadia]({{personalise_link}})"),
    fr: t("", "Bonjour {{first_name}},", "",
      "Nous avons hâte de vous accueillir à Vale Palheiro, {{stay_dates}}.", "",
      "Indiquez-nous votre heure d'arrivée prévue pour que tout soit prêt — répondez simplement ici ou sur votre page, où vous pouvez aussi personnaliser votre séjour (arrivée à partir de {{check_in_time}}).", "",
      "Besoin d'un transfert ou d'aide pour organiser vos journées — des sentiers à l'océan ? Avec plaisir.", "",
      "À très bientôt,", "L'équipe de Vale Palheiro", "",
      "[Personnaliser mon séjour]({{personalise_link}})"),
  },
  morning: {
    en: t("Good morning from the valley, {{first_name}}", "Good morning, {{first_name}}!", "",
      "We hope you slept well in {{villa}} and are ready for a new day in the valley.", "",
      "{{today_line}}", "",
      "Still deciding how to spend your day? Take some time for yourself with a massage in your villa or a yoga class, or discover the Costa Vicentina with one of our experiences — from the trails to the sea.", "",
      "Places are limited, so we recommend booking ahead. Just reply here and our team will happily plan and book it for you.", "",
      "Enjoy your day,", "The Vale Palheiro team", "",
      "[Wellness menu]({{wellness_link}})", "[Experiences]({{brochure_link}})"),
    pt: t("Bom dia do vale, {{first_name}}", "Bom dia, {{first_name}}!", "",
      "Esperamos que tenha tido uma boa noite de sono na {{villa}} e que esteja pronto para um novo dia no vale.", "",
      "{{today_line}}", "",
      "Ainda a decidir como aproveitar o dia? Reserve algum tempo para si com uma massagem na sua casa ou uma aula de yoga, ou descubra a Costa Vicentina com uma das nossas experiências — dos trilhos ao mar.", "",
      "A disponibilidade é limitada, pelo que recomendamos a reserva antecipada. Responda aqui e a nossa equipa terá todo o gosto em planear e reservar por si.", "",
      "Desfrute do seu dia,", "Equipa Vale Palheiro", "",
      "[Bem-estar]({{wellness_link}})", "[Experiências]({{brochure_link}})"),
    fr: t("Bonjour de la vallée, {{first_name}}", "Bonjour {{first_name}} !", "",
      "Nous espérons que vous avez bien dormi à {{villa}} et que vous êtes prêt pour une nouvelle journée dans la vallée.", "",
      "{{today_line}}", "",
      "Vous hésitez encore ? Prenez du temps pour vous avec un massage dans votre villa ou un cours de yoga, ou découvrez la Costa Vicentina avec l'une de nos expériences — des sentiers à l'océan.", "",
      "Les places sont limitées : nous vous conseillons de réserver à l'avance. Répondez simplement ici et notre équipe s'occupe de tout.", "",
      "Belle journée,", "L'équipe de Vale Palheiro", "",
      "[Bien-être]({{wellness_link}})", "[Expériences]({{brochure_link}})"),
  },
  post_stay_text: {
    en: t("", "Hello {{first_name}},", "",
      "Thank you for staying with us in {{villa}}. We hope you had a wonderful time in the valley!", "",
      "We'd love to hear about your stay on TripAdvisor — it means a great deal to a small, independent place like ours.", "",
      "Safe travels home, and we hope to welcome you back soon.", "The Vale Palheiro team", "",
      "[Review us on TripAdvisor]({{tripadvisor_link}})"),
    pt: t("", "Olá {{first_name}},", "",
      "Obrigado por ter ficado connosco na {{villa}}. Esperamos que a sua estadia no vale tenha sido muito agradável!", "",
      "Gostaríamos muito que partilhasse a sua opinião no TripAdvisor — significa muito para um lugar pequeno e independente como o nosso.", "",
      "Desejamos-lhe uma boa viagem de regresso e esperamos voltar a recebê-lo em breve.", "Equipa Vale Palheiro", "",
      "[Avaliar no TripAdvisor]({{tripadvisor_link}})"),
    fr: t("", "Bonjour {{first_name}},", "",
      "Merci d'avoir séjourné à {{villa}}. Nous espérons que vous avez passé un merveilleux moment dans la vallée !", "",
      "Votre avis sur TripAdvisor compte beaucoup pour une petite maison indépendante comme la nôtre.", "",
      "Bon retour, et au plaisir de vous accueillir à nouveau.", "L'équipe de Vale Palheiro", "",
      "[Laisser un avis sur TripAdvisor]({{tripadvisor_link}})"),
  },
  in_stay: {
    en: t("Welcome to the valley, {{first_name}}",
      "Dear {{first_name}},", "",
      "Welcome to Vale Palheiro. {{journey_line}} {{villa}} is ready for you, and we hope it already feels like home. A few things to keep handy:", "",
      "• Wi-Fi: {{wifi_network}} · password {{wifi_password}}",
      "• Breakfast: {{breakfast_line}}",
      "• The Barn (dinner): {{dinner_hours}} — reply to book a table",
      "{{bar_line}}",
      "{{minibar_line}}",
      "{{wellness_line}}",
      "• Reception: {{reception_phone}} ({{reception_hours}}) · Out of hours: {{out_of_hours_phone}}",
      "• Email: {{email}}",
      "• Check-out: {{checkout}}", "",
      "{{events_block}}", "",
      "{{suggestions}}", "",
      "We can also organise airport transfers and private transport, restaurant reservations and babysitting.",
      "[See the Experiences Menu]({{brochure_link}})", "",
      SIGN.en),
    pt: t("Bem-vindo ao vale, {{first_name}}",
      "Olá {{first_name}},", "",
      "Bem-vindo ao Vale Palheiro. {{journey_line}} A {{villa}} está pronta para si e esperamos que já se sinta em casa. Algumas coisas para ter à mão:", "",
      "• Wi-Fi: {{wifi_network}} · palavra-passe {{wifi_password}}",
      "• Pequeno-almoço: {{breakfast_line}}",
      "• The Barn (jantar): {{dinner_hours}} — responda para reservar mesa",
      "{{bar_line}}",
      "{{minibar_line}}",
      "{{wellness_line}}",
      "• Receção: {{reception_phone}} ({{reception_hours}}) · Fora de horas: {{out_of_hours_phone}}",
      "• Email: {{email}}",
      "• Check-out: {{checkout}}", "",
      "{{events_block}}", "",
      "{{suggestions}}", "",
      "Também tratamos de transferes do aeroporto e transporte privado, reservas de restaurante e babysitting.",
      "[Ver o Menu de Experiências]({{brochure_link}})", "",
      SIGN.pt),
    fr: t("Bienvenue dans la vallée, {{first_name}}",
      "Bonjour {{first_name}},", "",
      "Bienvenue à Vale Palheiro. {{journey_line}} {{villa}} vous attend, et nous espérons que vous vous y sentez déjà chez vous. Quelques informations utiles :", "",
      "• Wi-Fi : {{wifi_network}} · mot de passe {{wifi_password}}",
      "• Petit-déjeuner : {{breakfast_line}}",
      "• The Barn (dîner) : {{dinner_hours}} — répondez-nous pour réserver une table",
      "{{bar_line}}",
      "{{minibar_line}}",
      "{{wellness_line}}",
      "• Réception : {{reception_phone}} ({{reception_hours}}) · En dehors des horaires : {{out_of_hours_phone}}",
      "• E-mail : {{email}}",
      "• Départ : {{checkout}}", "",
      "{{events_block}}", "",
      "{{suggestions}}", "",
      "Nous organisons aussi transferts aéroport et transport privé, réservations de restaurant et baby-sitting.",
      "[Voir la carte des Expériences]({{brochure_link}})", "",
      SIGN.fr),
  },
  post_stay: {
    en: t("Thank you, {{first_name}}",
      "Dear {{first_name}},", "",
      "Thank you for staying with us in {{villa}}{{returning_thanks}}. {{motive_line}}", "",
      "If you have a minute, a short review means a great deal to a small, independent place like ours.", "",
      "[Review us on TripAdvisor]({{tripadvisor_link}})",
      "[Review us on Google]({{review_link}})", "",
      "Whenever you'd like to return, the valley will be here — and so will we. {{remember_line}}", "",
      SIGN.en),
    pt: t("Obrigado, {{first_name}}",
      "Olá {{first_name}},", "",
      "Obrigado por ter ficado connosco na {{villa}}{{returning_thanks}}. {{motive_line}}", "",
      "Se tiver um minuto, uma breve avaliação significa muito para um lugar pequeno e independente como o nosso.", "",
      "[Avaliar no TripAdvisor]({{tripadvisor_link}})",
      "[Avaliar no Google]({{review_link}})", "",
      "Quando quiser voltar, o vale estará aqui — e nós também. {{remember_line}}", "",
      SIGN.pt),
    fr: t("Merci, {{first_name}}",
      "Bonjour {{first_name}},", "",
      "Merci d'avoir séjourné à {{villa}}{{returning_thanks}}. {{motive_line}}", "",
      "Si vous avez une minute, un court avis compte beaucoup pour une petite maison indépendante comme la nôtre.", "",
      "[Laisser un avis sur TripAdvisor]({{tripadvisor_link}})",
      "[Laisser un avis sur Google]({{review_link}})", "",
      "Quand vous voudrez revenir, la vallée sera là — et nous aussi. {{remember_line}}", "",
      SIGN.fr),
  },
  event_invite: {
    en: t("{{event_title}} — {{event_date_short}}",
      "Dear {{first_name}},", "",
      "We hope you've been well since your stay with us.", "",
      "{{event_when}}: {{event_title}}, at {{event_place}}. {{event_description}}", "",
      "If you'd like to join us, reply and we'll keep you a place. And if you'd like to stay a few nights, a welcome-back gift will be waiting for you as a thank-you for returning.", "",
      SIGN.en, "",
      "You're receiving this because you agreed to hear from us. Reply \"unsubscribe\" and we won't write again."),
    pt: t("{{event_title}} — {{event_date_short}}",
      "Olá {{first_name}},", "",
      "Esperamos que esteja bem desde a sua estadia connosco.", "",
      "{{event_when}}: {{event_title}}, no {{event_place}}. {{event_description}}", "",
      "Se quiser juntar-se a nós, responda e guardamos-lhe lugar. E se quiser ficar uns dias, como hóspede que regressa terá um presente de boas-vindas à sua espera.", "",
      SIGN.pt, "",
      "Recebe esta mensagem porque aceitou ter notícias nossas. Responda \"cancelar\" e deixamos de escrever."),
    fr: t("{{event_title}} — {{event_date_short}}",
      "Bonjour {{first_name}},", "",
      "Nous espérons que vous allez bien depuis votre séjour parmi nous.", "",
      "{{event_when}} : {{event_title}}, à {{event_place}}. {{event_description}}", "",
      "Si vous souhaitez vous joindre à nous, répondez-nous et nous vous gardons une place. Et si vous restez quelques jours, un cadeau de bienvenue vous attendra pour vous remercier de revenir.", "",
      SIGN.fr, "",
      "Vous recevez ce message car vous avez accepté d'avoir de nos nouvelles. Répondez « désinscrire » et nous ne vous écrirons plus."),
  },
};

// ---------------------------------------------------------------- store

const overrides = new Map<string, Template>();
const k = (key: TemplateKey, lang: Language) => `${key}:${lang}`;

export function getTemplate(key: TemplateKey, lang: Language): Template {
  return overrides.get(k(key, lang)) ?? DEFAULT_TEMPLATES[key][lang];
}
export function isEdited(key: TemplateKey, lang: Language): boolean {
  return overrides.has(k(key, lang));
}
export function setTemplate(key: TemplateKey, lang: Language, tpl: Template): void {
  const d = DEFAULT_TEMPLATES[key][lang];
  if (tpl.subject === d.subject && tpl.body === d.body) overrides.delete(k(key, lang));
  else overrides.set(k(key, lang), { subject: tpl.subject, body: tpl.body });
}
export function resetTemplate(key: TemplateKey, lang: Language): void {
  overrides.delete(k(key, lang));
}
export function isTemplateKey(v: string): v is TemplateKey {
  return v in DEFAULT_TEMPLATES;
}

// ---------------------------------------------------------------- filling

/**
 * Fill a template. Unknown fields are left visible ({{like_this}}) so a typo
 * shows up in the preview instead of silently vanishing. A line that only held
 * fields which came out empty is dropped, and blank lines are tidied.
 */
export function fill(tpl: Template, values: Record<string, string>): Template {
  const sub = (s: string) => s.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, name: string) => (name in values ? values[name] : m));
  const body = tpl.body
    .split("\n")
    .flatMap((line) => {
      const hadField = /\{\{\s*[a-z_]+\s*\}\}/.test(line);
      let out = sub(line).replace(/ {2,}/g, " ").replace(/ +([.,])/g, "$1");
      // A button whose link is empty (e.g. the page has closed) disappears.
      if (/^\[[^\]]+\]\(\s*\)$/.test(out.trim())) out = "";
      if (hadField && out.trim() === "") return [];
      return [out.replace(/\s+$/, "")];
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { subject: sub(tpl.subject).replace(/ {2,}/g, " ").trim(), body };
}

// ---------------------------------------------------------------- rendering

/** The text version: buttons become "Label: link", headings plain lines. */
export function toPlainText(body: string): string {
  return body
    .split("\n")
    .map((l) => {
      const b = l.trim().match(/^\[([^\]]+)\]\((\S+)\)$/);
      if (b) return `${b[1]}: ${b[2]}`;
      return l.replace(/^##\s+/, "");
    })
    .join("\n");
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(s: string): string {
  return esc(s).replace(/https?:\/\/[^\s<]+[^\s<.,;:)]/g, (u) => `<a href="${u}" target="_blank" rel="noopener" style="color:#7a5c3e">${u}</a>`);
}

// Exact brand colours (guide p.18): Terracota #934d3f, Off-white #f2eee8, Antracite #2f2f2f.
const C = { ink: "#2f2f2f", muted: "#938a7c", accent: "#934d3f", bg: "#f2eee8", card: "#f8f5ef", line: "#e0d8ca", terracotta: "#934d3f", offwhite: "#f2eee8", anthracite: "#2f2f2f" };

/**
 * The email as the guest sees it: a simple, inline-styled HTML email that
 * works in mail apps and in the dashboard preview.
 */
export function toEmailHtml(body: string): string {
  const blocks = body.split(/\n{2,}/);
  const html = blocks.map((block) => {
    const ls = block.split("\n");
    const out: string[] = [];
    let list: string[] = [];
    let para: string[] = [];
    const flush = () => {
      if (list.length) out.push(`<ul style="margin:0 0 16px;padding-left:20px">${list.map((li) => `<li style="margin:0 0 6px">${inline(li)}</li>`).join("")}</ul>`);
      if (para.length) out.push(`<p style="margin:0 0 16px">${para.map(inline).join("<br>")}</p>`);
      list = []; para = [];
    };
    for (const raw of ls) {
      const l = raw.trim();
      const btn = l.match(/^\[([^\]]+)\]\((\S+)\)$/);
      if (btn) {
        flush();
        out.push(`<p style="margin:4px 0 20px"><a href="${esc(btn[2])}" target="_blank" rel="noopener" style="display:inline-block;background:${C.accent};color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;font-size:15px">${esc(btn[1])}</a></p>`);
      } else if (l.startsWith("## ")) {
        flush();
        out.push(`<h2 style="font-family:Georgia,serif;font-weight:normal;font-size:19px;margin:8px 0 8px;color:${C.ink}">${esc(l.slice(3))}</h2>`);
      } else if (l.startsWith("• ")) {
        if (para.length) flush();
        list.push(l.slice(2));
      } else {
        if (list.length) flush();
        para.push(raw);
      }
    }
    flush();
    return out.join("");
  }).join("");

  // The resort's own logo files (PNG — inline SVG doesn't show in Gmail/Outlook).
  const logo = (file: string, w: number, h: number) =>
    `<img src="${publicBaseUrl()}/brand/${file}" width="${w}" height="${h}" alt="Vale Palheiro — Earth Resort" style="display:inline-block;border:0;width:${w}px;height:${h}px">`;
  // Brand email signature (guide pp.42–44): logo + contact.
  const signature = `<div style="border-top:1px solid ${C.line};margin-top:8px;padding:20px 24px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${C.muted};font-size:12px;line-height:1.55">`
    + `<div style="margin-bottom:10px">${logo("logo-horizontal-terracotta.png", 160, 25)}</div>`
    + `<div style="color:${C.ink};font-weight:600">Vale Palheiro — Earth Resort</div>`
    + `Rua Vale Palheiro, 8670-016 Aljezur · Costa Vicentina<br>`
    + `<a href="https://www.valepalheiro.com" style="color:${C.ink};font-weight:600;text-decoration:none">valepalheiro.com</a> · +351 933 979 043`
    + `</div>`;

  return `<div style="background:${C.bg};padding:24px 12px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;background:${C.card};border:1px solid ${C.line};border-radius:14px;overflow:hidden">
<div style="background:${C.anthracite};padding:30px 24px 26px;text-align:center">${logo("logo-stacked-offwhite.png", 64, 112)}</div>
<div style="padding:26px 24px;color:${C.ink};font-size:15px;line-height:1.6">${html}</div>
${signature}
</div></div>`.replace(/\n/g, "");
}
