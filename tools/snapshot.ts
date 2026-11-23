/**
 * Generates a standalone, static HTML snapshot of the dashboard output.
 *
 * It builds the full message plan the same way the server does, simulates a
 * week passing so every message is sent, and writes a single self-contained
 * HTML file (no server, no JS, no network) that can be opened in any browser.
 *
 * This exists so the output can be reviewed without running the live app.
 */
import { Scheduler, DEFAULT_CONFIG } from "../src/scheduler.ts";
import { MockBookingSource, InMemoryEventSource } from "../src/sources.ts";
import { placeLabel } from "../src/generator.ts";
import { getSentLog } from "../src/channels.ts";
import type { ScheduledMessage } from "../src/types.ts";

const scheduler = new Scheduler(new MockBookingSource(), new InMemoryEventSource(), { ...DEFAULT_CONFIG });
await scheduler.plan();
// Fast-forward a week so every scheduled message is delivered.
await scheduler.runUntil(new Date(Date.now() + 168 * 3600_000));

const byId = Object.fromEntries(scheduler.getReservations().map((r) => [r.id, r]));
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
  pre_arrival: "3 days before", arrival_day: "Arrival day", in_stay: "During the stay",
  post_stay: "Thank you", event_invite: "Event invite",
};

function card(m: ScheduledMessage): string {
  const r = byId[m.reservationId];
  const g = r?.guest;
  return `
  <div class="card">
    <div class="head">
      <span class="who">${esc(g?.firstName)} ${esc(g?.lastName)}</span>
      <span class="meta">${esc(r ? placeLabel(r) : "")} · ${esc(r?.reference)}</span>
      <span class="pill ${m.kind === "post_stay" || m.kind === "event_invite" ? "post" : "pre"}">${KIND[m.kind]}</span>
      <span class="pill ch">${m.channel}</span>
      <span class="pill lang">${m.language}</span>
      <span class="spacer"></span>
      <span class="pill st-${m.status}">${m.status}</span>
    </div>
    <div class="body">
      ${m.subject ? `<div class="subject">${esc(m.subject)}</div>` : ""}
      <div class="text">${esc(m.body)}</div>
      <div class="foot">Send time: ${fmt(m.sendAt)} (guest-local ${esc(m.localSendTime)}, ${esc(m.timeZone)}) · Copy by: ${m.generatedBy === "llm" ? "AI model" : "brand template"}</div>
    </div>
  </div>`;
}

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Terra · output snapshot</title>
<style>
  body{margin:0;font-family:Georgia,serif;background:#f6f1e7;color:#2e241b;line-height:1.55}
  header{background:#2e241b;color:#e9dfcf;padding:22px 28px}
  header .name{font-size:22px;letter-spacing:3px;text-transform:uppercase}
  header .sub{font-size:12px;color:#b08963;letter-spacing:2px}
  .note{max-width:900px;margin:18px auto 0;padding:0 24px;color:#9a8c77;font-size:14px}
  main{max-width:900px;margin:0 auto;padding:16px 24px 60px}
  h2{font-weight:normal;letter-spacing:1px;margin:30px 0 12px}
  .card{background:#fffdf9;border:1px solid #ddd0bb;border-radius:10px;margin-bottom:14px;overflow:hidden;box-shadow:0 6px 24px rgba(46,36,27,.08)}
  .head{display:flex;flex-wrap:wrap;gap:9px;align-items:center;padding:13px 16px;border-bottom:1px solid #ddd0bb;background:linear-gradient(#fffdf9,#f6f1e7)}
  .who{font-size:16px}.meta{font-size:12px;color:#9a8c77;font-family:sans-serif}
  .spacer{flex:1}
  .pill{font-family:sans-serif;font-size:11px;letter-spacing:.5px;padding:3px 9px;border-radius:999px;text-transform:uppercase}
  .pre{background:#e3ead7;color:#5d6a4e}.post{background:#e9dfcf;color:#5a4632}
  .ch{background:#dce6ef;color:#3a5a74}.lang{background:#ece6f0;color:#5a4a6a}
  .st-sent{background:#d9e8d4;color:#3f6b36}.st-scheduled{background:#efe9dc;color:#5a4632}
  .body{padding:15px 16px}.subject{font-weight:bold;margin-bottom:8px}
  .text{white-space:pre-wrap;font-size:15px}
  .foot{font-size:12px;color:#9a8c77;margin-top:10px;font-family:sans-serif}
  .log{background:#fffdf9;border:1px solid #ddd0bb;border-radius:8px;padding:10px 14px;margin-bottom:8px;font-size:13px}
  .log .top{display:flex;gap:10px;align-items:center;margin-bottom:4px;font-family:sans-serif}
</style></head>
<body>
<header><div class="name">Vale Palheiro</div><div class="sub">TERRA · GUEST MESSAGING — OUTPUT SNAPSHOT</div></header>
<div class="note">A frozen snapshot of what the system produces for the ${scheduler.getReservations().length} demo reservations.
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
