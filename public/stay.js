/* Guest "prepare your stay" page — vanilla JS, no build step.
 *
 * Everything starts pre-filled with what most guests love, so a happy guest
 * taps one button. Extras (food, occasions, experiences) stay folded away.
 */

const $ = (s) => document.querySelector(s);
const token = location.pathname.split("/").filter(Boolean)[1] || "";

const ICONS = {
  fire: '<path d="M12 3c1 3 4 4.5 4 9a4 4 0 0 1-8 0c0-2 1-3 1-3 .5 1.5 1.5 2 1.5 2C10 8 12 6 12 3z"/>',
  bottle: '<path d="M10 3h4M10.5 3v4.5L8.5 10v10a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1V10l-2-2.5V3"/><path d="M8.5 14h7"/>',
  bed: '<path d="M3 18v-8M21 18v-5a3 3 0 0 0-3-3H11v5M3 15h18"/><circle cx="7" cy="12" r="1.6"/>',
  plug: '<path d="M9 3v5M15 3v5M7 8h10v3a5 5 0 0 1-10 0V8zM12 16v5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  leaf: '<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"/><path d="M5 19l7-7"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
  path: '<path d="M6 20c2-4 8-4 8-8s-4-4-4-8"/><circle cx="17" cy="5" r="1.5"/>',
  note: '<path d="M5 4h10l4 4v12H5z"/><path d="M8 11h8M8 15h6"/>',
  wifi: '<path d="M4 9.5a12 12 0 0 1 16 0M7 13a7.5 7.5 0 0 1 10 0M10 16.5a3 3 0 0 1 4 0"/><circle cx="12" cy="19.5" r="0.8"/>',
  phone: '<path d="M6 3h3l1.5 4.5-2 1.5a11 11 0 0 0 6.5 6.5l1.5-2L21 15v3a2 2 0 0 1-2 2A17 17 0 0 1 4 5a2 2 0 0 1 2-2z"/>',
  home: '<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-5h4v5"/>',
};
function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
}

/**
 * Vale Palheiro's own Experiences Menu (brochure v4). Prices are the
 * brochure's "from" prices; null means "price on request".
 */
const EXPERIENCES = [
  { id: "trail", group: "land", price: 50 },
  { id: "picnic", group: "land", price: null },
  { id: "jeep", group: "land", price: 55 },
  { id: "horse", group: "land", price: 60 },
  { id: "balloon", group: "land", price: 235 },
  { id: "bikes", group: "land", price: 0 },
  { id: "surf", group: "sea", price: 55 },
  { id: "boat", group: "sea", price: 22.5 },
  { id: "kayak", group: "sea", price: 50 },
  { id: "yoga", group: "body", price: 55 },
  { id: "massage", group: "body", price: null },
  { id: "wine_tasting", group: "table", price: 35 },
  { id: "barn", group: "table", price: null, noPrice: true },
  { id: "private_dinner", group: "table", price: null },
  { id: "cooking", group: "table", price: null },
  { id: "workshop", group: "crafts", price: null },
  { id: "transfer", group: "services", price: null },
  { id: "babysitting", group: "services", price: null },
];

/** Three ideas that fit the moment, shown before the full menu. */
function suggestions() {
  const o = prefs.occasion;
  if (o === "anniversary" || o === "honeymoon") return ["massage", "private_dinner", "balloon"];
  if (o === "birthday") return ["private_dinner", "wine_tasting", "jeep"];
  if (o === "treat") return ["massage", "picnic", "horse"];
  if (stay.partySize >= 3) return ["picnic", "surf", "bikes"];
  return ["trail", "wine_tasting", "horse"];
}

