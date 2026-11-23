/* Terra dashboard — vanilla JS, no build step. Talks to the JSON API. */

const $ = (sel) => document.querySelector(sel);
const api = {
  async get(path) {
    const r = await fetch(path);
    if (r.status === 401) { showLogin(); throw new Error("unauth"); }
    return r.json();
  },
  async post(path, body) {
    const r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    if (r.status === 401) { showLogin(); throw new Error("unauth"); }
    return r.json();
  },
};

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2800);
}

function showLogin() { $("#login").classList.remove("hidden"); $("#app").classList.add("hidden"); }
function showApp() { $("#login").classList.add("hidden"); $("#app").classList.remove("hidden"); refreshAll(); }

// --- auth ---
$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const res = await api.post("/api/login", {
    username: $("#username").value,
    password: $("#password").value,
  });
  if (res.ok) { $("#loginErr").textContent = ""; showApp(); }
  else $("#loginErr").textContent = res.error || "Login failed";
});
$("#logoutBtn").addEventListener("click", async () => { await api.post("/api/logout"); showLogin(); });

// --- tabs ---
const TABS = ["messages", "tasks", "events", "weather", "property", "settings", "log"];
const RENDER = {
  messages: renderMessages, tasks: renderTasks, events: renderEvents, weather: renderWeather,
  property: renderProperty, settings: loadConfig, log: renderLog,
};
document.querySelectorAll(".tabbtn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tabbtn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    for (const t of TABS) $(`#tab-${t}`).classList.toggle("hidden", t !== tab);
    RENDER[tab]();
  });
});

// --- labels ---
const KIND_LABEL = {
  pre_arrival: "3 days before",
  arrival_day: "Arrival day",
  in_stay: "During the stay",
  post_stay: "Thank you",
  event_invite: "Event invite",
};
const CHANNEL_LABEL = { email: "Email", sms: "SMS", whatsapp: "WhatsApp" };
const LANG_LABEL = { en: "EN", pt: "PT", fr: "FR" };
const STATUS_LABEL = {
  scheduled: "scheduled", held: "needs approval", sent: "sent", cancelled: "not sending", skipped: "skipped",
};

