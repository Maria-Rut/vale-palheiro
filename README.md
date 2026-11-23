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
| 3 | **Settling in** | 2 hours after check-in | Wi-Fi, breakfast and dinner hours, reception + out-of-hours numbers, check-out time, what's on during the stay, spa / Rota Vicentina. |
| 4 | **Thank you + review** | 24 hours after check-out, guest time | Thank-you, one personal line, a review link. |
| 5 | **Event invites** | N days before each event, 10:00 guest time | To opted-in past guests only, with a welcome-back gift if they come to stay. |

All timings, quiet hours and anti-spam limits are editable in **Settings**.

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
- Wi-Fi and contact details come from **Property info**.
- EN / PT / FR. The page closes 24 hours before arrival; bookings made later
  than that get the usual personal call.

Their answers become a **prep sheet** (dashboard → *Guest preferences*),
**team tasks** (wine to stock, extra bed to check, experiences to arrange),
a line in the **arrival-day email** ("we've prepared everything the way you
asked…"), and a line in the **thank-you** if they asked us to remember them.
Sophie's answers are pre-filled in the demo.

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
6. **Property info** → change the Wi-Fi password; every unsent message updates.
7. **Demo tools → In 3 days → Send anything due**, then open the **Delivery log**.

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
  preferences.ts  "Prepare your stay" answers: defaults, validation, links, tasks, email lines
  brand.ts      Vale Palheiro voice + localised phrasing
  generator.ts  The five message templates in EN / PT / FR (+ LLM seam)
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
4. **Property info** — confirm every field marked *sample*.
5. **Hosting** — `render.yaml` deploys to Render. State is in memory today; a
   pilot needs a small database so approvals, edits and sent history survive a
   restart.
6. **Consent** — honour opt-ins and unsubscribe replies (GDPR).

> All guest data in this prototype is fictional.