const T = {
  en: {
    hero: (n) => `${n}, let's get the valley ready for you`,
    stayLine: (place, dates, n) => `${place} · ${dates} · ${n} ${n === 1 ? "guest" : "guests"}`,
    countdown: (d) => (d <= 1 ? "Tomorrow" : `In ${d} days`),
    lead: "We've set everything up the way most guests love it. <b>Change anything you like</b> — or just tap the button.",
    leadTime: "Takes about 30 seconds",
    fireplace: "Fireplace",
    fireplaceSub: "Laid and ready to light when you arrive",
    fridge: "Waiting in your fridge",
    fridgeHint: "Pick as many as you like. We'll confirm prices with you before stocking anything beyond water.",
    drinkOpts: { still_water: "Still water", sparkling_water: "Sparkling water", wine: "Regional wine", sparkling_wine: "Something sparkling", beer: "Cold beer", alcohol_free: "Alcohol-free drinks" },
    beds: "How would you like to sleep?",
    bedOpts: { as_booked: "Just as booked", separate: "Separate beds, please", extra: "One more bed for someone" },
    bedsHint: "We'll check what's possible in your villa and confirm with you.",
    adapter: "Need a plug adapter?",
    adapterHint: "Portugal uses European two-pin sockets (230V).",
    adapterOpts: { none: "No, all set", uk: "UK plug", us: "US plug", other: "Another type" },
    arrival: "When do you think you'll arrive?",
    arrivalOpts: { early: "Before 3pm", afternoon: "3–6pm", evening: "6–9pm", late: "After 9pm" },
    extrasTitle: "Make it even more yours",
    extrasSub: "All optional — open only what matters to you.",
    foodTitle: "Food & allergies",
    foodHint: "So The Barn can cook just for you",
    dietOpts: { vegetarian: "Vegetarian", vegan: "Vegan", pescatarian: "Pescatarian", gluten_free: "Gluten-free", lactose_free: "Lactose-free" },
    allergiesLabel: "Any allergies?",
    allergiesPh: "e.g. nuts, shellfish…",
    consent: "I agree that Vale Palheiro may use this allergy information only to prepare my food safely during this stay. It is deleted automatically after I check out.",
    consentErr: "Please tick the box so we can keep your allergy information — or clear the field.",
    occasionTitle: "Celebrating something?",
    occasionHint: "We love a reason to make it special",
    occasionOpts: { birthday: "Birthday", anniversary: "Anniversary", honeymoon: "Honeymoon", treat: "Do we need a reason?", other: "Something else" },
    occasionPh: "Tell us a little (optional)",
    interestTitle: "Experiences",
    interestHint: "Tap what tempts you — we'll arrange the rest",
    pickedForYou: "Picked for you",
    seeAll: "See all experiences",
    expHint: "Nothing is booked yet. Our team will get in touch to arrange times and confirm prices.",
    groups: { land: "Land, trails & landscape", sea: "Sea & coast", body: "Body & wellbeing", table: "At the table", crafts: "Workshops & local crafts", services: "Helpful extras" },
    exp: {
      trail: ["Vale Palheiro Trail", "Guided 9 km walk to Monte Clérigo beach, ending with a picnic"],
      picnic: ["Vale Palheiro Picnic", "Local, seasonal food by the ribeira or on the beach"],
      jeep: ["Jeep tour", "Hidden viewpoints, mountains and coast — sunset optional"],
      horse: ["Horse riding", "Through the landscape, at sunrise or sunset"],
      balloon: ["Balloon flight", "The hills, valley and coast from above"],
      bikes: ["Bicycles", "Ride to Aljezur village or the beach"],
      surf: ["Surf lessons", "With experienced instructors, beginners welcome"],
      boat: ["Boat trip from Lagos", "Cliffs, caves and coves from the sea"],
      kayak: ["Kayak tour from Lagos", "Slower, quieter, closer to the water"],
      yoga: ["Yoga, Pilates or Barre", "In the Terracotta Lounge or outdoors"],
      massage: ["Massage in your villa", "Couples massages too"],
      wine_tasting: ["Wine tasting", "Regional wines, grapes and producers"],
      barn: ["A table at The Barn", "Our restaurant, celebrating the seasons"],
      private_dinner: ["Private lunch or dinner", "For celebrations and special moments"],
      cooking: ["Cooking workshop", "Local ingredients and recipes"],
      workshop: ["Creative workshop", "Ceramics, painting or perfume making"],
      transfer: ["Airport transfer", "Private transport to and from the airport"],
      babysitting: ["Babysitting", "A little time for the grown-ups"],
    },
    from: (p) => (p === 0 ? "Free for guests" : `From €${String(p).replace(".5", ".50")}`),
    onRequest: "On request",
    noteTitle: "A note for the team",
    noteHint: "Anything else we should know",
    notePh: "Anything at all…",
    remember: "Remember my preferences for future stays",
    submitDefault: "Looks perfect — prepare it",
    submitChanged: "Prepare it like this",
    actionNote: "You can change this until the day before you arrive.",
    saving: "Saving…",
    error: "Something went wrong. Please try again.",
    doneTitle: (n) => `It's all set, ${n}.`,
    doneSub: (place, d) => `We'll have ${place} ready exactly like this. See you ${d <= 1 ? "tomorrow" : `in ${d} days`}.`,
    sum: {
      fire: "Fireplace ready to light",
      drinks: (list) => `${list} in your fridge`,
      beds: { separate: "Separate beds requested — we'll confirm", extra: "Extra bed requested — we'll confirm" },
      adapter: { uk: "A UK plug adapter waiting", us: "A US plug adapter waiting", other: "A plug adapter waiting" },
      arrival: (a) => `Expecting you ${({ early: "before 3pm", afternoon: "between 3 and 6pm", evening: "between 6 and 9pm", late: "after 9pm" })[a]}`,
      food: "Your dietary notes are with the kitchen",
      occasion: (o) => ({ birthday: "Ready to celebrate your birthday", anniversary: "Ready to celebrate your anniversary", honeymoon: "Ready to celebrate your honeymoon", treat: "No reason needed — we'll spoil you anyway", other: "Ready to celebrate with you" }[o]),
      experiences: (list) => `We'll be in touch about: ${list}`,
    },
    goodToKnow: "Good to know",
    wifi: (n, p) => `Wi-Fi <b>${n}</b> · password <b>${p}</b>`,
    copy: "Copy",
    copied: "Copied",
    welcome: (m) => `We'll welcome you at <b>${m}</b>`,
    call: (p) => `Anything at all? Call us on <b>${p}</b>`,
    change: "Change something",
    closedTitle: "We're already preparing your stay",
    closedText: "It's close to your arrival, so our team is getting everything ready. If you need anything, just reply to our message or call +351 933 979 043.",
    notFoundTitle: "We couldn't find this link",
    notFoundText: "Please use the link in your message from Vale Palheiro, or reply to that message and we'll help.",
    selected: (n) => `${n} selected`,
    added: "Added",
  },
  pt: {
    hero: (n) => `${n}, vamos preparar o vale para si`,
    stayLine: (place, dates, n) => `${place} · ${dates} · ${n} ${n === 1 ? "hóspede" : "hóspedes"}`,
    countdown: (d) => (d <= 1 ? "Amanhã" : `Daqui a ${d} dias`),
    lead: "Deixámos tudo como a maioria dos hóspedes gosta. <b>Altere o que quiser</b> — ou toque apenas no botão.",
    leadTime: "Demora cerca de 30 segundos",
    fireplace: "Lareira",
    fireplaceSub: "Pronta a acender quando chegar",
    fridge: "À sua espera no frigorífico",
    fridgeHint: "Escolha quantas quiser. Confirmamos os preços consigo antes de colocar algo além de água.",
    drinkOpts: { still_water: "Água sem gás", sparkling_water: "Água com gás", wine: "Vinho da região", sparkling_wine: "Um espumante", beer: "Cerveja fresca", alcohol_free: "Bebidas sem álcool" },
    beds: "Como prefere dormir?",
    bedOpts: { as_booked: "Tal como reservado", separate: "Camas separadas, por favor", extra: "Mais uma cama para alguém" },
    bedsHint: "Vemos o que é possível no seu alojamento e confirmamos consigo.",
    adapter: "Precisa de um adaptador de tomada?",
    adapterHint: "Em Portugal as tomadas são europeias de dois pinos (230V).",
    adapterOpts: { none: "Não, obrigado", uk: "Britânico", us: "Americano", other: "Outro tipo" },
    arrival: "A que horas pensa chegar?",
    arrivalOpts: { early: "Antes das 15h", afternoon: "15h–18h", evening: "18h–21h", late: "Depois das 21h" },
    extrasTitle: "Torne-o ainda mais seu",
    extrasSub: "Tudo opcional — abra só o que lhe interessa.",
    foodTitle: "Alimentação e alergias",
    foodHint: "Para que o The Barn cozinhe a pensar em si",
    dietOpts: { vegetarian: "Vegetariano", vegan: "Vegano", pescatarian: "Pescetariano", gluten_free: "Sem glúten", lactose_free: "Sem lactose" },
    allergiesLabel: "Tem alguma alergia?",
    allergiesPh: "ex.: frutos secos, marisco…",
    consent: "Autorizo o Vale Palheiro a usar esta informação sobre alergias apenas para preparar as minhas refeições com segurança durante esta estadia. É apagada automaticamente após o check-out.",
    consentErr: "Marque a caixa para podermos guardar a informação sobre alergias — ou apague o campo.",
    occasionTitle: "Está a celebrar algo?",
    occasionHint: "Adoramos um motivo para tornar tudo especial",
    occasionOpts: { birthday: "Aniversário", anniversary: "Aniversário de casamento", honeymoon: "Lua de mel", treat: "É preciso motivo?", other: "Outra coisa" },
    occasionPh: "Conte-nos um pouco (opcional)",
    interestTitle: "Experiências",
    interestHint: "Toque no que lhe apetece — nós tratamos do resto",
    pickedForYou: "Escolhidas para si",
    seeAll: "Ver todas as experiências",
    expHint: "Ainda nada fica reservado. A nossa equipa entra em contacto para combinar horários e confirmar preços.",
    groups: { land: "Terra, trilhos e paisagem", sea: "Mar e costa", body: "Corpo e bem-estar", table: "À mesa", crafts: "Oficinas e saberes", services: "Serviços úteis" },
    exp: {
      trail: ["Trilho Vale Palheiro", "Caminhada guiada de 9 km até à Praia de Monte Clérigo, com piquenique"],
      picnic: ["Piquenique Vale Palheiro", "Produtos locais e sazonais, junto à ribeira ou na praia"],
      jeep: ["Tour de jipe", "Miradouros escondidos, serra e costa — também ao pôr do sol"],
      horse: ["Passeio a cavalo", "Pela paisagem, ao nascer ou ao pôr do sol"],
      balloon: ["Passeio de balão", "A serra, o vale e a costa vistos de cima"],
      bikes: ["Bicicletas", "Até à vila de Aljezur ou à praia"],
      surf: ["Aulas de surf", "Com instrutores experientes, também para iniciantes"],
      boat: ["Passeio de barco em Lagos", "Falésias, grutas e enseadas vistas do mar"],
      kayak: ["Kayak em Lagos", "Mais lento, mais silencioso, mais perto da água"],
      yoga: ["Yoga, Pilates ou Barre", "No Terracotta Lounge ou ao ar livre"],
      massage: ["Massagem na sua villa", "Também massagens a dois"],
      wine_tasting: ["Prova de vinhos", "Vinhos, castas e produtores da região"],
      barn: ["Mesa no The Barn", "O nosso restaurante, ao ritmo das estações"],
      private_dinner: ["Almoço ou jantar privado", "Para celebrações e momentos especiais"],
      cooking: ["Workshop de cozinha", "Ingredientes e receitas locais"],
      workshop: ["Workshop criativo", "Cerâmica, pintura ou perfumes"],
      transfer: ["Transfer do aeroporto", "Transporte privado de e para o aeroporto"],
      babysitting: ["Babysitting", "Um pouco de tempo para os adultos"],
    },
    from: (p) => (p === 0 ? "Grátis para hóspedes" : `Desde ${String(p).replace(".5", ",50")} €`),
    onRequest: "Sob consulta",
    noteTitle: "Uma nota para a equipa",
    noteHint: "Algo mais que devamos saber",
    notePh: "O que quiser…",
    remember: "Guardar as minhas preferências para próximas estadias",
    submitDefault: "Perfeito — preparem assim",
    submitChanged: "Preparem assim",
    actionNote: "Pode alterar até ao dia antes da sua chegada.",
    saving: "A guardar…",
    error: "Algo correu mal. Tente novamente.",
    doneTitle: (n) => `Está tudo pronto, ${n}.`,
    doneSub: (place, d) => `Vamos ter ${place} pronto exatamente assim. Até ${d <= 1 ? "amanhã" : `daqui a ${d} dias`}.`,
    sum: {
      fire: "Lareira pronta a acender",
      drinks: (list) => `${list} no frigorífico`,
      beds: { separate: "Camas separadas pedidas — vamos confirmar", extra: "Cama extra pedida — vamos confirmar" },
      adapter: { uk: "Um adaptador britânico à sua espera", us: "Um adaptador americano à sua espera", other: "Um adaptador de tomada à sua espera" },
      arrival: (a) => `Esperamos por si ${({ early: "antes das 15h", afternoon: "entre as 15h e as 18h", evening: "entre as 18h e as 21h", late: "depois das 21h" })[a]}`,
      food: "As suas notas alimentares estão com a cozinha",
      occasion: (o) => ({ birthday: "Prontos para celebrar o seu aniversário", anniversary: "Prontos para celebrar o vosso aniversário", honeymoon: "Prontos para celebrar a vossa lua de mel", treat: "Sem motivo nenhum — vamos mimá-lo na mesma", other: "Prontos para celebrar consigo" }[o]),
      experiences: (list) => `Vamos falar consigo sobre: ${list}`,
    },
    goodToKnow: "Bom saber",
    wifi: (n, p) => `Wi-Fi <b>${n}</b> · palavra-passe <b>${p}</b>`,
    copy: "Copiar",
    copied: "Copiado",
    welcome: (m) => `Recebemo-lo na <b>${m}</b>`,
    call: (p) => `Precisa de algo? Ligue-nos para o <b>${p}</b>`,
    change: "Alterar algo",
    closedTitle: "Já estamos a preparar a sua estadia",
    closedText: "Falta pouco para a sua chegada e a equipa já está a preparar tudo. Se precisar de algo, responda à nossa mensagem ou ligue para +351 933 979 043.",
    notFoundTitle: "Não encontrámos este link",
    notFoundText: "Use o link da mensagem do Vale Palheiro, ou responda a essa mensagem e ajudamos.",
    selected: (n) => `${n} selecionado(s)`,
    added: "Adicionado",
  },
  fr: {
    hero: (n) => `${n}, préparons la vallée pour vous`,
    stayLine: (place, dates, n) => `${place} · ${dates} · ${n} ${n === 1 ? "personne" : "personnes"}`,
    countdown: (d) => (d <= 1 ? "Demain" : `Dans ${d} jours`),
    lead: "Tout est réglé comme la plupart de nos hôtes l'aiment. <b>Changez ce que vous voulez</b> — ou touchez simplement le bouton.",
    leadTime: "Environ 30 secondes",
    fireplace: "Cheminée",
    fireplaceSub: "Prête à être allumée à votre arrivée",
    fridge: "Au frais pour vous",
    fridgeHint: "Choisissez-en autant que vous voulez. Nous confirmerons les prix avec vous avant d'ajouter autre chose que de l'eau.",
    drinkOpts: { still_water: "Eau plate", sparkling_water: "Eau pétillante", wine: "Vin de la région", sparkling_wine: "Des bulles", beer: "Bière fraîche", alcohol_free: "Boissons sans alcool" },
    beds: "Comment souhaitez-vous dormir ?",
    bedOpts: { as_booked: "Comme réservé", separate: "Lits séparés, s'il vous plaît", extra: "Un lit de plus pour quelqu'un" },
    bedsHint: "Nous vérifions ce qui est possible dans votre hébergement et vous confirmons.",
    adapter: "Besoin d'un adaptateur de prise ?",
    adapterHint: "Le Portugal utilise des prises européennes à deux broches (230V).",
    adapterOpts: { none: "Non, merci", uk: "Prise UK", us: "Prise US", other: "Autre type" },
    arrival: "Vers quelle heure pensez-vous arriver ?",
    arrivalOpts: { early: "Avant 15h", afternoon: "15h–18h", evening: "18h–21h", late: "Après 21h" },
    extrasTitle: "Rendez-le encore plus personnel",
    extrasSub: "Tout est facultatif — ouvrez seulement ce qui compte pour vous.",
    foodTitle: "Repas et allergies",
    foodHint: "Pour que The Barn cuisine rien que pour vous",
    dietOpts: { vegetarian: "Végétarien", vegan: "Végan", pescatarian: "Pescétarien", gluten_free: "Sans gluten", lactose_free: "Sans lactose" },
    allergiesLabel: "Des allergies ?",
    allergiesPh: "ex. fruits à coque, crustacés…",
    consent: "J'accepte que Vale Palheiro utilise ces informations sur mes allergies uniquement pour préparer mes repas en toute sécurité pendant ce séjour. Elles sont supprimées automatiquement après mon départ.",
    consentErr: "Cochez la case pour que nous gardions vos informations d'allergie — ou videz le champ.",
    occasionTitle: "Vous fêtez quelque chose ?",
    occasionHint: "Nous adorons une raison de rendre le séjour spécial",
    occasionOpts: { birthday: "Anniversaire", anniversary: "Anniversaire de mariage", honeymoon: "Lune de miel", treat: "Faut-il une raison ?", other: "Autre chose" },
    occasionPh: "Dites-nous en un peu plus (facultatif)",
    interestTitle: "Expériences",
    interestHint: "Touchez ce qui vous tente — on s'occupe du reste",
    pickedForYou: "Choisies pour vous",
    seeAll: "Voir toutes les expériences",
    expHint: "Rien n'est encore réservé. Notre équipe vous contactera pour fixer les horaires et confirmer les prix.",
    groups: { land: "Terre, sentiers et paysage", sea: "Mer et côte", body: "Corps et bien-être", table: "À table", crafts: "Ateliers et savoir-faire", services: "Services pratiques" },
    exp: {
      trail: ["Sentier Vale Palheiro", "Randonnée guidée de 9 km jusqu'à la plage de Monte Clérigo, avec pique-nique"],
      picnic: ["Pique-nique Vale Palheiro", "Produits locaux et de saison, près de la rivière ou à la plage"],
      jeep: ["Tour en jeep", "Points de vue cachés, montagnes et côte — aussi au coucher du soleil"],
      horse: ["Balade à cheval", "Dans le paysage, au lever ou au coucher du soleil"],
      balloon: ["Vol en montgolfière", "Les collines, la vallée et la côte vues d'en haut"],
      bikes: ["Vélos", "Jusqu'au village d'Aljezur ou à la plage"],
      surf: ["Cours de surf", "Avec des moniteurs expérimentés, débutants bienvenus"],
      boat: ["Sortie en bateau à Lagos", "Falaises, grottes et criques vues de la mer"],
      kayak: ["Kayak à Lagos", "Plus lent, plus calme, plus près de l'eau"],
      yoga: ["Yoga, Pilates ou Barre", "Au Terracotta Lounge ou en plein air"],
      massage: ["Massage dans votre villa", "Massages en duo aussi"],
      wine_tasting: ["Dégustation de vins", "Vins, cépages et producteurs de la région"],
      barn: ["Une table à The Barn", "Notre restaurant, au rythme des saisons"],
      private_dinner: ["Déjeuner ou dîner privé", "Pour les célébrations et moments spéciaux"],
      cooking: ["Atelier de cuisine", "Ingrédients et recettes locales"],
      workshop: ["Atelier créatif", "Céramique, peinture ou parfum"],
      transfer: ["Transfert aéroport", "Transport privé vers et depuis l'aéroport"],
      babysitting: ["Baby-sitting", "Un peu de temps pour les grands"],
    },
    from: (p) => (p === 0 ? "Gratuit pour les hôtes" : `Dès ${String(p).replace(".5", ",50")} €`),
    onRequest: "Sur demande",
    noteTitle: "Un mot pour l'équipe",
    noteHint: "Autre chose à nous dire",
    notePh: "Ce que vous voulez…",
    remember: "Garder mes préférences pour mes prochains séjours",
    submitDefault: "Parfait — préparez-le ainsi",
    submitChanged: "Préparez-le comme ça",
    actionNote: "Modifiable jusqu'à la veille de votre arrivée.",
    saving: "Enregistrement…",
    error: "Un problème est survenu. Veuillez réessayer.",
    doneTitle: (n) => `Tout est prêt, ${n}.`,
    doneSub: (place, d) => `${place} sera prêt exactement ainsi. À ${d <= 1 ? "demain" : `dans ${d} jours`}.`,
    sum: {
      fire: "Cheminée prête à être allumée",
      drinks: (list) => `${list} au frais`,
      beds: { separate: "Lits séparés demandés — nous confirmons", extra: "Lit supplémentaire demandé — nous confirmons" },
      adapter: { uk: "Un adaptateur UK vous attend", us: "Un adaptateur US vous attend", other: "Un adaptateur de prise vous attend" },
      arrival: (a) => `Nous vous attendons ${({ early: "avant 15h", afternoon: "entre 15h et 18h", evening: "entre 18h et 21h", late: "après 21h" })[a]}`,
      food: "Vos préférences alimentaires sont transmises à la cuisine",
      occasion: (o) => ({ birthday: "Prêts à fêter votre anniversaire", anniversary: "Prêts à fêter votre anniversaire de mariage", honeymoon: "Prêts à fêter votre lune de miel", treat: "Aucune raison — on vous gâte quand même", other: "Prêts à faire la fête avec vous" }[o]),
      experiences: (list) => `Nous vous contacterons pour : ${list}`,
    },
    goodToKnow: "Bon à savoir",
    wifi: (n, p) => `Wi-Fi <b>${n}</b> · mot de passe <b>${p}</b>`,
    copy: "Copier",
    copied: "Copié",
    welcome: (m) => `Nous vous accueillons à la <b>${m}</b>`,
    call: (p) => `Une question ? Appelez-nous au <b>${p}</b>`,
    change: "Modifier quelque chose",
    closedTitle: "Nous préparons déjà votre séjour",
    closedText: "Votre arrivée approche et l'équipe prépare tout. Pour toute demande, répondez à notre message ou appelez le +351 933 979 043.",
    notFoundTitle: "Ce lien est introuvable",
    notFoundText: "Utilisez le lien reçu de Vale Palheiro, ou répondez à ce message et nous vous aiderons.",
    selected: (n) => `${n} choisi(s)`,
    added: "Ajouté",
  },
};

