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

// Which steps are "message" tabs (vs crm / settings).
const MESSAGE_TABS = ["preferences", "pre_stay", "experiences", "post_stay", "needs_approval", "sent"];
let activeTab = "preferences";

const ALL_NAV = ".steptab, .utilbtn";
document.querySelectorAll(ALL_NAV).forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(ALL_NAV).forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeTab = btn.dataset.tab;
    $("#view-messages").classList.toggle("hidden", !MESSAGE_TABS.includes(activeTab));
    $("#view-crm").classList.toggle("hidden", activeTab !== "crm");
    $("#view-settings").classList.toggle("hidden", activeTab !== "settings");
    if (activeTab === "crm") renderCrm();
    else if (activeTab === "settings") { /* static */ }
    else renderMessages();
  });
});

$("#applyConfig").addEventListener("click", async () => {
  await api.post("/api/config", {
    preferencesDaysBefore: Number($("#prefDays").value),
    preStayHoursBefore: Number($("#preHours").value),
    experiencesHoursAfter: Number($("#expHours").value),
    postStayHoursAfter: Number($("#postHours").value),
    approvalPolicy: $("#approvalPolicy").value,
  });
  toast("Settings saved");
  renderMessages();
});

$("#simBtn").addEventListener("click", async () => {
  const hrs = Number($("#simSelect").value);
  const res = await api.post("/api/simulate", { atHoursFromNow: hrs });
  toast(res.sentCount > 0 ? `${res.sentCount} message(s) sent` : "Nothing due to send yet");
  renderMessages();
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
const STATUS_LABEL = { needs_approval: "needs approval", scheduled: "scheduled", sent: "sent", cancelled: "cancelled" };

function statusDotColor(s) {
  return s === "sent" ? "#4f8a3f" : s === "cancelled" ? "#bbb" : s === "needs_approval" ? "#d79a2e" : "#c3a079";
}

/** Action buttons depend on status: held messages can be approved. */
function actionsFor(m) {
  if (m.status === "needs_approval") {
    return `<div class="msg-actions">
      <button class="primary" data-approve="${m.id}">Approve &amp; send</button>
      <button class="ghost" data-edit="${m.id}">Edit wording</button>
      <button class="ghost" data-cancel="${m.id}">Don't send</button>
    </div>`;
  }
  if (m.status === "scheduled") {
    return `<div class="msg-actions">
      <button class="ghost" data-edit="${m.id}">Edit wording</button>
      <button class="ghost" data-cancel="${m.id}">Don't send</button>
    </div>`;
  }
  return "";
}

const TAB_TITLE = {
  preferences: "1 week before · Preferences",
  pre_stay: "2h before · Welcome",
  experiences: "After check-in · Experiences",
  post_stay: "Post-stay · Thank-you",
  needs_approval: "Needs approval",
  sent: "Sent",
};
const TAB_DESC = {
  preferences: "The earliest email — invites the guest to fill an easy questionnaire so the team has time to prepare.",
  pre_stay: "The welcome message, sent shortly before the guest arrives.",
  experiences: "Sent after check-in — activities matched to the day's weather and the guest's interests. Held for approval by default.",
  post_stay: "Sent after checkout — thanks and a gentle invitation to share feedback.",
  needs_approval: "Uncertain messages waiting for your approval. Terra won't send these until you approve them.",
  sent: "Messages that have already been delivered.",
};

// A message belongs to the active tab either by its stage (kind) or status.
function matchesTab(m, tab) {
  if (tab === "needs_approval") return m.status === "needs_approval";
  if (tab === "sent") return m.status === "sent";
  return m.kind === tab;
}

async function renderMessages() {
  const all = await api.get("/api/messages");
  // Counts on each nav tab.
  const counts = {
    preferences: all.filter((m) => m.kind === "preferences").length,
    pre_stay: all.filter((m) => m.kind === "pre_stay").length,
    experiences: all.filter((m) => m.kind === "experiences").length,
    post_stay: all.filter((m) => m.kind === "post_stay").length,
    needs_approval: all.filter((m) => m.status === "needs_approval").length,
    sent: all.filter((m) => m.status === "sent").length,
  };
  for (const k of Object.keys(counts)) {
    const badge = $(`#cnt-${k}`);
    if (badge) badge.textContent = counts[k] ? `(${counts[k]})` : "";
  }

  $("#viewTitle").textContent = TAB_TITLE[activeTab] || "";
  $("#viewDesc").textContent = TAB_DESC[activeTab] || "";

  const msgs = all.filter((m) => matchesTab(m, activeTab));
  const el = $("#messages");
  el.innerHTML = "";
  if (!msgs.length) { el.innerHTML = `<p class="empty">Nothing here right now.</p>`; return; }

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
        <span class="pill ${m.status}"><span class="status-dot" style="background:${statusDotColor(m.status)}"></span>${STATUS_LABEL[m.status] || m.status}</span>
      </div>
      <div class="channel-note">${channelNote}</div>
      <div class="msg-body">
        ${m.subject ? `<div class="msg-subject">${esc(m.subject)}</div>` : ""}
        <div class="msg-text">${esc(m.body)}</div>
      </div>
      <div class="msg-meta">
        <span>${m.status === "sent" ? "Sent " + fmt(m.sentAt) : (m.status === "cancelled" ? "Will not be sent" : "Sends " + relative(m.sendAt) + " · " + fmt(m.sendAt))}</span>
        <span>Written by ${m.generatedBy === "llm" ? "AI, from the Vale Palheiro voice" : "the Vale Palheiro template"}</span>
      </div>
      ${actionsFor(m)}
    `;
    el.appendChild(card);
  }
  el.querySelectorAll("[data-approve]").forEach((b) => b.addEventListener("click", async () => {
    await api.post(`/api/messages/${b.dataset.approve}/approve`); toast("Approved — Terra will send it at the right time"); renderMessages();
  }));
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

async function loadConfig() {
  const cfg = await api.get("/api/config");
  $("#prefDays").value = cfg.preferencesDaysBefore;
  $("#preHours").value = cfg.preStayHoursBefore;
  $("#expHours").value = cfg.experiencesHoursAfter;
  $("#postHours").value = cfg.postStayHoursAfter;
  if (cfg.approvalPolicy) $("#approvalPolicy").value = cfg.approvalPolicy;
}
function refreshAll() { loadConfig(); renderMessages(); }

function esc(s) { return String(s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }
function escAttr(s) { return esc(s).replaceAll('"', "&quot;"); }

(async () => {
  const s = await api.get("/api/session");
  if (s.authed) showApp(); else showLogin();
})();
