# Terra — guest messaging concierge for Vale Palheiro

A prototype that automates **personalised guest emails across the whole stay**
for [Vale Palheiro — Earth Resort](https://www.valepalheiro.com): before
arrival, on arrival day, during the stay, after check-out, and invitations to
the resort's events. Every message is in the guest's language (**EN / PT / FR**)
and arrives at a good hour **in the guest's own time zone**.

Today the resort sends an automatic booking confirmation and then does the rest
by hand (front-office emails 1–2 weeks out, manual invites for Fado nights and
guest-chef dinners). Terra takes the repetitive part off the team, and keeps
the personal part — a handwritten note, a welcome-back gift — with people.

The prototype runs on fictional reservations and needs no access to the
resort's real systems.

---

## The guest journey

| # | Moment | Default timing | What it says |
|---|--------|----------------|--------------|
| 1 | **We're getting ready** | 3 days before arrival, 10:00 guest time | Your villa is being prepared, we can't wait; stay summary; events during the stay (with priority booking); asks for arrival time. Returning guests hear about a welcome-back gift. |
| 2 | **Arrival details** | 3 hours before arrival | Villa / unit, where we'll meet you (Casa da Ribeira), directions + map, reception hours, late-arrival number. Plus a short WhatsApp/SMS if the guest opted in. |
| 3 | **Welcome & settling in** | 2 hours after check-in | Wi-Fi, breakfast and dinner hours, reception, email and out-of-hours numbers, check-out time, what's on, additional services — and **our suggestions for your stay**, day by day, based on the weather and sea forecast (see below). |
| 4 | **Thank you + review** | 24 hours after check-out, guest time | Thank-you, one personal line, a review link. |
| 5 | **Event invites** | N days before each event, 10:00 guest time | To opted-in past guests only, with a welcome-back gift if they come to stay. |

All timings, quiet hours and anti-spam limits are editable in **Settings**.

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

- **Personal moments are held for approval.** A message mentioning a birthday
  or anniversary waits for someone to add a personal line and press *Approve*.
- **Team tasks**: Terra prompts, people deliver. Welcome-back gift for a
  returning guest, a handwritten note for a celebration, someone to meet a
  guest arriving after reception closes (20:00).
- Every message can be **edited** or **stopped** before it goes. Edited wording
  is never overwritten.

## Property info

Wi-Fi, phone numbers, directions (EN/PT/FR), meal hours, check-out time and the
review link are edited in the **Property info** tab and flow straight into
upcoming messages. Placeholder values are marked **sample** and counted on the
dashboard, so nothing made-up reaches a real guest unnoticed.

---

## Run it

Requires **Node.js 22+** (uses only the standard library — no `npm install`).

```bash
npm start
# → Terra running at http://localhost:3000
```

Open <http://localhost:3000> and log in:

| Username   | Password         |
| ---------- | ---------------- |
| `palheiro` | `costa-vicentina` |

(Override via `TERRA_USER` / `TERRA_PASS` env vars.)

### Demo script (≈3 minutes)

1. Log in → the journey strip and counters show what's scheduled, what needs
   approval, open team tasks and property details still to confirm.
2. Filter **Needs approval** → Sophie's anniversary email (French). Add a line,
   **Approve**.
3. Compare a **3 days before** email for a returning guest with a first-timer,
   and an **Arrival day** email in Portuguese.
4. **Team tasks** → the welcome-back gift and the late-arrival pickup.
5. **Events** → add an event; watch invites appear for past guests, and see
   who is held back by the anti-spam rules and why.
6. **Weather & activities** → the 7-day forecast and what the agent sees;
   switch off "Massage" and watch Miguel's rainy-day suggestion change. Filter
   **During the stay** to read the welcome emails with their day-by-day plan.
7. **Property info** → change the Wi-Fi password; every unsent message updates.
8. **Demo tools → In 3 days → Send anything due**, then open the **Delivery log**.

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
  brand.ts      Vale Palheiro voice + localised phrasing
  generator.ts  The five message templates in EN / PT / FR (+ LLM seam)
  channels.ts   Email / SMS / WhatsApp adapters behind one interface
  scheduler.ts  Who gets what, when; anti-spam; tasks; send-if-due
  server.ts     Zero-dependency HTTP server + JSON API
public/
  index.html    Staff dashboard
  app.js        Dashboard logic (vanilla JS)
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
4. **Property info** — confirm every field marked *sample*.
5. **Weather** — `WEATHER_SOURCE=open-meteo` + `OPEN_METEO_API_KEY`.
6. **Hosting** — `render.yaml` deploys to Render. State is in memory today; a
   pilot needs a small database so approvals, edits and sent history survive a
   restart.
7. **Consent** — honour opt-ins and unsubscribe replies (GDPR).

> All guest data in this prototype is fictional.