function fmt(iso) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}
function fmtDate(iso) {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short" });
}
/** Event times are shown on the resort's clock, wherever the staff member is. */
const RESORT_TZ = "Europe/Lisbon";
function resortDate(iso) {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", timeZone: RESORT_TZ });
}
function resortTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", timeZone: RESORT_TZ });
}
function relative(iso) {
  const diff = Date.parse(iso) - Date.now();
  const h = Math.round(diff / 3600000);
  if (Math.abs(h) < 1) return "within the hour";
  if (h > 0 && h < 48) return `in ${h}h`;
  if (h < 0 && h > -48) return `${-h}h ago`;
  const d = Math.round(h / 24);
  return d > 0 ? `in ${d} days` : `${-d} days ago`;
}
function esc(s) {
  return String(s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function escAttr(s) { return esc(s).replaceAll('"', "&quot;"); }

// --- overview ---
async function renderOverview() {
  const [o, cfg] = await Promise.all([api.get("/api/overview"), api.get("/api/config")]);
  const stages = [
    ["1", "We're getting ready", `${cfg.preArrivalDaysBefore} days before arrival`, ""],
    ["2", "Arrival details", `${cfg.arrivalHoursBefore}h before arrival`, ""],
    ["3", "Settling in", `${cfg.inStayHoursAfterCheckIn}h after check-in`, ""],
    ["4", "Thank you + review", `${cfg.postStayHoursAfterCheckOut}h after check-out`, "post"],
    ["5", "Event invites", "opted-in past guests", "evt"],
  ];
  $("#journey").innerHTML = stages.map(([n, t, w, c]) =>
    `<div class="stage ${c}"><div class="dot">${n}</div><div class="t">${t}</div><div class="w">${w}</div></div>`).join("");
  const stat = (n, l, warn) => `<div class="stat ${warn ? "warn" : ""}"><div class="n">${n}</div><div class="l">${l}</div></div>`;
  $("#stats").innerHTML =
    stat(o.scheduled, "scheduled") +
    stat(o.held, "need your approval", o.held > 0) +
    stat(o.sent, "sent") +
    stat(o.tasksOpen, "team tasks open", o.tasksOpen > 0) +
    stat(o.sampleFields, "property details to confirm", o.sampleFields > 0);
  $("#taskCount").textContent = o.tasksOpen ? `(${o.tasksOpen})` : "";
}

// --- messages ---
let filter = "all";
const FILTERS = [
  ["all", "All"], ["held", "Needs approval"], ["pre_arrival", "3 days before"], ["arrival_day", "Arrival day"],
  ["in_stay", "During the stay"], ["post_stay", "Thank you"], ["event_invite", "Event invites"], ["sent", "Sent"],
];
function renderFilters() {
  $("#filters").innerHTML = FILTERS.map(([k, l]) =>
    `<button class="chip ${filter === k ? "on" : ""}" data-f="${k}">${l}</button>`).join("");
  $("#filters").querySelectorAll("[data-f]").forEach((b) =>
    b.addEventListener("click", () => { filter = b.dataset.f; renderMessages(); }));
}

async function renderMessages() {
  renderFilters();
  const all = await api.get("/api/messages");
  $("#msgCount").textContent = `(${all.length})`;
  const msgs = all.filter((m) =>
    filter === "all" ? true : filter === "held" || filter === "sent" ? m.status === filter : m.kind === filter);
  const el = $("#messages");
  el.innerHTML = "";
  if (!msgs.length) { el.innerHTML = `<p class="empty">Nothing here.</p>`; return; }

  for (const m of msgs) {
    const g = m.guest ?? {};
    const card = document.createElement("div");
    card.className = "msg-card";
    const editable = m.status === "scheduled" || m.status === "held";
    const when = m.status === "sent"
      ? `Sent ${fmt(m.sentAt)}`
      : `${m.status === "skipped" || m.status === "cancelled" ? "Was due" : "Sends"} ${relative(m.sendAt)} · lands ${esc(m.localSendTime)} ${esc(m.timeZone)}`;
    const stay = m.kind === "event_invite"
      ? `About: ${esc(m.eventTitle)}`
      : `${esc(m.place)} · ${fmtDate(m.checkIn)} → ${fmtDate(m.checkOut)} · ${esc(m.reference)}`;

    card.innerHTML = `
      <div class="msg-head">
        <span class="who">${esc(g.firstName)} ${esc(g.lastName)}</span>
        <span class="book">${stay}</span>
        <span class="spacer"></span>
        <span class="pill ${m.kind}">${KIND_LABEL[m.kind]}</span>
        <span class="pill ${m.channel}">${CHANNEL_LABEL[m.channel]}</span>
        <span class="pill lang">${LANG_LABEL[m.language]}</span>
        <span class="pill ${m.status}">${STATUS_LABEL[m.status]}</span>
      </div>
      ${m.status === "held" && m.statusNote ? `<div class="note">${esc(m.statusNote)}</div>` : ""}
      ${m.status === "skipped" && m.statusNote ? `<div class="note info">${esc(m.statusNote)}</div>` : ""}
      ${m.suggestions?.length ? `<div class="picks"><b>Recommendation agent</b>${m.suggestions.map((x) => `<div>${esc(resortDate(x.date + "T12:00:00Z"))}: ${esc(x.reason)}</div>`).join("")}</div>` : ""}
      <div class="msg-body">
        ${m.subject ? `<div class="msg-subject">${esc(m.subject)}</div>` : ""}
        <div class="msg-text">${esc(m.body)}</div>
      </div>
      <div class="msg-meta">
        <span>${when}</span>
        ${m.timingNote ? `<span>${esc(m.timingNote)}</span>` : ""}
        <span>${m.edited ? "Edited by the team" : "Written from the Vale Palheiro template"}</span>
      </div>
      ${editable ? `
      <div class="msg-actions">
        ${m.status === "held" ? `<button class="primary" data-approve="${m.id}">Approve</button>` : ""}
        <button class="ghost" data-edit="${m.id}">Edit wording</button>
        <button class="ghost" data-cancel="${m.id}">Don't send</button>
      </div>` : ""}
    `;
    el.appendChild(card);
  }

  el.querySelectorAll("[data-edit]").forEach((b) =>
    b.addEventListener("click", () => openEditor(b, msgs.find((x) => x.id === b.dataset.edit))));
  el.querySelectorAll("[data-cancel]").forEach((b) =>
    b.addEventListener("click", async () => {
      await api.post(`/api/messages/${b.dataset.cancel}/cancel`);
      toast("Message won't be sent");
      refreshMessages();
    }));
  el.querySelectorAll("[data-approve]").forEach((b) =>
    b.addEventListener("click", async () => {
      await api.post(`/api/messages/${b.dataset.approve}/approve`);
      toast("Approved — it will go out on time");
      refreshMessages();
    }));
}

function openEditor(btn, m) {
  if (!m) return;
  const card = btn.closest(".msg-card");
  const body = card.querySelector(".msg-body");
  const actions = card.querySelector(".msg-actions");
  if (actions) actions.style.display = "none";
  body.innerHTML = `
    <div class="edit-area">
      ${m.subject ? `<input class="editSubject" value="${escAttr(m.subject)}" placeholder="Subject" />` : ""}
      <textarea class="editBody">${esc(m.body)}</textarea>
      <div style="display:flex;gap:10px">
        <button class="primary saveEdit">Save</button>
        <button class="ghost cancelEdit">Discard</button>
      </div>
    </div>
  `;
  body.querySelector(".saveEdit").addEventListener("click", async () => {
    const patch = { body: body.querySelector(".editBody").value };
    const subEl = body.querySelector(".editSubject");
    if (subEl) patch.subject = subEl.value;
    await api.post(`/api/messages/${m.id}/edit`, patch);
    toast("Wording saved");
    renderMessages();
  });
  body.querySelector(".cancelEdit").addEventListener("click", renderMessages);
}

function refreshMessages() { renderMessages(); renderOverview(); }

// --- demo: simulate ---
$("#simBtn").addEventListener("click", async () => {
  const hrs = Number($("#simSelect").value);
  const res = await api.post("/api/simulate", { atHoursFromNow: hrs });
  toast(res.sentCount > 0 ? `${res.sentCount} message(s) sent` : "Nothing due to send yet");
  refreshMessages();
  renderLog();
});

// --- tasks ---
async function renderTasks() {
  const tasks = await api.get("/api/tasks");
  const el = $("#tasks");
  if (!tasks.length) { el.innerHTML = `<p class="empty">No tasks for upcoming arrivals.</p>`; return; }
  el.innerHTML = tasks.map((t) => `
    <label class="task ${t.done ? "done" : ""}">
      <input type="checkbox" data-task="${escAttr(t.id)}" ${t.done ? "checked" : ""} />
      <div><div class="txt">${esc(t.text)}</div><div class="due">Before arrival · ${fmt(t.dueBy)}</div></div>
    </label>`).join("");
  el.querySelectorAll("[data-task]").forEach((c) =>
    c.addEventListener("change", async () => {
      await api.post(`/api/tasks/${encodeURIComponent(c.dataset.task)}/toggle`);
      renderTasks(); renderOverview();
    }));
}

// --- events ---
async function renderEvents() {
  const { events, suppressions } = await api.get("/api/events");
  $("#events").innerHTML = events.length ? events.map((e) => `
    <div class="ev">
      <div class="date">${resortDate(e.start)}<div class="muted" style="font-size:12px;font-family:var(--sans)">${resortTime(e.start)} resort time</div></div>
      <div class="info"><b>${esc(e.title.en)}</b> · ${esc(e.place)}
        <div>${e.audience === "everyone"
          ? `Guests staying + opted-in past guests (invited ${e.inviteLeadDays} days before)`
          : "Only guests staying at the time"}</div></div>
      <button class="ghost" data-del="${e.id}">Remove</button>
    </div>`).join("") : `<p class="empty">No upcoming events.</p>`;
  $("#events").querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", async () => {
      await api.post(`/api/events/${b.dataset.del}/delete`);
      toast("Event removed — its invites were withdrawn");
      renderEvents(); renderOverview();
    }));
  $("#suppressions").innerHTML = suppressions.length
    ? suppressions.map((s) => `<div class="supp"><b>${esc(s.guestName)}</b><span>${esc(s.eventTitle)}</span><span class="why">— ${esc(s.reason)}</span></div>`).join("")
    : `<p class="empty">Everyone eligible is being invited.</p>`;
}

