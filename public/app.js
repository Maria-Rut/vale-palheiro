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

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const res = await api.post("/api/login", { username: $("#username").value, password: $("#password").value });
  if (res.ok) { $("#loginErr").textContent = ""; showApp(); }
  else $("#loginErr").textContent = res.error || "Login failed";
});
$("#logoutBtn").addEventListener("click", async () => { await api.post("/api/logout"); showLogin(); });

document.querySelectorAll(".tabbtn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tabbtn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    $("#tab-messages").classList.toggle("hidden", tab !== "messages");
    $("#tab-crm").classList.toggle("hidden", tab !== "crm");
    $("#tab-log").classList.toggle("hidden", tab !== "log");
    if (tab === "crm") renderCrm();
    if (tab === "log") renderLog();
  });
});

$("#applyConfig").addEventListener("click", async () => {
  await api.post("/api/config", {
    preferencesDaysBefore: Number($("#prefDays").value),
    preStayHoursBefore: Number($("#preHours").value),
    experiencesHoursAfter: Number($("#expHours").value),
    postStayHoursAfter: Number($("#postHours").value),
  });
  toast("Message timing saved");
  renderMessages();
});

$("#simBtn").addEventListener("click", async () => {
  const hrs = Number($("#simSelect").value);
  const res = await api.post("/api/simulate", { atHoursFromNow: hrs });
  toast(res.sentCount > 0 ? `${res.sentCount} message(s) sent` : "Nothing due to send yet");
  renderMessages(); renderLog();
});

