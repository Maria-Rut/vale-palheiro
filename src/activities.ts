import type { Language } from "./types.ts";

/**
 * Vale Palheiro's experiences, with the weather each one suits.
 *
 * Names, descriptions and prices come from the resort's own Experiences Menu
 * (01_BrochuraExperiencias_VP_v4). The weather rules are ours and are meant to
 * be tuned by the team. Entries marked `source: "team idea"` are free
 * suggestions that aren't in the brochure (e.g. watching a big Atlantic swell
 * from the cliffs).
 *
 * Staff can switch an experience off for the season in the dashboard; switched-
 * off experiences are never suggested.
 */

/** Conditions the recommender derives from each day's forecast. */
export type Condition =
  | "sunny"      // little cloud, little rain
  | "cloudy"     // dry but grey
  | "showers"    // some rain likely
  | "rainy"      // a wet day
  | "windy"      // strong gusts
  | "calm"       // light wind
  | "big_sea"    // big Atlantic swell — a show from the cliffs
  | "surf_sea"   // good waves for a lesson
  | "flat_sea"   // calm water for boats and kayaks
  | "warm";      // a warm day

export type Category = "land" | "sea" | "wellbeing" | "table" | "craft";

export interface Activity {
  id: string;
  category: Category;
  name: Record<Language, string>;
  /** One sentence for the email: what it is, in the resort's voice. */
  pitch: Record<Language, string>;
  /** "from €50", "price on request", "free" — rendered per language. */
  price: { from?: number; onRequest?: boolean; free?: boolean; guestsOnly?: boolean };
  /** Weather it is best in (each match raises the score). */
  goodIn: Condition[];
  /** Weather that rules it out. */
  notIn: Condition[];
  /** All of these must hold (e.g. a balloon needs calm air). */
  needs?: Condition[];
  /** A lovely way to end a stay. */
  finale?: boolean;
  /** Works indoors / under a roof. */
  indoor?: boolean;
  /** Good with children. */
  family?: boolean;
  source: "brochure" | "team idea";
  enabled: boolean;
}