let lang = "en";
let stay = null;
let prefs = null;
let initial = "";
const t = (k) => T[lang][k];

function daysUntil(iso) {
  return Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 86400000));
}
function dateRange(a, b) {
  const loc = { en: "en-GB", pt: "pt-PT", fr: "fr-FR" }[lang];
  const f = (d) => new Date(d).toLocaleDateString(loc, { weekday: "short", day: "numeric", month: "short" });
  return `${f(a)} – ${f(b)}`;
}
const OPT_MAP = { drinks: "drinkOpts", beds: "bedOpts", adapter: "adapterOpts", arrival: "arrivalOpts", dietary: "dietOpts", occasion: "occasionOpts" };
function optLabel(field, v) { return t(OPT_MAP[field])[v]; }
function listJoin(items) {
  const and = { en: " and ", pt: " e ", fr: " et " }[lang];
  return items.length <= 1 ? items[0] || "" : items.slice(0, -1).join(", ") + and + items[items.length - 1];
}
function priceLabel(e) {
  if (e.noPrice) return "";
  return e.price === null ? t("onRequest") : t("from")(e.price);
}

// ---------- rendering ----------

function renderStatic() {
  document.documentElement.lang = lang;
  document.querySelectorAll("#langs button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
  document.querySelectorAll("[data-icon]").forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
  document.querySelectorAll("[data-t]").forEach((el) => (el.textContent = t(el.dataset.t)));
  document.querySelectorAll("[data-t-ph]").forEach((el) => (el.placeholder = t(el.dataset.tPh)));
  document.querySelectorAll("[data-t-aria]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.tAria)));
  if (!stay) return;
  const d = daysUntil(stay.checkIn);
  $("#countdown").textContent = t("countdown")(d);
  $("#countdown").classList.remove("hidden");
  $("#heroTitle").textContent = t("hero")(stay.firstName);
  $("#stayLine").textContent = t("stayLine")(stay.accommodation, dateRange(stay.checkIn, stay.checkOut), stay.partySize);
  $("#leadText").innerHTML = t("lead");
  $("#leadTime").textContent = t("leadTime");
  $("#villaTitle").textContent = stay.accommodation;
  $("#actionNote").textContent = t("actionNote");
  renderInfo("#infoCard");
  renderInfo("#doneInfo");
}

/** Wi-Fi and practical details — shown on the form and after submitting. */
function renderInfo(sel) {
  const el = $(sel);
  el.innerHTML = `
    <h2 class="card-title">${esc(t("goodToKnow"))}</h2>
    <div class="info-row"><span class="icon">${icon("wifi")}</span><span>${t("wifi")(esc(stay.wifi.network), esc(stay.wifi.password))}</span>
      <button type="button" class="copy">${esc(t("copy"))}</button></div>
    <div class="info-row"><span class="icon">${icon("home")}</span><span>${t("welcome")(esc(stay.meetingPoint))}</span></div>
    <div class="info-row"><span class="icon">${icon("phone")}</span><span>${t("call")(esc(stay.phone))}</span></div>`;
  const btn = el.querySelector(".copy");
  btn.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(stay.wifi.password); btn.textContent = t("copied"); }
    catch { btn.textContent = stay.wifi.password; }
  });
}