function fmt(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
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

const KIND_LABEL = { preferences: "Preferences", pre_stay: "Welcome", experiences: "Experiences", post_stay: "Thank-you" };
const KIND_CLASS = { preferences: "prefs", pre_stay: "pre", experiences: "exp", post_stay: "post" };
const CHANNEL_LABEL = { email: "Email", sms: "SMS", whatsapp: "WhatsApp" };
const MOTIVE_LABEL = { business: "Business", leisure: "Leisure", both: "Business & leisure" };
const LANG_LABEL = { en: "EN", pt: "PT", fr: "FR" };
const WEATHER_LABEL = { sunny: "☀ Sunny", cloudy: "⛅ Cloudy", rainy: "🌧 Rainy", windy: "💨 Windy" };
const INTEREST_LABEL = { land_trails: "Land & trails", sea_coast: "Sea & coast", wellbeing: "Wellbeing", food_wine: "Food & wine", crafts: "Crafts" };
const PACE_LABEL = { active: "Active", balanced: "Balanced", restful: "Restful" };

function statusDotColor(s) { return s === "sent" ? "#4f8a3f" : s === "cancelled" ? "#bbb" : "#c3a079"; }

async function renderMessages() {
  const msgs = await api.get("/api/messages");
  $("#msgCount").textContent = `(${msgs.length})`;
  const el = $("#messages");
  el.innerHTML = "";
  if (!msgs.length) { el.innerHTML = `<p class="empty">No messages planned.</p>`; return; }

  for (const m of msgs) {
    const g = m.guest ?? {};
    const card = document.createElement("div");
    card.className = "msg-card";
    const channelNote = m.channel === "email" ? "Sent by email" : `Short message sent by ${CHANNEL_LABEL[m.channel]}`;
    const weatherPill = m.kind === "experiences" && m.weather ? `<span class="pill weather">${WEATHER_LABEL[m.weather]}</span>` : "";
    card.innerHTML = `
      <div class="msg-head">
        <span class="who">${esc(g.firstName)} ${esc(g.lastName)}</span>
        <span class="book">${esc(m.accommodation)} · ${esc(MOTIVE_LABEL[m.motive] || "")} · ${esc(m.reference)}</span>
        <span class="spacer"></span>
        <span class="pill ${KIND_CLASS[m.kind]}">${KIND_LABEL[m.kind]}</span>
        ${weatherPill}
        <span class="pill ${m.channel}">${CHANNEL_LABEL[m.channel]}</span>
        <span class="pill lang">${LANG_LABEL[m.language]}</span>
        <span class="pill ${m.status}"><span class="status-dot" style="background:${statusDotColor(m.status)}"></span>${m.status}</span>
      </div>
      <div class="channel-note">${channelNote}</div>
      <div class="msg-body">
        ${m.subject ? `<div class="msg-subject">${esc(m.subject)}</div>` : ""}
        <div class="msg-text">${esc(m.body)}</div>
      </div>
      <div class="msg-meta">
        <span>${m.status === "sent" ? "Sent " + fmt(m.sentAt) : "Sends " + relative(m.sendAt) + " · " + fmt(m.sendAt)}</span>
        <span>Written by ${m.generatedBy === "llm" ? "AI, from the Vale Palheiro voice" : "the Vale Palheiro template"}</span>
      </div>
      ${m.status === "scheduled" ? `<div class="msg-actions"><button class="ghost" data-edit="${m.id}">Edit wording</button><button class="ghost" data-cancel="${m.id}">Don't send</button></div>` : ""}
    `;
    el.appendChild(card);
  }
  el.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openEditor(b.dataset.edit, msgs)));
  el.querySelectorAll("[data-cancel]").forEach((b) => b.addEventListener("click", async () => {
    await api.post(`/api/messages/${b.dataset.cancel}/cancel`); toast("Message won't be sent"); renderMessages();
  }));
}

function openEditor(id, msgs) {
  const m = msgs.find((x) => x.id === id);
  if (!m) return;
  const card = [...document.querySelectorAll(".msg-card")].find((c) => c.querySelector(`[data-edit="${id}"]`));
  const body = card.querySelector(".msg-body");
  const actions = card.querySelector(".msg-actions");
  if (actions) actions.style.display = "none";
  body.innerHTML = `
    <div class="edit-area">
      ${m.subject !== undefined ? `<input id="editSubject" value="${escAttr(m.subject ?? "")}" placeholder="Subject" />` : ""}
      <textarea id="editBody">${esc(m.body)}</textarea>
      <div style="display:flex;gap:10px"><button class="primary" id="saveEdit">Save</button><button class="ghost" id="cancelEdit">Discard</button></div>
    </div>`;
  body.querySelector("#saveEdit").addEventListener("click", async () => {
    const patch = { body: body.querySelector("#editBody").value };
    const subEl = body.querySelector("#editSubject");
    if (subEl) patch.subject = subEl.value;
    await api.post(`/api/messages/${id}/edit`, patch); toast("Wording saved"); renderMessages();
  });
  body.querySelector("#cancelEdit").addEventListener("click", renderMessages);
}

async function renderCrm() {
  const rows = await api.get("/api/crm");
  $("#crmCount").textContent = `(${rows.length})`;
  const el = $("#crm");
  el.innerHTML = "";
  for (const r of rows) {
    const g = r.guest;
    const p = r.preferences;
    const card = document.createElement("div");
    card.className = "crm-card";
    const weatherOptions = ["sunny", "cloudy", "rainy", "windy"]
      .map((w) => `<option value="${w}" ${r.weather === w ? "selected" : ""}>${WEATHER_LABEL[w]}</option>`).join("");

    const prefHtml = p ? `
      <div class="kv"><b>Arrival:</b> ${p.estimatedArrival ? fmt(p.estimatedArrival) : "—"}</div>
      <div class="kv"><b>Occasion:</b> ${esc(p.occasion || "—")}</div>
      <div class="kv"><b>Dietary:</b> ${esc(p.dietary || "—")}</div>
      <div class="kv"><b>Pace:</b> ${p.pace ? PACE_LABEL[p.pace] : "—"}</div>
      <div class="kv" style="margin-top:8px"><b>Interests:</b></div>
      <div class="chips">${(p.interests || []).map((i) => `<span class="chip">${INTEREST_LABEL[i] || i}</span>`).join("") || "<span class='no-prefs'>none given</span>"}</div>
      <div class="kv" style="margin-top:8px"><b>To arrange:</b></div>
      <div class="chips">${(p.arrangements || []).map((a) => `<span class="chip">${esc(a)}</span>`).join("") || "<span class='no-prefs'>none</span>"}</div>
      ${p.notes ? `<div class="kv" style="margin-top:8px"><b>Notes:</b> ${esc(p.notes)}</div>` : ""}
    ` : `<p class="no-prefs">No questionnaire response yet. The preferences email invites the guest to fill it in; answers appear here.</p>`;

    card.innerHTML = `
      <div class="crm-head">
        <span class="who">${esc(g.firstName)} ${esc(g.lastName)}</span>
        <span class="muted">${esc(r.accommodation)} · ${esc(r.reference)}</span>
        <span class="spacer"></span>
        <span class="muted" style="font-size:13px">${fmtDate(r.checkIn)} → ${fmtDate(r.checkOut)} · ${r.partySize} guest(s)</span>
      </div>
      <div class="crm-body">
        <div class="crm-sec">
          <h4>Contact & booking</h4>
          <div class="kv"><b>Email:</b> ${esc(g.email)}</div>
          <div class="kv"><b>Phone:</b> ${esc(g.phone)}</div>
          <div class="kv"><b>Language:</b> ${LANG_LABEL[g.language]}</div>
          <div class="kv"><b>Rate:</b> ${esc(r.ratePlan)}${r.breakfastIncluded ? " · breakfast included" : ""}</div>
          <div class="kv"><b>Motive:</b> ${MOTIVE_LABEL[r.motive]}</div>
          ${r.notes ? `<div class="kv" style="margin-top:8px"><b>Staff note:</b> ${esc(r.notes)}</div>` : ""}
          <div class="kv" style="margin-top:12px"><b>Forecast for stay</b> <span class="muted">(demo)</span></div>
          <div class="weather-pick">
            <select data-weather="${r.id}">${weatherOptions}</select>
            <span class="muted" style="font-size:12px">drives the Experiences email</span>
          </div>
        </div>
        <div class="crm-sec">
          <h4>Guest preferences</h4>
          ${prefHtml}
        </div>
      </div>`;
    el.appendChild(card);
  }
  el.querySelectorAll("[data-weather]").forEach((sel) => sel.addEventListener("change", async () => {
    await api.post(`/api/reservations/${sel.dataset.weather}/weather`, { weather: sel.value });
    toast("Forecast updated — Experiences email refreshed");
    renderMessages();
  }));
}

async function renderLog() {
  const log = await api.get("/api/sent-log");
  $("#logCount").textContent = `(${log.length})`;
  const el = $("#log");
  if (!log.length) { el.innerHTML = `<p class="empty">Nothing sent yet. Use the demo tools to send what's due.</p>`; return; }
  el.innerHTML = "";
  for (const item of log) {
    const d = document.createElement("div");
    d.className = "crm-card";
    d.style.padding = "14px 18px";
    d.innerHTML = `
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;flex-wrap:wrap">
        <span class="pill ${item.channel}">${CHANNEL_LABEL[item.channel]}</span>
        <b style="font-family:var(--serif);font-size:17px">${esc(item.guestName)}</b>
        <span class="muted">${esc(item.accommodation)} · to ${esc(item.to)}</span>
        <span class="spacer"></span>
        <span class="muted" style="font-size:12px">${fmt(item.at)}</span>
      </div>
      ${item.subject ? `<div class="msg-subject" style="font-size:16px">${esc(item.subject)}</div>` : ""}
      <div class="msg-text" style="font-size:13.5px">${esc(item.body)}</div>`;
    el.appendChild(d);
  }
}

async function loadConfig() {
  const cfg = await api.get("/api/config");
  $("#prefDays").value = cfg.preferencesDaysBefore;
  $("#preHours").value = cfg.preStayHoursBefore;
  $("#expHours").value = cfg.experiencesHoursAfter;
  $("#postHours").value = cfg.postStayHoursAfter;
}
function refreshAll() { loadConfig(); renderMessages(); }

function esc(s) { return String(s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }
function escAttr(s) { return esc(s).replaceAll('"', "&quot;"); }

(async () => {
  const s = await api.get("/api/session");
  if (s.authed) showApp(); else showLogin();
})();