$("#eventForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const body = Object.fromEntries(f.entries());
  body.inviteLeadDays = Number(body.inviteLeadDays);
  const res = await api.post("/api/events", body);
  if (!res.ok) { toast(res.error || "Couldn't add event"); return; }
  e.target.reset();
  toast("Event added — invites planned");
  renderEvents(); renderOverview();
});

// --- weather & activities ---
const COND_LABEL = {
  sunny: "sunny", cloudy: "cloudy", showers: "showers", rainy: "rain", windy: "windy", calm: "calm",
  big_sea: "big swell", surf_sea: "surfable", flat_sea: "flat sea", warm: "warm",
};
async function renderWeather() {
  const [wx, acts] = await Promise.all([api.get("/api/weather"), api.get("/api/activities")]);
  const live = wx.source === "open-meteo";
  $("#wxSource").innerHTML = `<div class="src-banner">${live
    ? `<b>Live forecast</b> from Open-Meteo (land + marine)`
    : `<b>Simulated forecast</b> for the demo. Set <code>WEATHER_SOURCE=open-meteo</code> to use the live Open-Meteo forecast and sea state.`}
    ${wx.fetchedAt ? ` · updated ${fmt(wx.fetchedAt)}` : ""}${wx.error ? ` · <span style="color:#9b3b2f">last refresh failed: ${esc(wx.error)}</span>` : ""}</div>`;
  $("#forecast").innerHTML = wx.days.length ? wx.days.map((d) => `
    <div class="wx">
      <div class="d">${esc(resortDate(d.date + "T12:00:00Z"))}</div>
      <div class="t">${Math.round(d.tempMax)}° <span class="muted" style="font-size:13px">${Math.round(d.tempMin)}°</span></div>
      <div>Rain ${Math.round(d.rainChance)}% · gusts ${Math.round(d.gustMaxKmh)} km/h</div>
      <div>Waves ${d.waveHeightM.toFixed(1)} m</div>
      <div class="chips">${d.conditions.map((c) => `<span class="cond ${c}">${COND_LABEL[c] ?? c}</span>`).join("")}</div>
    </div>`).join("") : `<p class="empty">No forecast available — welcome emails will suggest activities without weather wording.</p>`;
  const price = (a) => a.price.free ? "free" : a.price.onRequest ? "price on request" : `from €${a.price.from}`;
  $("#activities").innerHTML = acts.map((a) => `
    <div class="act ${a.enabled ? "" : "off"}">
      <div class="info"><b>${esc(a.name.en)}</b> · ${price(a)}${a.source === "team idea" ? ` · <i>team idea</i>` : ""}
        <div>Best in: ${a.goodIn.map((c) => COND_LABEL[c] ?? c).join(", ") || "any weather"}${a.notIn.length ? ` · not in: ${a.notIn.map((c) => COND_LABEL[c] ?? c).join(", ")}` : ""}${a.needs?.length ? ` · needs: ${a.needs.map((c) => COND_LABEL[c] ?? c).join(", ")}` : ""}${a.finale ? " · good last-day ending" : ""}</div>
      </div>
      <button class="ghost" data-act="${a.id}">${a.enabled ? "Switch off" : "Switch on"}</button>
    </div>`).join("");
  $("#activities").querySelectorAll("[data-act]").forEach((b) =>
    b.addEventListener("click", async () => {
      await api.post(`/api/activities/${b.dataset.act}/toggle`);
      toast("Suggestions in upcoming welcome emails updated");
      renderWeather();
    }));
}

