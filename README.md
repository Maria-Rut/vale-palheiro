# Vale Palheiro — guest messaging

A prototype that automates **personalised guest emails across the whole stay**
for [Vale Palheiro — Earth Resort](https://www.valepalheiro.com): before
arrival, on arrival day, during the stay, after check-out, and invitations to
the resort's events. Every message is in the guest's language (**EN / PT / FR**)
and arrives at a good hour **in the guest's own time zone**.

Today the resort sends an automatic booking confirmation and then does the rest
by hand (front-office emails 1–2 weeks out, manual invites for Fado nights and
guest-chef dinners). The system takes the repetitive part off the team, and keeps
the personal part — a handwritten note, a welcome-back gift — with people.

The prototype runs on fictional reservations and needs no access to the
resort's real systems.

---

## The guest journey

| # | Moment | Default timing | What it says |
|---|--------|----------------|--------------|
| 1 | **We're getting ready** | 3 days before arrival, 10:00 guest time | Your villa is being prepared, we can't wait; stay summary; events during the stay (with priority booking); a **"Click here to personalise your stay" button** to the guest's own page (below). Returning guests hear about a welcome-back gift. |
| 2 | **Arrival details** | 3 hours before arrival | Villa / unit, where we'll meet you (Casa da Ribeira), directions + map, reception hours, late-arrival number. Plus a short WhatsApp/SMS if the guest opted in. |
| 3 | **Welcome & settling in** | 2 hours after check-in | A line about their journey from their home town, Wi-Fi, breakfast and dinner hours, reception, email and out-of-hours numbers, check-out time, what's on, additional services — and **our suggestions for your stay**, day by day, based on the weather and sea forecast (see below). |
| 4 | **Thank you + review** | 24 hours after check-out, guest time | Thank-you, one personal line, a **Leave a review** button. |
| 5 | **Event invites** | N days before each event, 10:00 guest time | To opted-in past guests only, with a welcome-back gift if they come to stay. |

All timings, quiet hours and anti-spam limits are editable in **Settings**.

## Email templates (the first tab)

The dashboard opens on **Email templates**: one step at a time, in journey
order, **in English first**.

- **Left: the template.** Plain wording you can edit, with fields in
  `{{double brackets}}` that the system fills in for each guest (`{{first_name}}`,
  `{{villa}}`, `{{wifi_password}}`…). Click a field to insert it. Green fields
  are written automatically and only appear when they apply: a returning guest, a
  birthday, events that week, the weather-based suggestions. A line like
  `[Click here to personalise your stay]({{personalise_link}})` becomes a
  button.
- **Right: how the guest sees it.** The real email for an example guest, a couple
  from Amsterdam. **Show 4 more example guests** adds a returning family from
  Bristol, an anniversary couple from Lyon, a business traveller from São Paulo
  and three friends from Zurich, one of them with a birthday. All five stay the
  same week, so the weather suggestions come from the same forecast, adapted
  to each party.
- **Show the Portuguese and French versions** opens the other two templates,
  each with its own preview.

Saving a template updates every upcoming email that hasn't been edited by
hand. The **Outbox** shows every real email in English too, with *Show what
the guest receives* for the Portuguese or French original.

## The recommendation agent (weather → experiences)

The welcome email carries a short, day-by-day plan:

> • Tomorrow, Tue 24 Nov — rain expected, 15°C and windy: a day to slow down: a massage in the privacy of your villa (price on request).
> • Wed 25 Nov — sunny, 19°C: a boat trip from Lagos to see the cliffs, caves and coves from the water (from €22.50).
> • Your last full day, Thu 26 Nov — sunny, 17°C and a big Atlantic swell (around 4 m): head to the cliffs at Monte Clérigo or Arrifana and watch the power of the sea… To end your stay, a sunset jeep tour… (from €55).

How it works:

1. **Forecast** (`src/weather.ts`) — daily sky, rain, wind, temperature for the
   estate, plus **wave height** off Monte Clérigo. Live source:
   [Open-Meteo](https://open-meteo.com) forecast + Marine APIs (official
   ECMWF / Météo-France / DWD models, no key needed to test). The demo uses a
   simulated, repeatable forecast.
2. **Conditions** (`src/recommender.ts`) — each day becomes plain tags: sunny,
   rain, windy, calm, big swell (≥ 3.5 m), surfable, flat sea, warm.
3. **Catalogue** (`src/activities.ts`) — every experience from the Experiences
   Menu (trail, picnic, jeep, horses, balloon, surf, boats and kayaks from
   Lagos, yoga / Pilates / barre, in-villa massage, wine tasting, cooking and
   creative workshops, private dinner) with the weather it suits, the weather
   that rules it out, and whether it makes a good last-day ending. Prices and
   wording come from the brochure. "Watching the Atlantic from the cliffs" is
   a team idea, triggered only by a big swell.
4. **Pick** — one experience per day, no repeats, a closing touch on the last
   day, adjusted for children, couples, business guests and celebrations.
   Rule-based on purpose: the same forecast always gives the same, explainable
   answer, and it can only suggest what the resort actually offers.

Staff see each pick and the reason on the message card, see the 7-day forecast
in **Weather & activities**, and can switch an experience off for the season.
The forecast refreshes hourly and unsent welcome emails are re-written with it,
so the plan is as fresh as possible when it goes out. If the forecast can't be
fetched, the email still suggests activities — just without weather wording.

To go live: set `WEATHER_SOURCE=open-meteo`. A hotel is commercial use, so get
an Open-Meteo API key and set `OPEN_METEO_API_KEY` (switches to their
commercial endpoints automatically).

## What makes it not spam

- **Event invites only go to guests who opted in** and have actually stayed.
- **At most one invite every 30 days**, at most 6 a year, and **never within 7
  days of a stay message**.
- Guests **staying during an event** hear about it in their stay messages
  instead of a separate invite.
- Every invite has a one-line **unsubscribe**.
- The **Events** tab shows exactly **who isn't being invited, and why**.
- A message whose moment has passed (e.g. a booking made the night before) is
  **skipped, not sent late** — no "three days to go" on arrival day.

## Time zones

Each guest has a time zone (from the booking, or guessed from their country).
Messages that reach guests at home (3-day, thank-you, invites) land at a good
hour **in their zone** (default 09:00–20:00; anything outside moves into that
window). Arrival-day and in-stay messages use the resort's clock (Lisbon),
because the guest is travelling to or staying with us. Each message card in
the dashboard shows the guest-local time it lands, and why it moved if it did.

## Human in the loop

- **Approval policy** (Settings): hold only personal emails (default), also the
  welcome email with suggestions, every email, or none. A message mentioning a
  birthday or anniversary waits for someone to add a personal line and press
  *Approve*.
- **Team tasks**: the system prompts, people deliver. Welcome-back gift for a
  returning guest, a handwritten note for a celebration, someone to meet a
  guest arriving after reception closes (20:00).
- Every message can be **edited** or **stopped** before it goes. Edited wording
  is never overwritten.

## Guest preferences ("prepare your stay")

The 3-days-before email links each guest to a **personal page** (`/stay/<token>`,
no login) where their stay is **already set up the way most guests like it** —
so a happy guest just taps *Looks perfect*, and nobody faces a questionnaire.

- **Pre-filled:** fireplace laid and ready to light, still water in the fridge,
  beds as booked, a plug adapter guessed from the guest's country (Portugal
  uses EU sockets), arrival time.
