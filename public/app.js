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
document.querySelectorAll(".tabbtn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tabbtn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    $("#tab-messages").classList.toggle("hidden", tab !== "messages");
    $("#tab-log").classList.toggle("hidden", tab !== "log");
    $("#tab-prefs").classList.toggle("hidden", tab !== "prefs");
    if (tab === "log") renderLog();
    if (tab === "prefs") renderPrefs();
  });
});

// --- save timing ---
$("#applyConfig").addEventListener("click", async () => {
  await api.post("/api/config", {
    preferencesHoursBefore: Number($("#prefDays").value) * 24,
    preStayHoursBefore: Number($("#preHours").value),
    postStayHoursAfter: Number($("#postHours").value),
  });
  toast("Message timing saved");
  renderMessages();
});

// --- demo: simulate ---
$("#simBtn").addEventListener("click", async () => {
  const hrs = Number($("#simSelect").value);
  const res = await api.post("/api/simulate", { atHoursFromNow: hrs });
  toast(res.sentCount > 0
    ? `${res.sentCount} message(s) sent`
    : "Nothing due to send yet");
  renderMessages();
  renderLog();
  renderPrefs();
});

// --- helpers ---
function fmt(iso) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
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
const KIND_LABEL = { preferences: "Preferences invite", pre_stay: "Welcome", post_stay: "Thank-you" };
const KIND_CLASS = { preferences: "prefs", pre_stay: "pre", post_stay: "post" };
const CHANNEL_LABEL = { email: "Email", sms: "SMS", whatsapp: "WhatsApp" };
const MOTIVE_LABEL = { business: "Business", leisure: "Leisure", both: "Business & leisure" };
const LANG_LABEL = { en: "EN", pt: "PT", fr: "FR" };

function statusDotColor(status) {
  return status === "sent" ? "#4f8a3f" : status === "cancelled" ? "#bbb" : "#c3a079";
}

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
    const kindClass = KIND_CLASS[m.kind];
    const channelNote = m.channel === "email"
      ? "Sent by email"
      : `Short message sent by ${CHANNEL_LABEL[m.channel]}`;

    card.innerHTML = `
      <div class="msg-head">
        <span class="who">${esc(g.firstName)} ${esc(g.lastName)}</span>
        <span class="book">${esc(m.accommodation)} · ${esc(MOTIVE_LABEL[m.motive] || "")} · ${esc(m.reference)}</span>
        <span class="spacer"></span>
        <span class="pill ${kindClass}">${KIND_LABEL[m.kind]}</span>
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
      ${m.status === "scheduled" ? `
      <div class="msg-actions">
        <button class="ghost" data-edit="${m.id}">Edit wording</button>
        <button class="ghost" data-cancel="${m.id}">Don't send</button>
      </div>` : ""}
    `;
    el.appendChild(card);
  }

  el.querySelectorAll("[data-edit]").forEach((b) =>
    b.addEventListener("click", () => openEditor(b.dataset.edit, msgs)));
  el.querySelectorAll("[data-cancel]").forEach((b) =>
    b.addEventListener("click", async () => {
      await api.post(`/api/messages/${b.dataset.cancel}/cancel`);
      toast("Message won't be sent");
      renderMessages();
    }));
}

function openEditor(id, msgs) {
  const m = msgs.find((x) => x.id === id);
  if (!m) return;
  const card = [...document.querySelectorAll(".msg-card")]
    .find((c) => c.querySelector(`[data-edit="${id}"]`));
  const body = card.querySelector(".msg-body");
  const actions = card.querySelector(".msg-actions");
  if (actions) actions.style.display = "none";
  body.innerHTML = `
    <div class="edit-area">
      ${m.subject !== undefined ? `<input id="editSubject" value="${escAttr(m.subject ?? "")}" placeholder="Subject" />` : ""}
      <textarea id="editBody">${esc(m.body)}</textarea>
      <div style="display:flex;gap:10px">
        <button class="primary" id="saveEdit">Save</button>
        <button class="ghost" id="cancelEdit">Discard</button>
      </div>
    </div>
  `;
  body.querySelector("#saveEdit").addEventListener("click", async () => {
    const patch = { body: body.querySelector("#editBody").value };
    const subEl = body.querySelector("#editSubject");
    if (subEl) patch.subject = subEl.value;
    await api.post(`/api/messages/${id}/edit`, patch);
    toast("Wording saved");
    renderMessages();
  });
  body.querySelector("#cancelEdit").addEventListener("click", renderMessages);
}

// --- guest preferences / prep sheets ---
const ARRIVAL = { early: "Before 15:00", afternoon: "15:00–18:00", evening: "18:00–21:00", late: "After 21:00" };
const DRINK = { still_water: "Still water", sparkling_water: "Sparkling water", wine: "Regional wine", sparkling_wine: "Sparkling wine", beer: "Beer", alcohol_free: "Alcohol-free" };
const BEDS = { separate: "Separate beds — check villa", extra: "Extra bed — check villa" };
const ADAPTER = { uk: "UK", us: "US", other: "Other — ask guest" };
const DIET = { vegetarian: "Vegetarian", vegan: "Vegan", pescatarian: "Pescatarian", gluten_free: "Gluten-free", lactose_free: "Lactose-free" };
const OCCASION = { birthday: "Birthday", anniversary: "Anniversary", honeymoon: "Honeymoon", treat: "Treating themselves", other: "Celebration" };
const EXPERIENCE = {
  trail: "Vale Palheiro Trail", picnic: "Picnic", jeep: "Jeep tour", horse: "Horse riding", balloon: "Balloon flight",
  bikes: "Bicycles", surf: "Surf lessons", boat: "Boat trip (Lagos)", kayak: "Kayak (Lagos)", yoga: "Yoga / Pilates / Barre",
  massage: "Massage in villa", wine_tasting: "Wine tasting", barn: "Table at The Barn", private_dinner: "Private lunch/dinner",
  cooking: "Cooking workshop", workshop: "Creative workshop", transfer: "Airport transfer", babysitting: "Babysitting",
};