// --- property ---
async function renderProperty() {
  const info = await api.get("/api/property");
  const long = new Set(["directions", "directionsPt", "directionsFr"]);
  $("#propFields").innerHTML = Object.entries(info).map(([k, f]) => `
    <div class="${long.has(k) ? "full" : ""}">
      <div class="field-lbl">${esc(f.label)} ${f.sample ? `<span class="badge">sample</span>` : ""}</div>
      ${long.has(k)
        ? `<textarea name="${k}" rows="2" class="${f.sample ? "sample" : ""}">${esc(f.value)}</textarea>`
        : `<input name="${k}" value="${escAttr(f.value)}" class="${f.sample ? "sample" : ""}" />`}
      ${f.help ? `<div class="field-help">${esc(f.help)}</div>` : ""}
    </div>`).join("");
}

$("#propForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const info = await api.get("/api/property");
  const f = Object.fromEntries(new FormData(e.target).entries());
  // Only send fields the user changed, or sample fields they've now confirmed by saving.
  const patch = {};
  for (const [k, v] of Object.entries(f)) if (v !== info[k].value || info[k].sample) patch[k] = v;
  await api.post("/api/property", patch);
  toast("Details saved — upcoming messages updated");
  renderProperty(); renderOverview();
});

// --- settings ---
const NUM_KEYS = [
  "preArrivalDaysBefore", "arrivalHoursBefore", "inStayHoursAfterCheckIn", "postStayHoursAfterCheckOut",
  "sendWindowStart", "sendWindowEnd", "inviteMinDaysBetween", "inviteQuietDaysAroundStay", "inviteMaxPerYear",
];
const BOOL_KEYS = ["arrivalTextReminder", "holdPersonalMoments"];

