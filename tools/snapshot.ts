/**
 * Generates a standalone, static HTML snapshot of the dashboard output.
 *
 * It builds the full message plan the same way the server does, simulates a
 * week passing so every message is sent, and writes a single self-contained
 * HTML file (no server, no JS, no network) that can be opened in any browser.
 *
 * This exists so the output can be reviewed without running the live app.
 */
import { reservations } from "../src/mockData.ts";
import { Scheduler, DEFAULT_CONFIG } from "../src/scheduler.ts";
import { getSentLog } from "../src/channels.ts";
import type { ScheduledMessage } from "../src/types.ts";

const scheduler = new Scheduler(reservations, { ...DEFAULT_CONFIG });
const demoWeather = ["sunny", "rainy", "sunny", "windy", "cloudy"] as const;
reservations.forEach((r, i) => scheduler.setWeather(r.id, demoWeather[i % demoWeather.length]));
await scheduler.plan();
// Fast-forward two weeks so every scheduled message is delivered.
await scheduler.runDue(new Date(Date.now() + 336 * 3600_000));

const byId = Object.fromEntries(reservations.map((r) => [r.id, r]));
const messages = scheduler.getMessages();
const log = getSentLog();

function esc(s: unknown): string {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function fmt(iso: string): string {
  return new Date(iso).toUTCString().replace("GMT", "UTC");
}

const KIND: Record<string, string> = {
  preferences: "Preferences",
  pre_stay: "Welcome",
  experiences: "Experiences",
  post_stay: "Thank-you",
};

function card(m: ScheduledMessage): string {
  const r = byId[m.reservationId];
  const g = r?.guest;
  return `
  <div class="card">
    <div class="head">
      <span class="who">${esc(g?.firstName)} ${esc(g?.lastName)}</span>
      <span class="meta">${esc(r?.accommodation)} · ${esc(r?.reference)}</span>
      <span class="pill ${m.kind === "pre_stay" ? "pre" : "post"}">${KIND[m.kind]}</span>
      <span class="pill ch">${m.channel}</span>
      <span class="pill lang">${m.language}</span>
      <span class="spacer"></span>
      <span class="pill st-${m.status}">${m.status}</span>
    </div>
    <div class="body">
      ${m.subject ? `<div class="subject">${esc(m.subject)}</div>` : ""}
      <div class="text">${esc(m.body)}</div>
      <div class="foot">Send time: ${fmt(m.sendAt)} · Copy by: ${m.generatedBy === "llm" ? "AI model" : "brand template"}</div>
    </div>
  </div>`;
}

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vale Palheiro · output snapshot</title>
<style>
  body{margin:0;font-family:"Jost",-apple-system,sans-serif;font-weight:300;background:#f3ece0;color:#27201a;line-height:1.6}
  header{background:#27201a;color:#f3ece0;padding:24px 28px}
  header .name{font-family:Georgia,serif;font-size:24px;letter-spacing:3px;text-transform:uppercase}
  header .sub{font-size:11px;color:#d9a978;letter-spacing:3px}
  .note{max-width:900px;margin:18px auto 0;padding:0 24px;color:#9a8b78;font-size:14px}
  main{max-width:900px;margin:0 auto;padding:16px 24px 60px}
  h2{font-family:Georgia,serif;font-weight:500;letter-spacing:.5px;margin:30px 0 12px;color:#9a4526}
  .card{background:#fbf6ec;border:1px solid #e2cdb4;border-radius:4px;margin-bottom:14px;overflow:hidden;box-shadow:0 6px 24px rgba(39,32,26,.07)}
  .head{display:flex;flex-wrap:wrap;gap:9px;align-items:center;padding:14px 16px;border-bottom:1px solid #e2cdb4}
  .who{font-family:Georgia,serif;font-size:19px}.meta{font-size:12px;color:#9a8b78}
  .spacer{flex:1}
  .pill{font-size:10.5px;letter-spacing:.6px;padding:3px 9px;border-radius:2px;text-transform:uppercase}
  .pre{background:#e7ecde;color:#5c6749}.post{background:#ece2d2;color:#5c5047}
  .prefs{background:#efe1cf;color:#8a5a2e}.exp{background:#e2ecef;color:#3a6775}
  .ch{background:#e1e9f0;color:#3a5a74}.lang{background:#eae2ef;color:#5a4a6a}
  .st-sent{background:#d8e6cf;color:#3f6b36}.st-scheduled{background:#ecdcc6;color:#9a4526}.st-needs_approval{background:#f0d9b8;color:#96631a}
  .body{padding:15px 16px}.subject{font-family:Georgia,serif;font-size:18px;color:#9a4526;margin-bottom:8px}
  .text{white-space:pre-wrap;font-size:14.5px}
  .foot{font-size:12px;color:#9a8b78;margin-top:10px}
  .log{background:#fbf6ec;border:1px solid #e2cdb4;border-radius:4px;padding:12px 14px;margin-bottom:8px;font-size:13px}
  .log .top{display:flex;gap:10px;align-items:center;margin-bottom:4px}
</style></head>
<body>
<header><div class="name">Vale Palheiro</div><div class="sub">EARTH RESORT · GUEST MESSAGING — OUTPUT SNAPSHOT</div></header>
<div class="note">A frozen snapshot of what the system produces for the ${reservations.length} demo reservations.
All messages shown as delivered because time was fast-forwarded one week. This file is static — it needs no server.</div>
<main>
  <h2>Scheduled &amp; delivered messages (${messages.length})</h2>
  ${messages.map(card).join("")}
  <h2>Delivery log (${log.length})</h2>
  ${log
    .map(
      (l) => `<div class="log"><div class="top">
      <span class="pill ch">${l.channel}</span>
      <b>${esc(l.guestName)}</b>
      <span class="meta">${esc(l.accommodation)} · ${esc(l.to)}</span></div>
      ${l.subject ? `<div><b>${esc(l.subject)}</b></div>` : ""}
      <div class="text" style="font-size:13px">${esc(l.body)}</div></div>`,
    )
    .join("")}
</main></body></html>`;

process.stdout.write(html);
