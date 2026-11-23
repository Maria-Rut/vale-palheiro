# Terra — guest messaging concierge for Vale Palheiro

A prototype that automates **personalised pre-stay and post-stay messages** for
[Vale Palheiro — Earth Resort](https://www.valepalheiro.com), across **email,
SMS and WhatsApp**. Built for a hackathon pilot, with fictional reservations so
it runs entirely offline — no access to the resort's real inbox, Booking.com or
PMS required.

The goal: take the repetitive, manual job of writing "we can't wait to welcome
you" and "thank you for staying" messages off the team's plate, while keeping
every message warm, personal, and unmistakably Vale Palheiro — never spam.

---

## What it does

- **Three automated moments in the guest journey**
  - **Preferences invite** — "Let's prepare your stay", sent **7 days** before
    arrival (straight away for late bookings; skipped when arrival is under
    24h away, where front office calls instead).
  - **Pre-stay** — sent a configurable window before arrival (default **2 hours**).
  - **Post-stay** — sent a configurable window after departure (default **24 hours**).
- **Guest preferences page** (`/stay/<token>`) — a personal, no-login link.
  Everything is **pre-filled** (fireplace ready, still water in the fridge,
  beds as booked, a plug adapter guessed from the guest's phone country,
  arriving 3–6pm), so a happy guest just taps *Looks perfect*. They can add
  regional wine, bubbles or beer to the fridge (staff confirm prices), ask for
  separate or extra beds, and see Wi-Fi details. Optional extras stay folded
  away: food & allergies, a celebration, experiences from the resort's own
  Experiences Menu (with "picked for you" suggestions), a note. EN / PT / FR.
  - **Wi-Fi values in `src/brand.ts` are placeholders** — replace with the
    real network name and password.
  - Allergies are only kept with an **explicit consent box**, and are
    **deleted automatically after check-out**.
  - Their choices show up in the **welcome message** ("the fireplace laid and ready
    to light, sparkling water and something sparkling in the fridge…") plus
    the Wi-Fi details and, if they opt in, the thank-you
    message promises to remember them next time.
  - Staff see a **prep sheet** per guest in the *Guest preferences* tab.
- **Personalised copy**, not mail-merge. Each message is shaped by the guest's
  name, their villa, their reason for visiting (couple, family, hiking, a
  celebration…), and their language (**EN / PT / FR**). A hiking guest hears
  about the Rota Vicentina and an early breakfast; a family hears about the
  kitchen garden.
- **Multi-channel** — email, SMS and WhatsApp, each with channel-appropriate
  copy (a full, signed email vs. a short, friendly text).
- **Staff dashboard** — log in, see every scheduled message, **preview and edit
  the wording** before it sends, cancel anything, and watch a **delivery log**.
- **"Simulate time" button** — fast-forward the clock to show the scheduler
  firing the pre-stay message without waiting two hours. Ideal for a live demo.
- **On-brand by design** — calm, unhurried, grounded in the valley. The brand
  voice lives in one file (`src/brand.ts`) so the team can tune it.

---

## Run it

Requires **Node.js 18+** (uses only the standard library — no `npm install`).

```bash
npm start
# → Terra running at http://localhost:3000
```

Open <http://localhost:3000> and log in:

| Username   | Password         |
| ---------- | ---------------- |
| `palheiro` | `costa-vicentina` |

(Override via `TERRA_USER` / `TERRA_PASS` env vars.)

### Demo script (≈2 minutes)

1. Log in → you land on **Scheduled messages**. Some are already `sent` (an
   arrival that's imminent, a guest who just checked out), the rest `scheduled`.
2. Open any message to **read the personalised copy**. Compare a family
   pre-stay (EN email) with a hiking pre-stay (FR email) — note how the body
   changes, not just the name.
3. Click **Edit wording** on a scheduled message to show staff stay in control.
4. Set **Simulate time passing → +25 hours** and click **Run scheduler** — watch
   messages flip to `sent`.
5. Open the **Delivery log** tab to show what went out, on which channel, to whom.

---

## How it's built

```
src/
  types.ts      Domain model (Reservation, Guest, ScheduledMessage…)
  mockData.ts   Fictional reservations (dates are relative to "now")
  brand.ts      Vale Palheiro brand voice + localised phrasing (EN/PT/FR)
  generator.ts  Message generation: TemplateGenerator (offline) + LlmGenerator seam
  channels.ts   Email / SMS / WhatsApp adapters behind one interface
  scheduler.ts  The "when + which channel + send if due" logic
  server.ts     Zero-dependency HTTP server + JSON API
public/
  index.html    Staff dashboard (earthy Vale Palheiro styling)
  app.js        Dashboard logic (vanilla JS)
```

### Design choices that matter for the pilot

- **Pluggable integrations.** Email/SMS/WhatsApp sending and LLM generation are
  each behind a single interface. Today they're mock/offline adapters. Going
  live means swapping in SendGrid + Twilio + an LLM key — a config change, not a
  rewrite. See `createGenerator()` in `generator.ts` and `senderFor()` in
  `channels.ts`.
- **Reliable by default.** Copy is generated by on-brand templates that always
  work offline. When a live LLM is enabled it adds extra warmth and variety, and
  **falls back to the template on any error** — a model outage can never block a
  guest message.
- **Staff stay in control.** Nothing is a black box: every message is previewable
  and editable before it sends, and the activity log shows exactly what went out.

---

## From prototype to pilot

This is the demo. To present it to Vale Palheiro as a hosted pilot:

1. **Hosting** — a `render.yaml` is included for one-click deploy to
   [Render](https://render.com) (free tier). Connect the repo and it goes live
   at a public URL; set `TERRA_USER` / `TERRA_PASS` in the dashboard for real
   staff accounts. Any other Node host works too.
2. **Real sending** — add SendGrid (email) and Twilio (SMS + WhatsApp) keys.
   WhatsApp requires Meta-approved message templates for the pre-stay/post-stay
   moments.
3. **Live LLM** — set `OPENAI_API_KEY` to enable `LlmGenerator`; templates remain
   the fallback.
4. **Booking integration** — replace `mockData.ts` with a connector to the
   resort's PMS / Booking.com so reservations flow in automatically.
5. **Consent & preferences** — honour per-guest channel opt-ins (the model
   already carries `preferredChannels`) and add unsubscribe handling.

> All guest data in this prototype is fictional.