async function loadConfig() {
  const cfg = await api.get("/api/config");
  for (const k of NUM_KEYS) $(`#c_${k}`).value = cfg[k];
  for (const k of BOOL_KEYS) $(`#c_${k}`).checked = !!cfg[k];
}

$("#applyConfig").addEventListener("click", async () => {
  const body = {};
  for (const k of NUM_KEYS) body[k] = Number($(`#c_${k}`).value);
  for (const k of BOOL_KEYS) body[k] = $(`#c_${k}`).checked;
  await api.post("/api/config", body);
  toast("Settings saved — schedule updated");
  renderOverview();
});

// --- delivery log ---
async function renderLog() {
  const log = await api.get("/api/sent-log");
  $("#logCount").textContent = `(${log.length})`;
  const el = $("#log");
  if (!log.length) {
    el.innerHTML = `<p class="empty">Nothing sent yet. Use the demo tools to send what's due.</p>`;
    return;
  }
  el.innerHTML = "";
  for (const item of log) {
    const d = document.createElement("div");
    d.className = "log-item";
    d.innerHTML = `
      <div class="top">
        <span class="pill ${item.channel}">${CHANNEL_LABEL[item.channel]}</span>
        <b>${esc(item.guestName)}</b>
        <span class="muted">${esc(item.accommodation)} · to ${esc(item.to)}</span>
        <span class="spacer"></span>
        <span class="muted" style="font-size:12px">${fmt(item.at)}</span>
      </div>
      ${item.subject ? `<div class="msg-subject" style="font-size:16px">${esc(item.subject)}</div>` : ""}
      <div class="msg-text" style="font-size:13.5px">${esc(item.body)}</div>
    `;
    el.appendChild(d);
  }
}

function refreshAll() { renderOverview(); renderMessages(); renderLog(); }

// --- boot ---
(async () => {
  const s = await api.get("/api/session");
  if (s.authed) showApp(); else showLogin();
})();