- **Easy to change:** regional wine, bubbles, beer or alcohol-free drinks in the
  fridge (staff confirm prices); separate beds or one more bed (staff confirm
  it's possible).
- **Optional, folded away:** food & allergies, a celebration (including
  *"Do we need a reason?"*), experiences from the resort's own Experiences
  Menu with three "picked for you" ideas, and a note for the team.
- **"Remember my preferences for future stays."**
- **Allergies need an explicit consent box** and are **deleted automatically
  after check-out**.
- Wi-Fi and contact details come from **Resort details**.
- EN / PT / FR. The page closes 24 hours before arrival; bookings made later
  than that get the usual personal call.

Their answers become a **prep sheet** (dashboard → *Guests*),
**team tasks** (wine to stock, extra bed to check, experiences to arrange),
**priority in the welcome email's suggestions** for experiences they ticked,
a line in the **arrival-day email** ("we've prepared everything the way you
asked…"), and a line in the **thank-you** if they asked us to remember them.
Sophie's answers are pre-filled in the demo.

## Resort details

Wi-Fi, phone numbers, directions (EN/PT/FR), meal hours, check-out time and the
review link are edited in the **Resort details** tab and flow straight into
upcoming messages. Placeholder values are marked **sample** and counted on the
dashboard, so nothing made-up reaches a real guest unnoticed.

---

## Run it

Requires **Node.js 22+** (uses only the standard library — no `npm install`).

```bash
npm start
# → Vale Palheiro guest messaging running at http://localhost:3000
```

Open <http://localhost:3000> and log in:

| Username   | Password         |
| ---------- | ---------------- |
| `palheiro` | `costa-vicentina` |

(Override via `TERRA_USER` / `TERRA_PASS` env vars.)

### Demo script (≈3 minutes)

1. Log in → **Email templates**, step 1 (3 days before): the English template
   beside Emma's email with its *personalise your stay* button. Change a
   sentence, **Save**, and watch the preview change.
2. Step 4, **Welcome** → **Show 4 more example guests**: same week, same
   weather, different people. Then **Show the Portuguese and French versions**.
3. **Outbox** → Sophie's anniversary email (French, shown in English). Open
   *Show what the guest receives*, add a line, **Approve**.
4. **Team tasks** → the welcome-back gift and the late-arrival pickup.
5. **Events** → add an event; watch invites appear for past guests, and see
   who is held back by the anti-spam rules and why.
6. **Weather & activities** → the 7-day forecast and what the agent sees;
   switch off "Massage" and watch the welcome emails' suggestions change.
7. **Resort details** → change the Wi-Fi password; every unsent message updates.
8. **Outbox → Demo tools → In 3 days → Send anything due**.

`public/snapshot.html` is a static export of the output (regenerate with
`node --experimental-strip-types tools/snapshot.ts > public/snapshot.html`).

---

## How it's built

```
src/
  types.ts      Domain model (Guest, Reservation, ResortEvent, ScheduledMessage, StaffTask)
  sources.ts    Connector seams: BookingSource (Host PMS) + EventSource (calendar)
  mockData.ts   Fictional guests, stays and events (dates relative to "now")
  property.ts   Wi-Fi, phones, directions… edited by staff, flagged until confirmed
  timezone.ts   Guest-local timing and quiet hours (Intl, no dependencies)
  weather.ts    Forecast + sea state: simulated, or live Open-Meteo
  activities.ts Experiences catalogue with weather rules (from the brochure)
  recommender.ts The agent: forecast → conditions → one experience per day
  preferences.ts  "Prepare your stay" answers: defaults, validation, links, tasks, email lines
  brand.ts      Vale Palheiro voice + localised phrasing
  templates.ts  The editable email templates (EN / PT / FR), fields, buttons, HTML email
  examples.ts   Five made-up guests for the template previews
  generator.ts  Fills the templates for each guest (+ LLM seam)
  channels.ts   Email / SMS / WhatsApp adapters behind one interface
  scheduler.ts  Who gets what, when; anti-spam; tasks; send-if-due
  server.ts     Zero-dependency HTTP server + JSON API
public/
  index.html    Staff dashboard
  app.js        Dashboard logic (vanilla JS)
  stay.html     Guest "prepare your stay" page (mobile-first)
  stay.js       Its logic + EN / PT / FR copy and the Experiences Menu
```

## From prototype to pilot

1. **Booking data** — implement `BookingSource` against **Host**, the PMS the
   team already treats as the single source of truth (direct bookings are
   entered there; Booking.com / Expedia / website bookings arrive via
   GuestCentric). Needed fields: guest name, email, language, country / time
   zone, dates and expected arrival time, villa + unit, adults / children,
   occasion, and the guest's opt-in for news.
2. **Events calendar** — implement `EventSource` against the calendar the team
   uses (e.g. Google Calendar), including buy-outs so no invites go out for
   closed dates.
3. **Sending** — swap the mock adapters for an email provider (and Twilio for
   SMS / WhatsApp; WhatsApp needs Meta-approved templates).
4. **Resort details** — confirm every field marked *sample*.
5. **Weather** — `WEATHER_SOURCE=open-meteo` + `OPEN_METEO_API_KEY`.
6. **Hosting** — `render.yaml` deploys to Render. State is in memory today; a
   pilot needs a small database so approvals, edits and sent history survive a
   restart.
7. **Consent** — honour opt-ins and unsubscribe replies (GDPR).

The approval policy and perfume workshop come from Maria's `terra-crm-weather`
branch; the "prepare your stay" page from Arantxa's work.

> All guest data in this prototype is fictional.
