import type { Language } from "./types.ts";

/**
 * Vale Palheiro's real Experiences Menu, transcribed from the resort's own
 * "Menu de Experiências / Experiences Menu". Prices and descriptions are taken
 * directly from that document — nothing invented.
 *
 * Each experience is tagged with:
 *   - category: the menu section it belongs to
 *   - weather: which conditions it suits, so the post-check-in email can
 *     suggest sensible activities for the day
 *   - interests: tags that map to the guest questionnaire, so suggestions can
 *     also respect what a guest said they care about
 *
 * "Weather" tags are our own practical classification of each real activity
 * (e.g. surf suits fair weather; a spa massage suits any day), not a claim
 * from the menu.
 */

export type WeatherKind = "sunny" | "cloudy" | "rainy" | "windy";
export type Interest =
  | "land_trails"
  | "sea_coast"
  | "wellbeing"
  | "food_wine"
  | "crafts";

export interface Experience {
  id: string;
  /** Name in English and Portuguese, exactly as on the menu. */
  name: Record<Language, string>;
  /** Short description in each language, condensed from the menu. */
  blurb: Record<Language, string>;
  /** Price label as printed on the menu (keeps "from", "on request", etc.). */
  price: Record<Language, string>;
  category:
    | "land_trails"
    | "sea_coast"
    | "wellbeing"
    | "food_wine"
    | "crafts";
  /** Weather conditions this activity is well suited to. */
  weather: WeatherKind[];
  /** Questionnaire interest tags this activity satisfies. */
  interests: Interest[];
  /** True for things that are comfortable regardless of weather (mostly indoor). */
  allWeather?: boolean;
}

// French falls back to English on the blurb where the menu is bilingual PT/EN
// only; names are kept in the menu's PT/EN form.
const fr = (en: string) => en;