function renderChips() {
  document.querySelectorAll(".chips[data-field]").forEach((wrap) => {
    const field = wrap.dataset.field;
    const multi = wrap.hasAttribute("data-multi");
    const toggle = wrap.hasAttribute("data-toggle"); // single choice that can be un-picked
    wrap.innerHTML = "";
    for (const v of wrap.dataset.options.split(",")) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = optLabel(field, v);
      b.setAttribute("aria-pressed", String(multi ? prefs[field].includes(v) : prefs[field] === v));
      b.addEventListener("click", () => {
        if (multi) {
          const set = new Set(prefs[field]);
          set.has(v) ? set.delete(v) : set.add(v);
          prefs[field] = [...set];
        } else if (toggle && prefs[field] === v) {
          prefs[field] = "none";
        } else {
          prefs[field] = v;
        }
        renderChips();
        renderExperiences();
        renderState();
      });
      wrap.appendChild(b);
    }
  });
}

function expButton(e) {
  const [name, desc] = t("exp")[e.id];
  const b = document.createElement("button");
  b.type = "button";
  b.className = "exp";
  b.setAttribute("aria-pressed", String(prefs.experiences.includes(e.id)));
  b.innerHTML = `<span class="tick" aria-hidden="true">✓</span>
    <span><span class="name">${esc(name)}</span><span class="desc">${esc(desc)}</span></span>
    <span class="price">${esc(priceLabel(e))}</span>`;
  b.addEventListener("click", () => {
    const set = new Set(prefs.experiences);
    set.has(e.id) ? set.delete(e.id) : set.add(e.id);
    prefs.experiences = [...set];
    renderExperiences();
    renderState();
  });
  return b;
}

