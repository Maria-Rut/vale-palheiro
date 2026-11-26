# Architecture — from prototype to a live system

This note is for Vale Palheiro's management, Carmine (systems) and whoever
builds the pilot. It covers the four layers, what is real today and what is
simulated, the GuestCentric question, WhatsApp, and running everything locally
on a Mac Mini.

## The four layers

```
┌──────────────────────────────────────────────────────────────────────┐
│ FRONTEND                                                             │
│  Staff dashboard (public/index.html + app.js) — templates, outbox,    │
│  guests, team tasks, events, weather & turndown cards, settings      │
│  Guest page /stay/<token> (public/stay.html + stay.js) — EN/PT/FR    │
├──────────────────────────────────────────────────────────────────────┤
│ BACKEND  (Node 22, src/, no dependencies)                            │
│  server.ts      HTTP + JSON API, staff login                         │
│  scheduler.ts   who gets what, when, on which channel; tasks;        │
│                 anti-spam & consent rules; sends what's due          │
│  generator.ts   fills templates (optional AI model behind one seam)  │
│  recommender.ts weather + sea → one suggestion per day               │
│  preferences.ts guest answers → tasks, email lines, GDPR purge       │
├──────────────────────────────────────────────────────────────────────┤
│ DATABASE                                                             │
│  Today: in memory (resets on restart).                               │
│  Pilot: one small Postgres or SQLite database for templates, resort  │
│  settings, guest answers, approvals, outbox history, tasks, events.  │
├──────────────────────────────────────────────────────────────────────┤
│ INTEGRATIONS  (each behind one interface — swapping one changes      │
│                nothing else)                                         │
│  Bookings  → BookingSource   (sources.ts)  GuestCentric — PLANNED    │
│  Events    → EventSource     (sources.ts)  in-app calendar — WORKS   │
│  Email     → ChannelSender   (channels.ts) SIMULATED                 │
│  WhatsApp  → ChannelSender   (channels.ts) MANUAL; Business API      │
│                                            PLANNED                   │
│  Weather   → weather.ts      Open-Meteo (live, free) or simulated    │
│  AI writer → generator.ts    optional; templates always work         │
└──────────────────────────────────────────────────────────────────────┘
```

## What is real and what is simulated

| Part | Today | To go live |
|---|---|---|
| Bookings | Fictional demo bookings | GuestCentric connection (below) |
| Email sending | **Simulated**: recorded in the sent log, not delivered | An email provider (Postmark, SendGrid, Brevo or the resort's SMTP), a sending address such as `stay@valepalheiro.com`, and SPF/DKIM set on the domain |
| WhatsApp | **Not sent by the system.** Due WhatsApps wait in the Outbox under *To send by hand* with an *Open in WhatsApp* button (pre-filled chat) and *Mark as sent* | WhatsApp Business (Cloud) API — see below |
| Weather & sea | Simulated in the demo; live Open-Meteo with `WEATHER_SOURCE=open-meteo` | Nothing — Open-Meteo is free and needs no key for this use |
| Messages | Staff-edited templates (EN/PT/FR) | Optional AI model for extra variety; templates remain the fallback |
| Storage | In memory | A database (above) |
| Staff login | One shared login | The resort's own accounts |

## Bookings — GuestCentric (Carmine to clarify)

We do **not** assume API access. The system only needs something that
implements `BookingSource.listReservations()`; any of these works:

1. **API** — read reservations every 15 minutes.
2. **Webhook** — GuestCentric calls us when a booking is created or changed.
3. **Scheduled export** — a CSV / e-mail report we import (simplest, slower).

Questions for Carmine:
- Does Vale Palheiro's GuestCentric plan offer an API or webhooks? If so, how do
  we get credentials (API key / OAuth) and is there a test environment?
- If not, can a daily or hourly export be scheduled, and in what format?
- Which fields are available: guest name, **email**, **phone**, **language**,
  country, check-in / check-out, **expected arrival time**, villa / unit,
  adults / children, special requests, **marketing consent**, booking channel
  (website, Booking.com, Expedia…), cancellations?
- Are bookings changed by hand afterwards in another system (PMS)? If so, which
  one is the source of truth?

## WhatsApp Business API

The seam is in `src/channels.ts` (`WhatsAppBusinessSender`). It switches on
when `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_TOKEN` are set. What's needed:

- A **Meta Business** account for Vale Palheiro, verified.
- A phone number dedicated to the API (it can't stay in the normal WhatsApp app
  at the same time).
- **Message templates approved by Meta** for each message (WhatsApp only lets a
  business start a conversation with an approved template; free text is only
  allowed within 24 hours of the guest's last message).
- Guest consent for WhatsApp at booking (the system only sends WhatsApp to
  guests who agreed; the others get the email).
- Running cost: Meta charges per conversation (utility vs marketing rates).

Until then nothing pretends to be delivered: staff send due WhatsApps by hand.

## Consent

- **Transactional** messages (3 days before, arrival day, welcome, thank you)
  go to every guest with a booking — they're about the stay itself.
- **Promotional** messages (event invitations) only go to guests with
  `marketingConsent = true`. Everyone else appears under *Who won't be invited,
  and why* with the reason, e.g. *"Oliver Grant — Not subscribed to marketing
  communications"*.
- Allergy details need explicit consent on the guest page and are deleted
  automatically after check-out.

## Running locally on a Mac Mini (option)

The app has no dependencies beyond Node, so it runs on a Mac Mini at the resort:

- Install Node 22+, copy the code, `npm start`, keep it running with `launchd`
  (or `pm2`).
- **Guest links need to be reachable from the internet** (the personalise page
  and the brochure link). Options: a Cloudflare Tunnel or Tailscale Funnel to a
  domain such as `stay.valepalheiro.com` — no open router ports.
- **Local AI model**: an Apple-silicon Mac Mini (16–32 GB) can run an open
  model through Ollama or LM Studio for drafting messages, so guest data never
  leaves the building. It would plug in behind the same `Generator` seam as a
  hosted model; templates stay as the always-working fallback.
- Trade-offs vs cloud hosting: no monthly hosting fee and data stays on site,
  but the resort is responsible for power, internet, backups and updates.

## Information and credentials needed

From **Vale Palheiro**:
- Confirm every *sample* field in Resort settings: check-in time (14:00 or
  15:00), late-arrival fee (~€30), early check-in policy, Wi-Fi, out-of-hours
  number, breakfast and bar hours, directions, minibar contents and extras menu with
  prices, which villas have no minibar, TripAdvisor and Google review links,
  wellness menu.
- The sending email address and who can set DNS records on valepalheiro.com.
- Meta Business account / WhatsApp number for the API.
- Event calendar for the coming months.

From **Carmine**:
- The GuestCentric answers above, and test credentials or a sample export.
- Where the system should run (cloud vs Mac Mini) and who maintains it.