export const EXPERIENCES: Experience[] = [
  // ---------- LAND, TRAILS & LANDSCAPE ----------
  {
    id: "vale_palheiro_trail",
    name: { en: "Vale Palheiro Trail", pt: "Trilho Vale Palheiro", fr: "Sentier Vale Palheiro" },
    blurb: {
      en: "A guided ~4-hour, 9 km walk from the estate to Monte Clérigo beach, ending with a picnic.",
      pt: "Uma caminhada guiada de ~4 horas e 9 km, de Vale Palheiro à Praia de Monte Clérigo, a terminar com piquenique.",
      fr: fr("A guided ~4-hour, 9 km walk from the estate to Monte Clérigo beach, ending with a picnic."),
    },
    price: { en: "from €50", pt: "a partir de 50 €", fr: "à partir de 50 €" },
    category: "land_trails",
    weather: ["sunny", "cloudy"],
    interests: ["land_trails"],
  },
  {
    id: "guided_walks",
    name: { en: "Guided Walks", pt: "Caminhadas Guiadas", fr: "Randonnées guidées" },
    blurb: {
      en: "Selected routes across the region, from the cliffs of Aljezur to the south coast, adapted to your pace.",
      pt: "Percursos selecionados na região, das falésias de Aljezur à costa sul, adaptados ao seu ritmo.",
      fr: fr("Selected routes across the region, from the cliffs of Aljezur to the south coast, adapted to your pace."),
    },
    price: { en: "from €60", pt: "a partir de 60 €", fr: "à partir de 60 €" },
    category: "land_trails",
    weather: ["sunny", "cloudy"],
    interests: ["land_trails"],
  },
  {
    id: "jeep_tour",
    name: { en: "Jeep Tour", pt: "Tour de Jipe", fr: "Excursion en 4x4" },
    blurb: {
      en: "Reach less obvious places — earth tracks, mountains, coast and viewpoints; can be at sunset or with a wine tasting or lunch.",
      pt: "Chegar a lugares menos óbvios — trilhos, montanhas, costa e miradouros; pode ser ao pôr do sol ou com prova de vinhos ou almoço.",
      fr: fr("Reach less obvious places — earth tracks, mountains, coast and viewpoints; can be at sunset or with a wine tasting or lunch."),
    },
    price: { en: "from €55", pt: "a partir de 55 €", fr: "à partir de 55 €" },
    category: "land_trails",
    weather: ["sunny", "cloudy", "windy"],
    interests: ["land_trails"],
  },
  {
    id: "horse_riding",
    name: { en: "Horse Riding", pt: "Passeios a Cavalo", fr: "Balades à cheval" },
    blurb: {
      en: "A horse ride through the landscape at an unhurried pace, with sunrise or sunset routes available.",
      pt: "Um passeio a cavalo pela paisagem, sem pressa, com percursos ao nascer ou pôr do sol.",
      fr: fr("A horse ride through the landscape at an unhurried pace, with sunrise or sunset routes available."),
    },
    price: { en: "from €60", pt: "a partir de 60 €", fr: "à partir de 60 €" },
    category: "land_trails",
    weather: ["sunny", "cloudy"],
    interests: ["land_trails"],
  },
  {
    id: "balloon_flight",
    name: { en: "Balloon Flight", pt: "Passeio de Balão", fr: "Vol en montgolfière" },
    blurb: {
      en: "See the landscape from another scale at sunrise or sunset, as the light opens over hills, valley and coast.",
      pt: "Ver a paisagem de outra escala, ao nascer ou pôr do sol, quando a luz abre sobre a serra, o vale e a costa.",
      fr: fr("See the landscape from another scale at sunrise or sunset, as the light opens over hills, valley and coast."),
    },
    price: { en: "from €235", pt: "a partir de 235 €", fr: "à partir de 235 €" },
    category: "land_trails",
    weather: ["sunny"],
    interests: ["land_trails"],
  },
  {
    id: "bicycles",
    name: { en: "Bicycles", pt: "Bicicletas", fr: "Vélos" },
    blurb: {
      en: "Guest bicycles to move freely along the estate's paths, to Aljezur village or down to the beach.",
      pt: "Bicicletas para hóspedes, para circular pelos caminhos da propriedade, até à vila de Aljezur ou à praia.",
      fr: fr("Guest bicycles to move freely along the estate's paths, to Aljezur village or down to the beach."),
    },
    price: { en: "exclusive use for guests", pt: "utilização exclusiva para hóspedes", fr: "usage exclusif pour les hôtes" },
    category: "land_trails",
    weather: ["sunny", "cloudy"],
    interests: ["land_trails"],
  },

  // ---------- SEA & COAST ----------
  {
    id: "surf_lessons",
    name: { en: "Surf Lessons", pt: "Aulas de Surf", fr: "Cours de surf" },
    blurb: {
      en: "Lessons with experienced instructors on beaches chosen for the day's conditions — for beginners or returning surfers.",
      pt: "Aulas com instrutores experientes, em praias escolhidas conforme as condições do dia — para quem começa ou regressa.",
      fr: fr("Lessons with experienced instructors on beaches chosen for the day's conditions — for beginners or returning surfers."),
    },
    price: { en: "from €55", pt: "a partir de 55 €", fr: "à partir de 55 €" },
    category: "sea_coast",
    weather: ["sunny", "cloudy", "windy"],
    interests: ["sea_coast"],
  },
  {
    id: "boat_trips",
    name: { en: "Boat Trips", pt: "Passeios de Barco", fr: "Sorties en bateau" },
    blurb: {
      en: "Departing from Lagos, the Algarve seen from the water: cliffs, caves, coves and open light.",
      pt: "Com partida em Lagos, o Algarve visto do mar: falésias, grutas, enseadas e luz aberta.",
      fr: fr("Departing from Lagos, the Algarve seen from the water: cliffs, caves, coves and open light."),
    },
    price: { en: "from €22.50", pt: "a partir de 22,50 €", fr: "à partir de 22,50 €" },
    category: "sea_coast",
    weather: ["sunny", "cloudy"],
    interests: ["sea_coast"],
  },
  {
    id: "kayak_tours",
    name: { en: "Kayak Tours", pt: "Passeios de Kayak", fr: "Sorties en kayak" },
    blurb: {
      en: "Also from Lagos — slower and quieter, between sheltered areas and natural formations at the rhythm of the paddle.",
      pt: "Também de Lagos — mais lento e silencioso, entre zonas abrigadas e formações naturais, ao ritmo da remada.",
      fr: fr("Also from Lagos — slower and quieter, between sheltered areas and natural formations at the rhythm of the paddle."),
    },
    price: { en: "from €50", pt: "a partir de 50 €", fr: "à partir de 50 €" },
    category: "sea_coast",
    weather: ["sunny", "cloudy"],
    interests: ["sea_coast"],
  },

  // ---------- BODY, MOVEMENT & WELLBEING ----------
  {
    id: "massages",
    name: { en: "Massages", pt: "Massagens", fr: "Massages" },
    blurb: {
      en: "Arranged in the privacy of your house or villa, subject to booking; couple massages can be organised in-room.",
      pt: "Realizadas na privacidade da sua casa ou villa, mediante marcação; é possível organizar massagens em casal no quarto.",
      fr: fr("Arranged in the privacy of your house or villa, subject to booking; couple massages can be organised in-room."),
    },
    price: { en: "on request", pt: "sob consulta", fr: "sur demande" },
    category: "wellbeing",
    weather: ["sunny", "cloudy", "rainy", "windy"],
    interests: ["wellbeing"],
    allWeather: true,
  },
  {
    id: "yoga",
    name: { en: "Yoga Classes", pt: "Aulas de Yoga", fr: "Cours de yoga" },
    blurb: {
      en: "A practice to slow down and create presence, at the Terracotta Lounge or outdoors with the landscape in front.",
      pt: "Uma prática para abrandar e criar presença, no Terracotta Lounge ou ao ar livre com a paisagem à frente.",
      fr: fr("A practice to slow down and create presence, at the Terracotta Lounge or outdoors with the landscape in front."),
    },
    price: { en: "from €55 (1 guest)", pt: "a partir de 55 € (1 pessoa)", fr: "à partir de 55 € (1 pers.)" },
    category: "wellbeing",
    weather: ["sunny", "cloudy", "rainy", "windy"],
    interests: ["wellbeing"],
    allWeather: true,
  },
  {
    id: "pilates",
    name: { en: "Pilates Classes", pt: "Aulas de Pilates", fr: "Cours de Pilates" },
    blurb: {
      en: "A class focused on strength, mobility and body awareness in a peaceful setting close to nature.",
      pt: "Uma aula focada em força, mobilidade e consciência corporal, num ambiente tranquilo.",
      fr: fr("A class focused on strength, mobility and body awareness in a peaceful setting close to nature."),
    },
    price: { en: "from €55 (1 guest)", pt: "a partir de 55 € (1 pessoa)", fr: "à partir de 55 € (1 pers.)" },
    category: "wellbeing",
    weather: ["sunny", "cloudy", "rainy", "windy"],
    interests: ["wellbeing"],
    allWeather: true,
  },
  {
    id: "barre",
    name: { en: "Barre Classes", pt: "Aulas de Barre", fr: "Cours de Barre" },
    blurb: {
      en: "Strength, balance and posture through ballet-inspired movement — energy, lightness and precision.",
      pt: "Força, equilíbrio e postura com movimentos inspirados no ballet — energia, leveza e precisão.",
      fr: fr("Strength, balance and posture through ballet-inspired movement — energy, lightness and precision."),
    },
    price: { en: "from €55 (1 guest)", pt: "a partir de 55 € (1 pessoa)", fr: "à partir de 55 € (1 pers.)" },
    category: "wellbeing",
    weather: ["sunny", "cloudy", "rainy", "windy"],
    interests: ["wellbeing"],
    allWeather: true,
  },

  // ---------- AT THE TABLE ----------
  {
    id: "wine_tasting",
    name: { en: "Wine Tasting", pt: "Prova de Vinhos", fr: "Dégustation de vins" },
    blurb: {
      en: "A guided tasting of regional wines, grapes and producers — a conversation about territory, climate, time and taste.",
      pt: "Uma prova guiada de vinhos, castas e produtores da região — uma conversa sobre território, clima, tempo e gosto.",
      fr: fr("A guided tasting of regional wines, grapes and producers — a conversation about territory, climate, time and taste."),
    },
    price: { en: "from €35", pt: "a partir de 35 €", fr: "à partir de 35 €" },
    category: "food_wine",
    weather: ["sunny", "cloudy", "rainy", "windy"],
    interests: ["food_wine"],
    allWeather: true,
  },
  {
    id: "cooking_workshop",
    name: { en: "Cooking Workshop", pt: "Workshop de Cozinha", fr: "Atelier de cuisine" },
    blurb: {
      en: "Discover local ingredients, recipes and flavours in a simple, intimate format, upon request.",
      pt: "Descobrir ingredientes, receitas e sabores locais, num formato simples e próximo, a pedido.",
      fr: fr("Discover local ingredients, recipes and flavours in a simple, intimate format, upon request."),
    },
    price: { en: "on request", pt: "sob consulta", fr: "sur demande" },
    category: "food_wine",
    weather: ["sunny", "cloudy", "rainy", "windy"],
    interests: ["food_wine"],
    allWeather: true,
  },
  {
    id: "private_dining",
    name: { en: "Private Lunch or Dinner", pt: "Almoço ou Jantar Privado", fr: "Déjeuner ou dîner privé" },
    blurb: {
      en: "A private meal at Vale Palheiro for special moments, small groups or celebrations, by prior arrangement.",
      pt: "Uma refeição privada em Vale Palheiro para momentos especiais, pequenos grupos ou celebrações, mediante confirmação.",
      fr: fr("A private meal at Vale Palheiro for special moments, small groups or celebrations, by prior arrangement."),
    },
    price: { en: "on request", pt: "sob consulta", fr: "sur demande" },
    category: "food_wine",
    weather: ["sunny", "cloudy", "rainy", "windy"],
    interests: ["food_wine"],
    allWeather: true,
  },

  // ---------- WORKSHOPS & LOCAL CRAFTS ----------
  {
    id: "creative_workshops",
    name: { en: "Creative Workshops", pt: "Workshops Criativos", fr: "Ateliers créatifs" },
    blurb: {
      en: "Ceramics, painting and traditional crafts with local artisans at the Terracotta Lounge, upon request.",
      pt: "Cerâmica, pintura e técnicas tradicionais com artesãos locais no Terracotta Lounge, a pedido.",
      fr: fr("Ceramics, painting and traditional crafts with local artisans at the Terracotta Lounge, upon request."),
    },
    price: { en: "on request", pt: "sob consulta", fr: "sur demande" },
    category: "crafts",
    weather: ["sunny", "cloudy", "rainy", "windy"],
    interests: ["crafts"],
    allWeather: true,
  },
  {
    id: "perfume_workshop",
    name: { en: "Perfume Workshop", pt: "Workshop de Perfumes", fr: "Atelier de parfum" },
    blurb: {
      en: "A sensory workshop to create a personalised fragrance with a specialist — intimate, tied to scent and memory.",
      pt: "Uma oficina sensorial para criar uma fragrância personalizada com um especialista — íntima, ligada ao olfato e à memória.",
      fr: fr("A sensory workshop to create a personalised fragrance with a specialist — intimate, tied to scent and memory."),
    },
    price: { en: "from €85 (group of 10)", pt: "a partir de 85 € (grupo de 10)", fr: "à partir de 85 € (groupe de 10)" },
    category: "crafts",
    weather: ["sunny", "cloudy", "rainy", "windy"],
    interests: ["crafts"],
    allWeather: true,
  },
];