function renderExperiences() {
  const picked = suggestions();
  const sug = $("#suggested");
  sug.innerHTML = "";
  for (const id of picked) sug.appendChild(expButton(EXPERIENCES.find((e) => e.id === id)));

  const all = $("#allExperiences");
  all.innerHTML = "";
  for (const g of Object.keys(t("groups"))) {
    const items = EXPERIENCES.filter((e) => e.group === g && !picked.includes(e.id));
    if (!items.length) continue;
    const h = document.createElement("div");
    h.className = "exp-group";
    h.textContent = t("groups")[g];
    all.appendChild(h);
    const list = document.createElement("div");
    list.className = "exp-list";
    items.forEach((e) => list.appendChild(expButton(e)));
    all.appendChild(list);
  }
}

function renderState() {
  $("#fireplace").setAttribute("aria-checked", String(prefs.fireplace));
  $("#bedsHint").classList.toggle("hidden", prefs.beds === "as_booked");

  const hasAllergy = $("#allergies").value.trim().length > 0;
  $("#consentBox").classList.toggle("hidden", !hasAllergy);
  if (!hasAllergy) $("#consentErr").classList.add("hidden");
  $("#occasionNoteWrap").classList.toggle("hidden", prefs.occasion === "none");

  badge("#foodBadge", prefs.dietary.length + (hasAllergy ? 1 : 0));
  badge("#occasionBadge", prefs.occasion !== "none" ? -1 : 0);
  badge("#interestBadge", prefs.experiences.length);
  badge("#noteBadge", $("#note").value.trim() ? -1 : 0);

  $("#submitBtn").textContent = snapshot() === initial ? t("submitDefault") : t("submitChanged");
}
function badge(sel, n) {
  const el = $(sel);
  el.classList.toggle("hidden", n === 0);
  el.textContent = n < 0 ? t("added") : t("selected")(n);
}