const A: Activity[] = [
  // ---------------------------------------------------------- land
  {
    id: "trail", category: "land", source: "brochure", enabled: true, family: false,
    name: { en: "Vale Palheiro Trail", pt: "Trilho Vale Palheiro", fr: "Sentier Vale Palheiro" },
    pitch: {
      en: "walk the Vale Palheiro Trail to Monte Clérigo beach with a local guide — about 4 hours, 9 km, ending with a picnic",
      pt: "faça o Trilho Vale Palheiro até à Praia de Monte Clérigo com um guia local — cerca de 4 horas e 9 km, a terminar com piquenique",
      fr: "parcourez le Sentier Vale Palheiro jusqu'à la plage de Monte Clérigo avec un guide local — environ 4 heures, 9 km, avec un pique-nique à l'arrivée",
    },
    price: { from: 50 }, goodIn: ["sunny", "cloudy", "calm"], notIn: ["rainy", "showers", "windy"],
  },
  {
    id: "picnic", category: "table", source: "brochure", enabled: true, family: true,
    name: { en: "Vale Palheiro Picnic", pt: "Piquenique Vale Palheiro", fr: "Pique-nique Vale Palheiro" },
    pitch: {
      en: "take a Vale Palheiro picnic of local, seasonal produce down to the Ribeira or the beach",
      pt: "leve um piquenique Vale Palheiro, com produtos locais e da época, até à Ribeira ou à praia",
      fr: "emportez un pique-nique Vale Palheiro de produits locaux et de saison au bord de la Ribeira ou à la plage",
    },
    price: { onRequest: true }, goodIn: ["sunny", "warm", "calm"], notIn: ["rainy", "showers", "windy"],
  },
  {
    id: "jeep", category: "land", source: "brochure", enabled: true, family: true, finale: true,
    name: { en: "Jeep tour", pt: "Tour de jipe", fr: "Excursion en jeep" },
    pitch: {
      en: "a sunset jeep tour along earth tracks to viewpoints over the coast that are hard to find alone",
      pt: "um tour de jipe ao pôr do sol, por trilhos de terra, até miradouros sobre a costa difíceis de encontrar sozinho",
      fr: "une excursion en jeep au coucher du soleil, par les pistes, vers des points de vue sur la côte difficiles à trouver seul",
    },
    price: { from: 55 }, goodIn: ["sunny", "cloudy"], notIn: ["rainy"],
  },
  {
    id: "horse", category: "land", source: "brochure", enabled: true, family: true,
    name: { en: "Horse riding", pt: "Passeio a cavalo", fr: "Balade à cheval" },
    pitch: {
      en: "a horse ride through the landscape, at sunrise or sunset if you like",
      pt: "um passeio a cavalo pela paisagem, ao nascer ou ao pôr do sol se preferir",
      fr: "une balade à cheval dans le paysage, au lever ou au coucher du soleil si vous le souhaitez",
    },
    price: { from: 60 }, goodIn: ["sunny", "cloudy", "calm"], notIn: ["rainy", "showers", "windy"],
  },
  {
    id: "balloon", category: "land", source: "brochure", enabled: true, finale: true,
    name: { en: "Balloon flight", pt: "Passeio de balão", fr: "Vol en montgolfière" },
    pitch: {
      en: "a balloon flight at sunrise, watching the light open over the hills, the valley and the coast",
      pt: "um passeio de balão ao nascer do sol, com a luz a abrir sobre a serra, o vale e a costa",
      fr: "un vol en montgolfière au lever du soleil, quand la lumière s'ouvre sur les collines, la vallée et la côte",
    },
    price: { from: 235 }, goodIn: ["sunny"], notIn: ["rainy", "showers", "windy"], needs: ["calm"],
  },
  {
    id: "guided_walk", category: "land", source: "brochure", enabled: true,
    name: { en: "Guided walk", pt: "Caminhada guiada", fr: "Randonnée guidée" },
    pitch: {
      en: "a guided walk along the Aljezur cliffs, at your own pace",
      pt: "uma caminhada guiada pelas falésias de Aljezur, ao seu ritmo",
      fr: "une randonnée guidée sur les falaises d'Aljezur, à votre rythme",
    },
    price: { from: 60 }, goodIn: ["cloudy", "sunny"], notIn: ["rainy", "windy"],
  },
  {
    id: "bikes", category: "land", source: "brochure", enabled: true, family: true,
    name: { en: "Bicycles", pt: "Bicicletas", fr: "Vélos" },
    pitch: {
      en: "borrow our bicycles and ride the estate paths into Aljezur or down to the beach",
      pt: "use as nossas bicicletas pelos caminhos da propriedade até à vila de Aljezur ou à praia",
      fr: "empruntez nos vélos pour rejoindre le village d'Aljezur ou la plage par les chemins du domaine",
    },
    price: { free: true, guestsOnly: true }, goodIn: ["sunny", "calm"], notIn: ["rainy", "showers", "windy"],
  },
  // ---------------------------------------------------------- sea
  {
    id: "sea_watch", category: "sea", source: "team idea", enabled: true, family: true,
    name: { en: "Watching the Atlantic", pt: "Ver o Atlântico", fr: "Regarder l'Atlantique" },
    pitch: {
      en: "head to the cliffs at Monte Clérigo or Arrifana and watch the power of the sea — waves like these are a show (keep well back from the edge)",
      pt: "vá até às falésias de Monte Clérigo ou da Arrifana e veja a força do mar — ondas assim são um espetáculo (mantenha-se longe da beira)",
      fr: "allez sur les falaises de Monte Clérigo ou d'Arrifana voir la puissance de l'océan — des vagues pareilles sont un spectacle (restez loin du bord)",
    },
    price: { free: true }, goodIn: ["big_sea", "sunny", "cloudy"], notIn: ["rainy"], needs: ["big_sea"],
  },
  {
    id: "surf", category: "sea", source: "brochure", enabled: true, family: true,
    name: { en: "Surf lesson", pt: "Aula de surf", fr: "Cours de surf" },
    pitch: {
      en: "a surf lesson with experienced instructors, on the beach that suits the day's waves",
      pt: "uma aula de surf com instrutores experientes, na praia que melhor se adapta às ondas do dia",
      fr: "un cours de surf avec des moniteurs expérimentés, sur la plage la mieux adaptée aux vagues du jour",
    },
    price: { from: 55 }, goodIn: ["surf_sea", "sunny", "warm"], notIn: ["big_sea", "windy", "rainy"], needs: ["surf_sea"],
  },
  {
    id: "boat", category: "sea", source: "brochure", enabled: true, family: true,
    name: { en: "Boat trip from Lagos", pt: "Passeio de barco em Lagos", fr: "Sortie en bateau depuis Lagos" },
    pitch: {
      en: "a boat trip from Lagos to see the cliffs, caves and coves from the water",
      pt: "um passeio de barco a partir de Lagos, para ver as falésias, grutas e enseadas a partir do mar",
      fr: "une sortie en bateau depuis Lagos pour voir les falaises, grottes et criques depuis la mer",
    },
    price: { from: 22.5 }, goodIn: ["flat_sea", "sunny", "calm"], notIn: ["windy", "rainy", "big_sea"], needs: ["flat_sea"],
  },
  {
    id: "kayak", category: "sea", source: "brochure", enabled: true,
    name: { en: "Kayak tour from Lagos", pt: "Passeio de kayak em Lagos", fr: "Kayak depuis Lagos" },
    pitch: {
      en: "a kayak tour from Lagos, slow and quiet, in and out of the sea caves",
      pt: "um passeio de kayak a partir de Lagos, lento e silencioso, entre as grutas",
      fr: "une sortie en kayak depuis Lagos, lente et silencieuse, entre les grottes marines",
    },
    price: { from: 50 }, goodIn: ["flat_sea", "sunny", "calm", "warm"], notIn: ["windy", "rainy", "showers", "big_sea"], needs: ["flat_sea", "calm"],
  },
  // ---------------------------------------------------------- wellbeing
  {
    id: "massage", category: "wellbeing", source: "brochure", enabled: true, indoor: true, finale: true,
    name: { en: "Massage in your villa", pt: "Massagem na sua casa", fr: "Massage dans votre villa" },
    pitch: {
      en: "a day to slow down: a massage in the privacy of your villa (couples' massages too)",
      pt: "um dia para abrandar: uma massagem na privacidade da sua casa (também a dois)",
      fr: "une journée pour ralentir : un massage dans l'intimité de votre villa (en duo aussi)",
    },
    price: { onRequest: true }, goodIn: ["rainy", "showers", "windy"], notIn: [],
  },
  {
    id: "yoga", category: "wellbeing", source: "brochure", enabled: true, indoor: true,
    name: { en: "Yoga class", pt: "Aula de yoga", fr: "Cours de yoga" },
    pitch: {
      en: "a yoga class in the Terracotta Lounge, with the landscape in front of you",
      pt: "uma aula de yoga no Terracotta Lounge, com a paisagem à sua frente",
      fr: "un cours de yoga au Terracotta Lounge, face au paysage",
    },
    price: { from: 55 }, goodIn: ["showers", "cloudy", "rainy", "calm"], notIn: [],
  },
  {
    id: "pilates", category: "wellbeing", source: "brochure", enabled: true, indoor: true,
    name: { en: "Pilates or barre class", pt: "Aula de pilates ou barre", fr: "Cours de pilates ou de barre" },
    pitch: {
      en: "a Pilates or barre class in the Terracotta Lounge — strength, balance and a quiet setting",
      pt: "uma aula de pilates ou barre no Terracotta Lounge — força, equilíbrio e um ambiente tranquilo",
      fr: "un cours de pilates ou de barre au Terracotta Lounge — force, équilibre et calme",
    },
    price: { from: 55 }, goodIn: ["rainy", "showers", "cloudy"], notIn: [],
  },
  // ---------------------------------------------------------- table
  {
    id: "wine", category: "table", source: "brochure", enabled: true, indoor: true, finale: true,
    name: { en: "Wine tasting", pt: "Prova de vinhos", fr: "Dégustation de vins" },
    pitch: {
      en: "a guided tasting of wines from the region — a conversation about land, climate and taste",
      pt: "uma prova guiada de vinhos da região — uma conversa sobre território, clima e gosto",
      fr: "une dégustation guidée de vins de la région — une conversation sur le terroir, le climat et le goût",
    },
    price: { from: 35 }, goodIn: ["rainy", "showers", "cloudy", "windy"], notIn: [],
  },
  {
    id: "cooking", category: "table", source: "brochure", enabled: true, indoor: true, family: true,
    name: { en: "Cooking workshop", pt: "Workshop de cozinha", fr: "Atelier de cuisine" },
    pitch: {
      en: "a cooking workshop with local ingredients and recipes",
      pt: "um workshop de cozinha com ingredientes e receitas locais",
      fr: "un atelier de cuisine avec des produits et recettes locales",
    },
    price: { onRequest: true }, goodIn: ["rainy", "showers", "windy"], notIn: [],
  },
  {
    id: "private_dinner", category: "table", source: "brochure", enabled: true, indoor: true, finale: true,
    name: { en: "Private dinner", pt: "Jantar privado", fr: "Dîner privé" },
    pitch: {
      en: "a private dinner prepared for you at Vale Palheiro",
      pt: "um jantar privado preparado para si no Vale Palheiro",
      fr: "un dîner privé préparé pour vous à Vale Palheiro",
    },
    price: { onRequest: true }, goodIn: [], notIn: [],
  },
  // ---------------------------------------------------------- craft
  {
    id: "workshop", category: "craft", source: "brochure", enabled: true, indoor: true,
    name: { en: "Creative workshop", pt: "Workshop criativo", fr: "Atelier créatif" },
    pitch: {
      en: "a ceramics or painting workshop with a local artisan in the Terracotta Lounge",
      pt: "um workshop de cerâmica ou pintura com um artesão local no Terracotta Lounge",
      fr: "un atelier de céramique ou de peinture avec un artisan local au Terracotta Lounge",
    },
    price: { onRequest: true }, goodIn: ["rainy", "showers"], notIn: [],
  },
  {
    id: "perfume", category: "craft", source: "brochure", enabled: true, indoor: true,
    name: { en: "Perfume workshop", pt: "Workshop de perfumes", fr: "Atelier de parfum" },
    pitch: {
      en: "a perfume workshop to create your own fragrance with a specialist — a scent to take the place home with you",
      pt: "um workshop de perfumes para criar a sua própria fragrância com um especialista — um aroma para levar este lugar consigo",
      fr: "un atelier de parfum pour créer votre propre fragrance avec un spécialiste — une façon d'emporter le lieu avec vous",
    },
    price: { onRequest: true }, goodIn: ["rainy", "showers"], notIn: [], // menu price is for groups of 10
  },
];

let catalogue: Activity[] = structuredClone(A);

export function getActivities(): Activity[] {
  return catalogue;
}

export function setActivityEnabled(id: string, enabled: boolean): boolean {
  const a = catalogue.find((x) => x.id === id);
  if (!a) return false;
  a.enabled = enabled;
  return true;
}

export function priceLabel(a: Activity, lang: Language): string {
  const p = a.price;
  if (p.free) {
    return p.guestsOnly
      ? { en: "free for guests", pt: "gratuito para hóspedes", fr: "gratuit pour nos hôtes" }[lang]
      : { en: "free", pt: "gratuito", fr: "gratuit" }[lang];
  }
  if (p.onRequest) return { en: "price on request", pt: "preço sob consulta", fr: "prix sur demande" }[lang];
  const v = Number.isInteger(p.from) ? String(p.from) : (p.from ?? 0).toFixed(2);
  const n = lang === "en" ? `€${v}` : `${v.replace(".", ",")} €`;
  return { en: `from ${n}`, pt: `a partir de ${n}`, fr: `à partir de ${n}` }[lang];
}