function prefStatus(r, invites) {
  const now = Date.now();
  if (Date.parse(r.checkOut) < now) return { cls: "past", label: "Stay over", text: r.preferences ? "Preferences from this stay." : "No preferences were collected." };
  if (r.preferences) return { cls: "answered", label: "Answered", text: `Guest answered ${relative(r.preferences.submittedAt)} · ${fmt(r.preferences.submittedAt)}` };
  const inv = invites.find((m) => m.reservationId === r.id && m.status !== "cancelled");
  if (inv && inv.status === "sent") return { cls: "waiting", label: "Waiting for guest", text: `Invite sent ${fmt(inv.sentAt)}. Defaults will be used if they don't answer.` };
  if (inv) return { cls: "upcoming", label: "Invite scheduled", text: `Invite sends ${relative(inv.sendAt)} · ${fmt(inv.sendAt)}` };
  if (Date.parse(r.checkIn) < now) return { cls: "answered", label: "In house", text: "Guest is staying with us now." };
  return { cls: "call", label: "Call guest", text: "Arrival is too close for the online invite — front office reaches out personally." };
}

function prepGrid(r) {
  const p = r.preferences;
  if (!p) return "";
  const item = (k, v, extra = "") => `<div class="prep-item ${extra}"><div class="k">${k}</div><div class="v">${esc(v)}</div></div>`;
  let html = item("Fireplace", p.fireplace ? "Lay & ready to light" : "Not needed")
    + item("Fridge", p.drinks.length ? p.drinks.map((d) => DRINK[d]).join(", ") : "Nothing")
    + (p.beds !== "as_booked" ? item("Beds", BEDS[p.beds], "alert") : item("Beds", "As booked"))
    + (p.adapter !== "none" ? item("Plug adapter", ADAPTER[p.adapter]) : "")
    + item("Arrival", ARRIVAL[p.arrival]);
  if (p.allergies) html += item("Allergies · guest consented", p.allergies, "alert");
  else if (p.allergiesDeletedAt) html += item("Allergies", `Deleted after stay · ${fmt(p.allergiesDeletedAt)}`);
  if (p.dietary.length) html += item("Dietary", p.dietary.map((d) => DIET[d]).join(", "));
  if (p.occasion !== "none") html += item("Occasion", OCCASION[p.occasion] + (p.occasionNote ? ` — ${p.occasionNote}` : ""), "wide");
  if (p.experiences.length) html += item("To arrange · contact guest", p.experiences.map((i) => EXPERIENCE[i]).join(", "), "wide todo");
  if (p.note) html += item("Note from guest", p.note, "wide");
  if (p.rememberForNextTime) html += item("Return visits", "Guest asked us to remember these", "wide");
  return `<div class="prep-grid">${html}</div>`;
}

async function renderPrefs() {
  const [res, msgs] = await Promise.all([api.get("/api/reservations"), api.get("/api/messages")]);
  const invites = msgs.filter((m) => m.kind === "preferences");
  const sorted = [...res].sort((a, b) => Date.parse(a.checkIn) - Date.parse(b.checkIn))
    .sort((a, b) => (Date.parse(a.checkOut) < Date.now()) - (Date.parse(b.checkOut) < Date.now()));
  $("#prefCount").textContent = `(${res.filter((r) => r.preferences).length}/${res.length})`;
  const el = $("#prefs");
  el.innerHTML = "";
  for (const r of sorted) {
    const st = prefStatus(r, invites);
    const card = document.createElement("div");
    card.className = "prep-card";
    card.innerHTML = `
      <div class="prep-head">
        <span class="who">${esc(r.guest.firstName)} ${esc(r.guest.lastName)}</span>
        <span class="book">${esc(r.accommodation)} · arrives ${fmt(r.checkIn)} · ${r.partySize} guest${r.partySize === 1 ? "" : "s"} · ${esc(r.reference)}</span>
        <span class="spacer"></span>
        <span class="pill lang">${LANG_LABEL[r.guest.language]}</span>
        <span class="pill ${st.cls}">${st.label}</span>
      </div>
      <div class="prep-status">${esc(st.text)}</div>
      ${prepGrid(r)}
      ${r.preferencesOpen || (r.preferences && Date.parse(r.checkOut) > Date.now()) ? `
      <div class="prep-actions">
        <a class="ghost" href="${escAttr(r.preferencesUrl)}" target="_blank" rel="noopener">Open guest page ↗</a>
        <button class="ghost" data-copy="${escAttr(r.preferencesUrl)}">Copy guest link</button>
      </div>` : ""}
    `;
    el.appendChild(card);
  }
  el.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); toast("Guest link copied"); }
    catch { toast(b.dataset.copy); }
  }));
}

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

async function loadConfig() {
  const cfg = await api.get("/api/config");
  $("#prefDays").value = Math.round(cfg.preferencesHoursBefore / 24);
  $("#preHours").value = cfg.preStayHoursBefore;
  $("#postHours").value = cfg.postStayHoursAfter;
}

function refreshAll() { loadConfig(); renderMessages(); renderPrefs(); }

// Refresh when coming back to the tab (e.g. after answering as a guest in another tab).
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && !$("#app").classList.contains("hidden")) {
    renderMessages(); renderPrefs();
  }
});

function esc(s) {
  return String(s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function escAttr(s) { return esc(s).replaceAll('"', "&quot;"); }

// --- boot ---
(async () => {
  const s = await api.get("/api/session");
  if (s.authed) showApp(); else showLogin();
})();