/** A comparable picture of the form, to tell "untouched" from "changed". */
function snapshot() {
  return JSON.stringify({ ...prefs, allergies: $("#allergies").value.trim(), note: $("#note").value.trim(), occasionNote: $("#occasionNote").value.trim(), remember: $("#remember").checked });
}

function renderDone() {
  const p = stay.preferences;
  const s = t("sum");
  const drinkNames = p.drinks.map((d, i) => (i ? t("drinkOpts")[d].toLowerCase() : t("drinkOpts")[d]));
  const expNames = p.experiences.map((id) => t("exp")[id][0]);
  const items = [
    p.fireplace && ["fire", s.fire],
    drinkNames.length && ["bottle", s.drinks(listJoin(drinkNames))],
    p.beds !== "as_booked" && ["bed", s.beds[p.beds]],
    p.adapter !== "none" && ["plug", s.adapter[p.adapter]],
    ["clock", s.arrival(p.arrival)],
    (p.dietary.length || p.allergies) && ["leaf", s.food],
    p.occasion !== "none" && ["spark", s.occasion(p.occasion)],
    expNames.length && ["path", s.experiences(listJoin(expNames))],
  ].filter(Boolean);
  $("#summary").innerHTML = items.map(([i, txt]) => `<li><span class="icon">${icon(i)}</span>${esc(txt)}</li>`).join("");
  $("#doneTitle").textContent = t("doneTitle")(stay.firstName);
  $("#doneSub").textContent = t("doneSub")(stay.accommodation, daysUntil(stay.checkIn));
  $("#editBtn").classList.toggle("hidden", !stay.open);
}