/**
 * Is a day good for being outdoors?
 * Outdoor experiences are those not tagged `allWeather` (trails, surf, riding…).
 */
function isFairWeather(w: WeatherKind): boolean {
  return w === "sunny" || w === "cloudy";
}

/**
 * Choose up to `limit` experiences that suit the weather and (optionally) the
 * guest's stated interests.
 *
 * Priorities, in order:
 *   1. Only keep experiences that genuinely fit the weather (an outdoor-only
 *      activity is dropped on a rainy/windy day).
 *   2. Match the guest's stated interests.
 *   3. On fair weather, lean *towards* the outdoors (that's the whole point of
 *      being here); on poor weather, lean towards comfortable indoor options.
 *   4. Vary the suggestions across categories so we don't send three near-
 *      identical ideas.
 */
export function suggestExperiences(
  weather: WeatherKind,
  interests: Interest[] = [],
  limit = 3,
): Experience[] {
  const fair = isFairWeather(weather);

  // Step 1: weather-fit pool. Outdoor activities only survive on fair days.
  const pool = EXPERIENCES.filter((e) =>
    e.allWeather ? true : e.weather.includes(weather),
  );

  const isOutdoor = (e: Experience) => !e.allWeather;

  const score = (e: Experience) => {
    let s = 0;
    if (interests.length && e.interests.some((i) => interests.includes(i))) s += 10;
    // Favour outdoors on a nice day, indoors when the weather is against us.
    if (fair && isOutdoor(e)) s += 4;
    if (!fair && e.allWeather) s += 4;
    if (e.weather.includes(weather)) s += 1;
    return s;
  };

  const ranked = [...pool].sort((a, b) => score(b) - score(a));

  // Step 4: diversify — take the best from distinct categories first, then fill.
  const picked: Experience[] = [];
  const seenCategories = new Set<string>();
  for (const e of ranked) {
    if (picked.length >= limit) break;
    if (!seenCategories.has(e.category)) {
      picked.push(e);
      seenCategories.add(e.category);
    }
  }
  if (picked.length < limit) {
    for (const e of ranked) {
      if (picked.length >= limit) break;
      if (!picked.includes(e)) picked.push(e);
    }
  }
  return picked;
}
