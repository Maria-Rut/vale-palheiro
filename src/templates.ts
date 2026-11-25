import type { Language, MessageKind } from "./types.ts";

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

export type TemplateKey = Exclude<MessageKind, "arrival_day"> | "arrival_day" | "arrival_text";

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
  reception_hours: { token: "reception_hours", help: "From Property info" },
  reception_phone: { token: "reception_phone", help: "From Property info" },
  out_of_hours_phone: { token: "out_of_hours_phone", help: "From Property info" },
  whatsapp: { token: "whatsapp", help: "From Property info" },
  email: { token: "email", help: "From Property info" },
  wifi_network: { token: "wifi_network", help: "From Property info" },
  wifi_password: { token: "wifi_password", help: "From Property info" },
  meeting_point: { token: "meeting_point", help: "Where we meet guests (Property info)" },
  directions: { token: "directions", help: "Directions in the guest's language (Property info)" },
  map_link: { token: "map_link", help: "Google Maps link" },
  breakfast_line: { token: "breakfast_line", help: "Breakfast hours, and whether it's included" },
  dinner_hours: { token: "dinner_hours", help: "The Barn's hours" },
  review_link: { token: "review_link", help: "Where guests leave a review" },
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
  pre_arrival: [F.first_name, F.villa, F.for_party, F.stay_dates, F.party, F.breakfast_note, F.personalise_intro, F.personalise_link, F.returning_line, F.occasion_line, F.events_block, F.reception_hours],
  arrival_day: [F.first_name, F.villa, F.meeting_point, F.directions, F.map_link, F.reception_hours, F.out_of_hours_phone, F.whatsapp, F.reception_phone, F.prepared_line, F.arrival_time],
  arrival_text: [F.first_name, F.villa, F.meeting_point, F.map_link, F.whatsapp],
  in_stay: [F.first_name, F.villa, F.journey_line, F.wifi_network, F.wifi_password, F.breakfast_line, F.dinner_hours, F.reception_phone, F.reception_hours, F.out_of_hours_phone, F.email, F.checkout, F.events_block, F.suggestions],
  post_stay: [F.first_name, F.villa, F.returning_thanks, F.motive_line, F.review_link, F.remember_line],
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
      "{{personalise_intro}}",
      "[Click here to personalise your stay]({{personalise_link}})", "",
      "{{events_block}}", "",
      "Reception is open {{reception_hours}}; if you'll arrive later, let us know and someone will be there for you.", "",
      SIGN.en),
    pt: t("Faltam três dias — estamos a preparar tudo, {{first_name}}",
      "Olá {{first_name}},", "",
      "Daqui a três dias recebemo-lo no vale. {{villa}} está a ser preparada {{for_party}} e estamos muito contentes por o ter connosco.", "",
      "{{returning_line}}", "",
      "{{occasion_line}}", "",
      "A sua estadia: {{stay_dates}} · {{villa}} · {{party}}{{breakfast_note}}", "",
      "{{personalise_intro}}",
      "[Clique aqui para personalizar a sua estadia]({{personalise_link}})", "",
      "{{events_block}}", "",
      "A receção está aberta ({{reception_hours}}); se chegar mais tarde, avise-nos e alguém estará à sua espera.", "",
      SIGN.pt),
    fr: t("Plus que trois jours — nous préparons tout pour vous, {{first_name}}",
      "Bonjour {{first_name}},", "",
      "Dans trois jours, nous vous accueillerons dans la vallée. {{villa}} est en cours de préparation {{for_party}}, et nous avons hâte de vous recevoir.", "",
      "{{returning_line}}", "",
      "{{occasion_line}}", "",
      "Votre séjour : {{stay_dates}} · {{villa}} · {{party}}{{breakfast_note}}", "",
      "{{personalise_intro}}",
      "[Cliquez ici pour personnaliser votre séjour]({{personalise_link}})", "",
      "{{events_block}}", "",
      "La réception est ouverte ({{reception_hours}}) ; si vous arrivez plus tard, prévenez-nous et quelqu'un vous attendra.", "",
      SIGN.fr),
  },
  arrival_day: {
    en: t("Today: everything for your arrival at {{villa}}",
      "Dear {{first_name}},", "",
      "See you in a few hours. Here's everything you need for today:", "",
      "• Your accommodation: {{villa}}",
      "• Where we'll meet you: {{meeting_point}}, our welcome lounge — we'll walk you to {{villa}} from there",
      "• Getting here: {{directions}}",
      "• Reception: {{reception_hours}}. Arriving later? Call {{out_of_hours_phone}} and we'll be there.",
      "• Questions on the way: {{whatsapp}} (WhatsApp) or {{reception_phone}}", "",
      "[Open the map]({{map_link}})", "",
      "{{prepared_line}}", "",
      "We're expecting you around {{arrival_time}}. Travel safely.", "",
      SIGN.en),
    pt: t("Hoje: tudo para a sua chegada",
      "Olá {{first_name}},", "",
      "Até daqui a pouco. Aqui fica tudo o que precisa para hoje:", "",
      "• O seu alojamento: {{villa}}",
      "• Onde o esperamos: {{meeting_point}}, o nosso espaço de boas-vindas — daí acompanhamo-lo até à {{villa}}",
      "• Como chegar: {{directions}}",
      "• Receção: {{reception_hours}}. Se chegar depois, ligue para {{out_of_hours_phone}} e estaremos lá.",
      "• Alguma dúvida pelo caminho: {{whatsapp}} (WhatsApp) ou {{reception_phone}}", "",
      "[Abrir o mapa]({{map_link}})", "",
      "{{prepared_line}}", "",
      "Contamos consigo por volta das {{arrival_time}}. Boa viagem.", "",
      SIGN.pt),
    fr: t("Aujourd'hui : tout pour votre arrivée à {{villa}}",
      "Bonjour {{first_name}},", "",
      "À tout à l'heure. Voici l'essentiel pour aujourd'hui :", "",
      "• Votre hébergement : {{villa}}",
      "• Où nous vous attendons : {{meeting_point}}, notre espace d'accueil — nous vous accompagnerons ensuite jusqu'à {{villa}}",
      "• Pour venir : {{directions}}",
      "• Réception : {{reception_hours}}. Si vous arrivez plus tard, appelez le {{out_of_hours_phone}} et nous serons là.",
      "• Une question en route : {{whatsapp}} (WhatsApp) ou {{reception_phone}}", "",
      "[Ouvrir le plan]({{map_link}})", "",
      "{{prepared_line}}", "",
      "Nous vous attendons vers {{arrival_time}}. Bonne route.", "",
      SIGN.fr),
  },
  arrival_text: {
    en: t("", "Hi {{first_name}}, see you soon. We'll meet you at {{meeting_point}} and walk you to {{villa}}. Map: {{map_link}} · Questions: {{whatsapp}} — Vale Palheiro"),
    pt: t("", "Olá {{first_name}}, até já. Esperamo-lo na {{meeting_point}} e acompanhamo-lo até à {{villa}}. Mapa: {{map_link}} · Dúvidas: {{whatsapp}} — Vale Palheiro"),
    fr: t("", "Bonjour {{first_name}}, à tout à l'heure. Nous vous attendons à {{meeting_point}} et vous accompagnerons jusqu'à {{villa}}. Plan : {{map_link}} · Questions : {{whatsapp}} — Vale Palheiro"),
  },
  in_stay: {
    en: t("Welcome to the valley, {{first_name}}",
      "Dear {{first_name}},", "",
      "Welcome to Vale Palheiro. {{journey_line}} {{villa}} is ready for you, and we hope it already feels like home. A few things to keep handy:", "",
      "• Wi-Fi: {{wifi_network}} · password {{wifi_password}}",
      "• Breakfast: {{breakfast_line}}",
      "• The Barn (dinner): {{dinner_hours}} — reply to book a table",
      "• Reception: {{reception_phone}} ({{reception_hours}}) · Out of hours: {{out_of_hours_phone}}",
      "• Email: {{email}}",
      "• Check-out: {{checkout}}", "",
      "{{events_block}}", "",
      "{{suggestions}}", "",
      "We can also organise airport transfers and private transport, restaurant reservations and babysitting.", "",
      SIGN.en),
    pt: t("Bem-vindo ao vale, {{first_name}}",
      "Olá {{first_name}},", "",
      "Bem-vindo ao Vale Palheiro. {{journey_line}} A {{villa}} está pronta para si e esperamos que já se sinta em casa. Algumas coisas para ter à mão:", "",
      "• Wi-Fi: {{wifi_network}} · palavra-passe {{wifi_password}}",
      "• Pequeno-almoço: {{breakfast_line}}",
      "• The Barn (jantar): {{dinner_hours}} — responda para reservar mesa",
      "• Receção: {{reception_phone}} ({{reception_hours}}) · Fora de horas: {{out_of_hours_phone}}",
      "• Email: {{email}}",
      "• Check-out: {{checkout}}", "",
      "{{events_block}}", "",
      "{{suggestions}}", "",
      "Também tratamos de transferes do aeroporto e transporte privado, reservas de restaurante e babysitting.", "",
      SIGN.pt),
    fr: t("Bienvenue dans la vallée, {{first_name}}",
      "Bonjour {{first_name}},", "",
      "Bienvenue à Vale Palheiro. {{journey_line}} {{villa}} vous attend, et nous espérons que vous vous y sentez déjà chez vous. Quelques informations utiles :", "",
      "• Wi-Fi : {{wifi_network}} · mot de passe {{wifi_password}}",
      "• Petit-déjeuner : {{breakfast_line}}",
      "• The Barn (dîner) : {{dinner_hours}} — répondez-nous pour réserver une table",
      "• Réception : {{reception_phone}} ({{reception_hours}}) · En dehors des horaires : {{out_of_hours_phone}}",
      "• E-mail : {{email}}",
      "• Départ : {{checkout}}", "",
      "{{events_block}}", "",
      "{{suggestions}}", "",
      "Nous organisons aussi transferts aéroport et transport privé, réservations de restaurant et baby-sitting.", "",
      SIGN.fr),
  },
  post_stay: {
    en: t("Thank you, {{first_name}}",
      "Dear {{first_name}},", "",
      "Thank you for staying with us in {{villa}}{{returning_thanks}}. {{motive_line}}", "",
      "If you have a minute, a short review means a great deal to a small, independent place like ours.", "",
      "[Leave a review]({{review_link}})", "",
      "Whenever you'd like to return, the valley will be here — and so will we. {{remember_line}}", "",
      SIGN.en),
    pt: t("Obrigado, {{first_name}}",
      "Olá {{first_name}},", "",
      "Obrigado por ter ficado connosco na {{villa}}{{returning_thanks}}. {{motive_line}}", "",
      "Se tiver um minuto, uma breve avaliação significa muito para um lugar pequeno e independente como o nosso.", "",
      "[Deixar uma avaliação]({{review_link}})", "",
      "Quando quiser voltar, o vale estará aqui — e nós também. {{remember_line}}", "",
      SIGN.pt),
    fr: t("Merci, {{first_name}}",
      "Bonjour {{first_name}},", "",
      "Merci d'avoir séjourné à {{villa}}{{returning_thanks}}. {{motive_line}}", "",
      "Si vous avez une minute, un court avis compte beaucoup pour une petite maison indépendante comme la nôtre.", "",
      "[Laisser un avis]({{review_link}})", "",
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
 * The editorial wordmark as inline SVG for email — the real letterforms
 * (triangular V/A, three-bar E, round O) with "EARTH RESORT" beneath.
 * `color` sets the stroke/fill; `w` is the rendered width in px.
 */
function wordmarkHtml(color: string, w = 230, withSub = true): string {
  const sub = withSub
    ? `<text x="256" y="138" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="12" letter-spacing="8" fill="${color}">EARTH RESORT</text>`
    : "";
  const vb = withSub ? "0 0 680 150" : "0 0 530 120";
  const h = Math.round(w * (withSub ? 150 / 680 : 120 / 530));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${w}" height="${h}" fill="none" style="display:inline-block;vertical-align:middle">`
    + `<g stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none">`
    + `<path d="M12 52 L24 100 L36 52"/>`
    + `<path d="M52 100 L64 52 L76 100 M57 84 H71"/>`
    + `<path d="M92 52 V100 H112"/>`
    + `<path d="M128 52 H150 M128 76 H146 M128 100 H150"/>`
    + `<path d="M232 100 V52 H248 a12 12 0 0 1 0 24 H232"/>`
    + `<path d="M272 100 L284 52 L296 100 M277 84 H291"/>`
    + `<path d="M312 52 V100 H332"/>`
    + `<path d="M348 52 V100 M374 52 V100 M348 76 H374"/>`
    + `<path d="M390 52 H412 M390 76 H408 M390 100 H412"/>`
    + `<path d="M428 52 V100"/>`
    + `<path d="M444 100 V52 H460 a12 12 0 0 1 0 24 H444 M458 76 L472 100"/>`
    + `<circle cx="500" cy="76" r="22"/>`
    + `</g>${sub}</svg>`;
}

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

  // Brand email signature (guide pp.42–44): editorial wordmark + contact.
  const signature = `<div style="border-top:1px solid ${C.line};margin-top:8px;padding:20px 24px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${C.muted};font-size:12px;line-height:1.55">`
    + `<div style="margin-bottom:10px">${wordmarkHtml(C.terracotta, 150)}</div>`
    + `<div style="color:${C.ink};font-weight:600">Vale Palheiro — Earth Resort</div>`
    + `Rua Vale Palheiro, 8670-016 Aljezur · Costa Vicentina<br>`
    + `<a href="https://www.valepalheiro.com" style="color:${C.ink};font-weight:600;text-decoration:none">valepalheiro.com</a> · +351 933 979 043`
    + `</div>`;

  return `<div style="background:${C.bg};padding:24px 12px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;background:${C.card};border:1px solid ${C.line};border-radius:14px;overflow:hidden">
<div style="background:${C.anthracite};padding:24px;text-align:center">${wordmarkHtml(C.offwhite, 200)}</div>
<div style="padding:26px 24px;color:${C.ink};font-size:15px;line-height:1.6">${html}</div>
${signature}
</div></div>`.replace(/\n/g, "");
}