function show(view) {
  $("#form").classList.toggle("hidden", view !== "form");
  $("#done").classList.toggle("hidden", view !== "done");
  $("#message").classList.toggle("hidden", view !== "message");
  window.scrollTo(0, 0);
}

function render(view) {
  renderStatic();
  if (view === "form") { renderChips(); renderExperiences(); renderState(); }
  if (view === "done") renderDone();
  show(view);
}

function currentView() {
  if (!$("#done").classList.contains("hidden")) return "done";
  if (!$("#form").classList.contains("hidden")) return "form";
  return "message";
}

function message(kind) {
  $("#msgTitle").textContent = t(kind + "Title");
  $("#msgText").textContent = t(kind + "Text");
}

function startForm() {
  const p = stay.preferences;
  prefs = {
    arrival: p.arrival, fireplace: p.fireplace, drinks: [...p.drinks], beds: p.beds, adapter: p.adapter,
    dietary: [...p.dietary], occasion: p.occasion, experiences: [...p.experiences],
  };
  $("#allergies").value = p.allergies || "";
  $("#allergyConsent").checked = !!p.allergyConsent;
  $("#note").value = p.note || "";
  $("#occasionNote").value = p.occasionNote || "";
  $("#remember").checked = !!p.rememberForNextTime;
  initial = snapshot();
  render("form");
}

// ---------- events ----------

$("#fireplace").addEventListener("click", () => { prefs.fireplace = !prefs.fireplace; renderState(); });
["#allergies", "#note", "#occasionNote", "#remember"].forEach((s) => $(s).addEventListener("input", renderState));
$("#allergyConsent").addEventListener("change", () => {
  $("#consentBox").classList.remove("needs");
  $("#consentErr").classList.add("hidden");
});
document.querySelectorAll("#langs button").forEach((b) => b.addEventListener("click", () => {
  lang = b.dataset.lang;
  const view = currentView();
  render(view);
  if (view === "message") message(stay ? "closed" : "notFound");
}));
$("#editBtn").addEventListener("click", startForm);

$("#form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const allergies = $("#allergies").value.trim();
  const consent = $("#allergyConsent").checked;
  if (allergies && !consent) {
    $("#foodBox").open = true;
    $("#consentBox").classList.add("needs");
    $("#consentErr").classList.remove("hidden");
    $("#consentBox").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  const btn = $("#submitBtn");
  btn.disabled = true;
  btn.textContent = t("saving");
  $("#formErr").classList.add("hidden");
  try {
    const r = await fetch(`/api/stay/${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...prefs,
        allergies, allergyConsent: consent && !!allergies,
        note: $("#note").value, occasionNote: prefs.occasion === "none" ? "" : $("#occasionNote").value,
        rememberForNextTime: $("#remember").checked,
      }),
    });
    if (r.status === 409) { stay.open = false; message("closed"); render("message"); return; }
    if (!r.ok) throw new Error(String(r.status));
    stay = await r.json();
    render("done");
  } catch {
    $("#formErr").textContent = t("error");
    $("#formErr").classList.remove("hidden");
  } finally {
    btn.disabled = false;
    if (currentView() === "form") renderState();
  }
});

function esc(s) {
  return String(s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

// ---------- boot ----------
(async () => {
  renderStatic();
  try {
    const r = await fetch(`/api/stay/${encodeURIComponent(token)}`);
    if (!r.ok) throw new Error("not found");
    stay = await r.json();
  } catch {
    lang = (navigator.language || "en").slice(0, 2);
    if (!T[lang]) lang = "en";
    message("notFound");
    render("message");
    return;
  }
  lang = T[stay.language] ? stay.language : "en";
  if (stay.answered) render("done");
  else if (!stay.open) { message("closed"); render("message"); }
  else startForm();
})();
