/* Vale Palheiro dashboard — vanilla JS, no build step. Talks to the JSON API. */

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
const TABS = ["emails", "messages", "prefs", "tasks", "events", "weather", "property", "settings"];
const RENDER = {
  emails: renderEmails, messages: renderMessages, tasks: renderTasks, prefs: renderPrefs, events: renderEvents,
  weather: renderWeather, property: renderProperty, settings: loadConfig,
};
const PAGE = {
  emails: ["Guest messages", "We write to every guest at the right moments of their stay, in their own language and at a good hour where they live — by email and WhatsApp. Click a step to read and edit it."],
  messages: ["Outbox", "Every message planned for real bookings, and what has already gone out. WhatsApps wait here to be sent by hand until the Business API is connected."],
  prefs: ["Guests", "Everyone arriving soon, staying now or just left: their profile, consent, and what they told us on their page."],
  tasks: ["Team tasks", "Created automatically from bookings and guest answers — the human touches the system leaves to the team."],
  events: ["Events", "The resort calendar, and who gets invited — personalised, about a week ahead, never to guests who didn't subscribe."],
  weather: ["Weather & experiences", "The forecast for the estate and the sea, the suggestion for each guest each day, and the experiences the agent may suggest."],
  property: ["Resort settings", "The resort's practical information, kept in one place. It goes straight into every email, WhatsApp and the guest page."],
  settings: ["Settings", "When each message goes out, on which channel, what needs approval — and the state of each connection."],
};
function openTab(tab) {
  document.querySelectorAll(".tabbtn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  for (const t of TABS) $(`#tab-${t}`).classList.toggle("hidden", t !== tab);
  $("#pageTitle").textContent = PAGE[tab][0];
  $("#pageIntro").textContent = PAGE[tab][1];
  $("#overviewBlock").classList.toggle("hidden", tab !== "emails" && tab !== "messages");
  document.body.classList.remove("menu-open");
  window.scrollTo(0, 0);
  RENDER[tab]();
}
// Phones: full-screen menu. Laptops: the side panel slides away and back,
// and the choice is remembered on this computer.
const isWide = () => window.matchMedia("(min-width: 901px)").matches;
function setCollapsed(on) {
  document.body.classList.toggle("side-collapsed", on);
  try { localStorage.setItem("vp-side-collapsed", on ? "1" : "0"); } catch {}
}
try { if (localStorage.getItem("vp-side-collapsed") === "1") document.body.classList.add("side-collapsed"); } catch {}
$("#menuOpen").addEventListener("click", () => (isWide() ? setCollapsed(false) : document.body.classList.add("menu-open")));
$("#menuClose").addEventListener("click", () => (isWide() ? setCollapsed(true) : document.body.classList.remove("menu-open")));
document.querySelector("[data-home]").addEventListener("click", (e) => { e.preventDefault(); openTab("emails"); });
document.querySelectorAll(".tabbtn").forEach((btn) => btn.addEventListener("click", () => openTab(btn.dataset.tab)));

// --- labels ---
const KIND_LABEL = {
  pre_arrival: "3 days before",
  arrival_day: "3 hours before",
  in_stay: "Welcome",
  post_stay: "Thank you",
  event_invite: "Event invite",
  morning: "Good morning",
};

/** A WhatsApp message as the guest sees it: text, then [Button](link) lines as link buttons. */
const TEXT_KEYS = ["pre_arrival_text", "arrival_text", "morning", "post_stay_text"];
function waBubble(body) {
  const lines = String(body ?? "").split("\n");
  const btns = [];
  while (lines.length && /^\s*$/.test(lines[lines.length - 1])) lines.pop();
  while (lines.length && /^\[[^\]]+\]\(\S*\)$/.test(lines[lines.length - 1].trim())) btns.unshift(lines.pop().trim());
  const text = lines.join("\n").replace(/^##\s+/gm, "").replace(/\[([^\]]+)\]\((\S+)\)/g, "$1: $2").trim();
  return `<div class="bubble wa">${esc(text)}${btns.length ? `<div class="wa-btns">${btns.map((b) => {
    const [, label, link] = b.match(/^\[([^\]]+)\]\((\S*)\)$/);
    return `<a href="${escAttr(link)}" target="_blank" rel="noopener">↗ ${esc(label)}</a>`;
  }).join("")}</div>` : ""}</div>`;
}
const CHANNEL_LABEL = { email: "Email", sms: "SMS", whatsapp: "WhatsApp" };
const LANG_LABEL = { en: "EN", pt: "PT", fr: "FR" };
const LANG_NAME = { en: "English", pt: "Portuguese", fr: "French" };
const STATUS_LABEL = {
  scheduled: "scheduled", held: "awaiting approval", sent: "sent", cancelled: "not sending", skipped: "skipped",
  manual: "to send by hand", failed: "failed",
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
    ["1", "We're getting ready", `${cfg.preArrivalDaysBefore} days before arrival`, "", "pre_arrival"],
    ["2", "Arrival details", `${cfg.arrivalHoursBefore}h before arrival`, "", "arrival_day"],
    ["3", "Welcome + suggestions", `${cfg.inStayHoursAfterCheckIn}h after check-in`, "", "in_stay"],
    ["4", "Thank you + review", `${cfg.postStayHoursAfterCheckOut}h after check-out`, "post", "post_stay"],
    ["5", "Event invites", "opted-in past guests", "evt", "event_invite"],
  ];
  $("#journey").innerHTML = stages.map(([n, t, w, c, k]) =>
    `<button class="stage ${c}" data-step="${k}" title="Read this email"><div class="dot">${n}</div><div class="t">${t}</div><div class="w">${w}</div></button>`).join("");
  $("#journey").querySelectorAll("[data-step]").forEach((b) => b.addEventListener("click", () => {
    currentStep = b.dataset.step;
    openTab("emails");
    $("#tab-emails").scrollIntoView({ behavior: "smooth", block: "start" });
  }));
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
  ["all", "All"], ["held", "Awaiting approval"], ["sched_email", "Scheduled email"], ["sched_whatsapp", "Scheduled WhatsApp"],
  ["manual", "To send by hand"], ["sent", "Sent"], ["failed", "Failed"],
  ["pre_arrival", "3 days before"], ["arrival_day", "Arrival day"],
  ["in_stay", "During the stay"], ["morning", "Good morning"], ["post_stay", "Thank you"], ["event_invite", "Event invites"],
];
function matchesFilter(m) {
  if (filter === "all") return true;
  if (filter === "sched_email") return m.status === "scheduled" && m.channel === "email";
  if (filter === "sched_whatsapp") return m.status === "scheduled" && m.channel === "whatsapp";
  if (["held", "sent", "manual", "failed"].includes(filter)) return m.status === filter;
  return m.kind === filter;
}
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
  const msgs = all.filter(matchesFilter);
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
      : `${["skipped", "cancelled", "manual", "failed"].includes(m.status) ? "Was due" : "Sends"} ${relative(m.sendAt)} · lands ${esc(m.localSendTime)} ${esc(m.timeZone)}`;
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
      ${(m.status === "skipped" || m.status === "manual" || m.status === "failed") && m.statusNote ? `<div class="note info">${esc(m.statusNote)}</div>` : ""}
      ${m.suggestions?.length ? `<div class="picks"><b>Recommendation agent</b>${m.suggestions.map((x) => `<div>${esc(resortDate(x.date + "T12:00:00Z"))}: ${esc(x.reason)}</div>`).join("")}</div>` : ""}
      <div class="msg-body">${messageView(m)}</div>
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
      ${m.status === "manual" || m.status === "failed" ? `
      <div class="msg-actions">
        ${m.whatsappLink ? `<a class="primary btnlink" href="${escAttr(m.whatsappLink)}" target="_blank" rel="noopener">Open in WhatsApp ↗</a>` : ""}
        <button class="ghost" data-sent="${m.id}">Mark as sent</button>
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
  el.querySelectorAll("[data-sent]").forEach((b) =>
    b.addEventListener("click", async () => {
      await api.post(`/api/messages/${b.dataset.sent}/sent`);
      toast("Marked as sent");
      refreshMessages();
    }));
  el.querySelectorAll("[data-approve]").forEach((b) =>
    b.addEventListener("click", async () => {
      await api.post(`/api/messages/${b.dataset.approve}/approve`);
      toast("Approved — it will go out on time");
      refreshMessages();
    }));
}

/** The email as the guest sees it — in English for the team, with the guest's own version one click away. */
function messageView(m) {
  const lang = LANG_NAME[m.language];
  if (m.channel !== "email") {
    return `<div class="inbox"><div class="inbox-head">WhatsApp to ${esc(m.guest?.firstName)} ${esc(m.guest?.lastName)} · ${esc(m.guest?.phone)}</div>${waBubble(m.body)}</div>${m.english ? `<details class="orig-toggle"><summary>English copy for the team</summary>${waBubble(m.english.body)}</details>` : ""}`;
  }
  const en = m.english ?? { subject: m.subject, body: m.body };
  const enHtml = m.englishHtml ?? m.html;
  return `
    <div class="msg-email">
      <div class="inbox">
        <div class="inbox-head">To ${esc(m.guest?.email)}${m.english ? ` · <i>English copy for the team</i>` : ""}<div class="subj">${esc(en.subject)}</div></div>
        <div class="inbox-body">${enHtml}</div>
      </div>
    </div>
    ${m.english ? `
    <details class="orig-toggle"><summary>Show what the guest receives (${lang})</summary>
      <div class="inbox" style="margin-top:10px">
        <div class="inbox-head">To ${esc(m.guest?.email)}<div class="subj">${esc(m.subject)}</div></div>
        <div class="inbox-body">${m.html}</div>
      </div>
    </details>` : ""}`;
}

function openEditor(btn, m) {
  if (!m) return;
  const card = btn.closest(".msg-card");
  const body = card.querySelector(".msg-body");
  const actions = card.querySelector(".msg-actions");
  if (actions) actions.style.display = "none";
  body.innerHTML = `
    <div class="edit-area">
      ${m.language !== "en" ? `<p class="hint muted" style="margin:0 0 8px">You're editing the ${LANG_NAME[m.language]} text this guest receives.</p>` : ""}
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
});

// --- email templates ---
let currentStep = "pre_arrival";
let templatesCache = null;

const STEP_SHORT = {
  pre_arrival: "3 days before", pre_arrival_text: "3 days · WhatsApp", arrival_day: "3 hours before", arrival_text: "Arrival · WhatsApp",
  in_stay: "Welcome", morning: "Good morning · WhatsApp", post_stay: "Thank you", post_stay_text: "Thank you · WhatsApp", event_invite: "Event invite",
};

function inboxCard(ex, kind) {
  const who = `<p class="guest-line"><b>${esc(ex.name)}</b> — ${esc(ex.about)}</p>`;
  if (TEXT_KEYS.includes(kind)) return `${who}<div class="inbox"><div class="inbox-head">WhatsApp to ${esc(ex.name)}</div>${waBubble(ex.text)}</div>`;
  return `${who}<div class="inbox">
      <div class="inbox-head">From Vale Palheiro · to ${esc(ex.email)}<div class="subj">${esc(ex.subject)}</div></div>
      <div class="inbox-body">${ex.html}</div>
    </div>`;
}

function editorHtml(step, lang) {
  const t = step.templates[lang];
  const isText = TEXT_KEYS.includes(step.key);
  return `
    <div class="tpl-edit" data-lang="${lang}">
      ${isText ? "" : `<label>Subject</label><input class="tSubject" value="${escAttr(t.subject)}" />`}
      <label>${isText ? "Message" : "Email"}</label>
      <textarea class="tBody" ${isText ? 'style="min-height:140px"' : ""}>${esc(t.body)}</textarea>
      <div class="tpl-actions">
        <button class="primary tSave">Save changes</button>
        ${t.edited ? `<button class="ghost tReset">Go back to the original</button>` : ""}
        <span class="state">${t.edited ? "Edited by the team" : "Original wording"}</span>
      </div>
    </div>`;
}

function fieldsHtml(step) {
  const simple = step.fields.filter((f) => !f.smart), smart = step.fields.filter((f) => f.smart);
  const chip = (f) => `<span class="field-chip ${f.smart ? "smart" : ""}" data-token="{{${f.token}}}" title="${escAttr(f.help)}">{{${f.token}}}</span>`;
  return `<div class="fields">
    <p class="how">Words in <code>{{double brackets}}</code> are filled in for each guest. Click one to add it where your cursor is; hover to see what it becomes.
    A line like <code>[Button text](link)</code> becomes a button${TEXT_KEYS.includes(step.key) ? " (in WhatsApp, a link button under the message)" : ""}.</p>
    <div>${simple.map(chip).join("")}</div>
    ${smart.length ? `<p class="how" style="margin-top:8px">Green ones are written automatically and only appear when they apply (a returning guest, a birthday, events that week, the weather plan…):</p><div>${smart.map(chip).join("")}</div>` : ""}
  </div>`;
}

async function renderEmails() {
  templatesCache = await api.get("/api/templates");
  $("#steps").innerHTML = templatesCache.map((s, i) =>
    `<button class="step-btn ${s.key === currentStep ? "on" : ""}" data-key="${s.key}"><span class="n">${i + 1}</span>${STEP_SHORT[s.key]}</button>`).join("");
  $("#steps").querySelectorAll("[data-key]").forEach((b) => b.addEventListener("click", () => { currentStep = b.dataset.key; renderEmails(); }));
  await renderStep();
}

async function renderStep() {
  const step = templatesCache.find((s) => s.key === currentStep);
  const view = $("#stepView");
  const previews = await api.get(`/api/templates/${step.key}/preview?lang=en`);
  const [first, ...rest] = previews;
  view.innerHTML = `
    <div class="step-head"><h2>${esc(step.title)}</h2><p>${esc(step.when)}</p></div>
    <div class="tpl-grid">
      <div>
        <p class="preview-label">Template · English</p>
        ${editorHtml(step, "en")}
        ${fieldsHtml(step)}
      </div>
      <div>
        <p class="preview-label">How the guest sees it</p>
        <div id="pv-first">${inboxCard(first, step.key)}</div>
        <button class="more-btn" id="moreBtn">Show ${rest.length} more example guests ▾</button>
        <div class="more-list hidden" id="moreList">${rest.map((ex) => `<div>${inboxCard(ex, step.key)}</div>`).join("")}</div>
      </div>
    </div>
    <button class="more-btn" id="langBtn" style="margin-top:26px">Show the Portuguese and French versions ▾</button>
    <div class="hidden" id="langList">
      ${["pt", "fr"].map((l) => `
        <div class="lang-block">
          <h3>${LANG_NAME[l]}</h3>
          <div class="tpl-grid">
            <div>${editorHtml(step, l)}</div>
            <div><p class="preview-label">How a ${LANG_NAME[l]}-speaking guest sees it</p><div class="pv-lang" data-lang="${l}"><p class="muted">Loading…</p></div></div>
          </div>
        </div>`).join("")}
    </div>`;

  $("#moreBtn").addEventListener("click", () => {
    const open = $("#moreList").classList.toggle("hidden");
    $("#moreBtn").textContent = open ? `Show ${rest.length} more example guests ▾` : "Hide the other guests ▴";
  });
  $("#langBtn").addEventListener("click", async () => {
    const hidden = $("#langList").classList.toggle("hidden");
    $("#langBtn").textContent = hidden ? "Show the Portuguese and French versions ▾" : "Hide the Portuguese and French versions ▴";
    if (!hidden) loadLangPreviews(step);
  });

  // Field chips insert at the cursor of the English body.
  let lastField = view.querySelector('.tpl-edit[data-lang="en"] .tBody');
  view.querySelectorAll(".tBody, .tSubject").forEach((el) => el.addEventListener("focus", () => { lastField = el; }));
  view.querySelectorAll("[data-token]").forEach((c) => c.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const el = lastField, tok = c.dataset.token;
    const a = el.selectionStart ?? el.value.length, b = el.selectionEnd ?? a;
    el.value = el.value.slice(0, a) + tok + el.value.slice(b);
    el.focus(); el.selectionStart = el.selectionEnd = a + tok.length;
  }));

  view.querySelectorAll(".tpl-edit").forEach((box) => {
    const lang = box.dataset.lang;
    box.querySelector(".tSave").addEventListener("click", async () => {
      const body = { body: box.querySelector(".tBody").value };
      const subj = box.querySelector(".tSubject");
      if (subj) body.subject = subj.value;
      await api.post(`/api/templates/${step.key}/${lang}`, body);
      toast(`${LANG_NAME[lang]} template saved — upcoming emails updated`);
      const langOpen = !$("#langList").classList.contains("hidden");
      await renderEmails();
      if (langOpen) $("#langBtn").click();
      renderOverview();
    });
    box.querySelector(".tReset")?.addEventListener("click", async () => {
      await api.post(`/api/templates/${step.key}/${lang}`, { reset: true });
      toast("Back to the original wording");
      const langOpen = !$("#langList").classList.contains("hidden");
      await renderEmails();
      if (langOpen) $("#langBtn").click();
    });
  });
}

async function loadLangPreviews(step) {
  for (const l of ["pt", "fr"]) {
    const box = document.querySelector(`.pv-lang[data-lang="${l}"]`);
    if (!box) continue;
    const [ex] = await api.get(`/api/templates/${step.key}/preview?lang=${l}`);
    box.innerHTML = inboxCard(ex, step.key);
  }
}

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

// --- guest preferences / prep sheets ---
const P_BEDS = { separate: "Separate beds — check villa", extra: "Extra bed — check villa" };
const P_ADAPTER = { uk: "UK", us: "US", other: "Other — ask guest" };
const P_DIET = { vegetarian: "Vegetarian", vegan: "Vegan", pescatarian: "Pescatarian", gluten_free: "Gluten-free", lactose_free: "Lactose-free" };
const P_OCCASION = { birthday: "Birthday", anniversary: "Anniversary", honeymoon: "Honeymoon", treat: "\"Do we need a reason?\" — a treat", other: "Something special" };
const P_EXPERIENCE = {
  trail: "Vale Palheiro Trail", picnic: "Picnic", jeep: "Jeep tour", horse: "Horse riding", balloon: "Balloon flight",
  bikes: "Bicycles", surf: "Surf lessons", boat: "Boat trip (Lagos)", kayak: "Kayak (Lagos)", yoga: "Yoga / Pilates / Barre",
  massage: "Massage in villa", wine_tasting: "Wine tasting", barn: "Table at The Barn", private_dinner: "Private lunch/dinner",
  cooking: "Cooking workshop", workshop: "Creative workshop", transfer: "Airport transfer", babysitting: "Babysitting",
};

function prefStatus(r) {
  const now = Date.now();
  if (Date.parse(r.checkOut) < now) return { cls: "past", label: "Stay over", text: r.preferences ? "Preferences from this stay." : "No preferences were collected." };
  if (r.preferences) return { cls: "answered", label: "Answered", text: `Guest answered ${relative(r.preferences.submittedAt)} · ${fmt(r.preferences.submittedAt)}` };
  if (Date.parse(r.checkIn) < now) return { cls: "past", label: "In house", text: "Guest is staying with us now." };
  const inv = r.invite;
  if (inv && inv.status === "sent") return { cls: "waiting", label: "Waiting for guest", text: `Link sent in the 3-days-before email (${fmt(inv.sentAt)}). If they don't answer, the defaults are used.` };
  if (inv && (inv.status === "scheduled" || inv.status === "held")) return { cls: "upcoming", label: "Link not sent yet", text: `Goes out with the 3-days-before email · ${fmt(inv.sendAt)}${inv.status === "held" ? " (waiting for approval)" : ""}` };
  return { cls: "call", label: "Call guest", text: "Booked too close to arrival for the online page — front office reaches out personally." };
}

function prepGrid(p) {
  if (!p) return "";
  const item = (k, v, extra = "") => `<div class="prep-item ${extra}"><div class="k">${k}</div><div class="v">${esc(v)}</div></div>`;
  const extras = [...(p.minibarExtras || []), p.minibarRequest ? `"${p.minibarRequest}"` : ""].filter(Boolean);
  let html = item("Arrival time", p.arrivalTime || "Not given")
    + (p.earlyCheckIn ? item("Early check-in", "Requested — subject to availability", "alert") : "")
    + item("Fireplace", p.fireplace ? "Lay & ready to light" : "Not needed")
    + item("Minibar extras", extras.length ? extras.join(", ") : "Standard only", extras.length ? "todo" : "")
    + (p.beds !== "as_booked" ? item("Beds", P_BEDS[p.beds], "alert") : item("Beds", "As booked"))
    + (p.adapter !== "none" ? item("Plug adapter", P_ADAPTER[p.adapter]) : "");
  if (p.allergies) html += item("Allergies · guest consented", p.allergies, "alert");
  else if (p.allergiesDeletedAt) html += item("Allergies", `Deleted after stay · ${fmt(p.allergiesDeletedAt)}`);
  if (p.dietary.length) html += item("Dietary", p.dietary.map((d) => P_DIET[d]).join(", "));
  if (p.occasion !== "none") html += item("Occasion", P_OCCASION[p.occasion] + (p.occasionNote ? ` — ${p.occasionNote}` : ""), "wide");
  if (p.experiences.length) html += item("To arrange · contact guest", p.experiences.map((e) => P_EXPERIENCE[e]).join(", "), "wide todo");
  if (p.note) html += item("Note from guest", p.note, "wide");
  if (p.rememberForNextTime) html += item("Return visits", "Guest asked us to remember these", "wide");
  return `<div class="prep-grid">${html}</div>`;
}

async function renderPrefs() {
  const now = Date.now();
  // Upcoming arrivals first (soonest at the top), then in-house, then stays that just ended.
  const stage = (r) => (Date.parse(r.checkIn) > now ? 0 : Date.parse(r.checkOut) > now ? 1 : 2);
  const rows = (await api.get("/api/preferences"))
    .sort((a, b) => stage(a) - stage(b) || Date.parse(a.checkIn) - Date.parse(b.checkIn));
  $("#prefCount").textContent = `(${rows.filter((r) => r.preferences).length}/${rows.length})`;
  const el = $("#prefs");
  el.innerHTML = "";
  for (const r of rows) {
    const st = prefStatus(r);
    const card = document.createElement("div");
    card.className = "prep-card";
    card.innerHTML = `
      <div class="prep-head">
        <span class="who">${esc(r.guest.firstName)} ${esc(r.guest.lastName)}</span>
        <span class="book">${esc(r.place)} · arrives ${fmt(r.checkIn)} · ${r.partySize} guest${r.partySize === 1 ? "" : "s"} · ${esc(r.reference)}</span>
        <span class="grow"></span>
        <span class="pill lang">${LANG_LABEL[r.guest.language]}</span>
        <span class="ppill ${st.cls}">${st.label}</span>
      </div>
      <div class="prep-status">${esc(st.text)}</div>
      <div class="profile">
        <span><b>Email</b> ${esc(r.guest.email)}</span>
        <span><b>Phone</b> ${esc(r.guest.phone)}</span>
        <span><b>From</b> ${esc([r.guest.city, r.guest.country].filter(Boolean).join(", "))}</span>
        <span><b>Language</b> ${esc(LANG_NAME[r.guest.language])}</span>
        <span><b>Stay</b> ${fmtDate(r.checkIn)} → ${fmtDate(r.checkOut)}</span>
        <span><b>Channels</b> ${esc(r.guest.preferredChannels.map((c) => CHANNEL_LABEL[c]).join(", "))}</span>
        <span>${r.guest.marketingConsent
          ? `<span class="consent-chip yes">Events: subscribed</span> <button class="consent-toggle" data-optout="${r.id}">Remove</button>`
          : `<span class="consent-chip no">Not subscribed to events</span> <button class="consent-toggle" data-optin="${r.id}">Guest replied — subscribe</button>`}</span>
      </div>
      ${prepGrid(r.preferences)}
      ${r.open ? `
      <div class="prep-actions">
        <a href="${escAttr(r.url)}" target="_blank" rel="noopener">Open guest page ↗</a>
        <button data-copy="${escAttr(r.url)}">Copy guest link</button>
      </div>` : ""}`;
    el.appendChild(card);
  }
  el.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); toast("Guest link copied"); }
    catch { toast(b.dataset.copy); }
  }));
  const setConsent = async (id, consent) => {
    await api.post(`/api/reservations/${id}/events-optin`, { consent });
    toast(consent ? "Subscribed — they'll receive event invitations" : "Removed from the events list");
    renderPrefs();
  };
  el.querySelectorAll("[data-optin]").forEach((b) => b.addEventListener("click", () => setConsent(b.dataset.optin, true)));
  el.querySelectorAll("[data-optout]").forEach((b) => b.addEventListener("click", () => setConsent(b.dataset.optout, false)));
}

// Refresh when coming back to the dashboard (e.g. after answering as a guest in another tab).
document.addEventListener("visibilitychange", () => {
  // Coming back from a guest page: refresh counts and lists, but never redraw a
  // template someone may be in the middle of editing.
  if (document.visibilityState !== "visible" || $("#app").classList.contains("hidden")) return;
  renderOverview(); renderPrefs(); renderTasks();
  const active = document.querySelector(".tabbtn.active")?.dataset.tab;
  if (active && active !== "emails") RENDER[active]();
});

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
      <button class="ghost" data-editev="${e.id}">Edit</button>
      <button class="ghost" data-del="${e.id}">Remove</button>
    </div>`).join("") : `<p class="empty">No upcoming events.</p>`;
  $("#events").querySelectorAll("[data-editev]").forEach((b) =>
    b.addEventListener("click", () => startEventEdit(events.find((x) => x.id === b.dataset.editev))));
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

/** "2026-12-05T20:30" in resort time, for the datetime-local input. */
function resortInputValue(iso) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: RESORT_TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
function startEventEdit(ev) {
  if (!ev) return;
  const f = $("#eventForm");
  const set = (n, v) => { f.elements[n].value = v ?? ""; };
  set("id", ev.id); set("titleEn", ev.title.en); set("titlePt", ev.title.pt); set("titleFr", ev.title.fr);
  set("descEn", ev.description.en); set("descPt", ev.description.pt); set("descFr", ev.description.fr);
  set("place", ev.place); set("audience", ev.audience); set("inviteLeadDays", ev.inviteLeadDays);
  set("start", resortInputValue(ev.start));
  $("#eventFormTitle").textContent = `Edit: ${ev.title.en}`;
  $("#eventSubmit").textContent = "Save changes";
  $("#eventCancelEdit").classList.remove("hidden");
  f.scrollIntoView({ behavior: "smooth", block: "start" });
}
function resetEventForm() {
  $("#eventForm").reset();
  $("#eventForm").elements.id.value = "";
  $("#eventFormTitle").textContent = "Add an event";
  $("#eventSubmit").textContent = "Add event";
  $("#eventCancelEdit").classList.add("hidden");
}
$("#eventCancelEdit").addEventListener("click", resetEventForm);
$("#eventForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const body = Object.fromEntries(f.entries());
  body.inviteLeadDays = Number(body.inviteLeadDays);
  const id = body.id; delete body.id;
  const res = await api.post(id ? `/api/events/${id}` : "/api/events", body);
  if (!res.ok) { toast(res.error || "Couldn't save event"); return; }
  resetEventForm();
  toast(id ? "Event updated — invites re-planned" : "Event added — invites planned");
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
      <div class="info"><b>${esc(a.name.en)}</b> · ${price(a)}${a.source !== "brochure" ? ` · <i>${esc(a.source)}</i>` : ""}
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
  renderTurndown();
}

// --- day-by-day suggestions / turndown cards ---
let tdDay = null;
async function renderTurndown() {
  const rows = await api.get("/api/turndown");
  const days = [...new Set(rows.map((r) => r.date))].sort();
  if (!days.includes(tdDay)) tdDay = days[0] ?? null;
  $("#tdDays").innerHTML = days.map((d) =>
    `<button class="chip ${d === tdDay ? "on" : ""}" data-td="${d}">${esc(resortDate(d + "T12:00:00Z"))}</button>`).join("");
  $("#tdDays").querySelectorAll("[data-td]").forEach((b) => b.addEventListener("click", () => { tdDay = b.dataset.td; renderTurndown(); }));
  const today = rows.filter((r) => r.date === tdDay);
  $("#tdCards").innerHTML = today.length ? today.map((r) => `
    <div class="td-card">
      <div class="who">${esc(r.guest)}</div>
      <div class="meta">${esc(r.place)} · card in ${esc(LANG_NAME[r.language])}${r.edited ? " · edited" : ""}</div>
      <textarea data-tdkey="${escAttr(r.key)}">${esc(r.card)}</textarea>
      <div class="why">Agent's pick: <b>${esc(r.activity)}</b> — ${esc(r.reason)}</div>
      <div class="row-btns"><button class="ghost" data-tdsave="${escAttr(r.key)}">Save wording</button>${r.edited ? `<button class="ghost" data-tdreset="${escAttr(r.key)}">Back to suggestion</button>` : ""}</div>
    </div>`).join("") : `<p class="empty">No guests staying in the next days.</p>`;
  $("#tdCards").querySelectorAll("[data-tdsave]").forEach((b) => b.addEventListener("click", async () => {
    const card = $("#tdCards").querySelector(`[data-tdkey="${CSS.escape(b.dataset.tdsave)}"]`).value;
    await api.post(`/api/turndown/${encodeURIComponent(b.dataset.tdsave)}`, { card });
    toast("Card wording saved"); renderTurndown();
  }));
  $("#tdCards").querySelectorAll("[data-tdreset]").forEach((b) => b.addEventListener("click", async () => {
    await api.post(`/api/turndown/${encodeURIComponent(b.dataset.tdreset)}`, { reset: true });
    renderTurndown();
  }));
  $("#printCards").innerHTML = today.map((r) =>
    `<div class="print-card"><h2>${esc(r.firstName)}</h2><p>${esc(r.card)}</p><p style="font-size:13px;margin-top:30px">Vale Palheiro</p></div>`).join("");
}
$("#tdPrint").addEventListener("click", () => window.print());

const CONDS = ["sunny", "cloudy", "showers", "rainy", "windy", "calm", "big_sea", "surf_sea", "flat_sea", "warm"];
function condPick(sel, name) {
  $(sel).innerHTML = CONDS.map((c) => `<label class="check"><input type="checkbox" name="${name}" value="${c}" /> ${COND_LABEL[c]}</label>`).join("");
}
condPick("#actGood", "goodIn"); condPick("#actNot", "notIn");
$("#actForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const res = await api.post("/api/activities", {
    name: f.get("name"), pitch: f.get("pitch"), category: f.get("category"), priceFrom: f.get("priceFrom"),
    goodIn: f.getAll("goodIn"), notIn: f.getAll("notIn"), family: f.get("family") === "on", indoor: f.get("indoor") === "on",
  });
  if (!res.ok) { toast(res.error || "Couldn't add it"); return; }
  e.target.reset();
  toast("Experience added — the agent can now suggest it");
  renderWeather();
});

// --- property ---
async function renderProperty() {
  const [info, groups] = await Promise.all([api.get("/api/property"), api.get("/api/property/groups")]);
  $("#propFields").innerHTML = Object.entries(groups).map(([g, title]) => {
    const fields = Object.entries(info).filter(([, f]) => f.group === g);
    return `<div class="settings-group">${esc(title)}</div>` + fields.map(([k, f]) => `
    <div class="${f.long ? "full" : ""}">
      <div class="field-lbl">${esc(f.label)} ${f.sample ? `<span class="badge">sample</span>` : ""}</div>
      ${f.long
        ? `<textarea name="${k}" rows="3" class="${f.sample ? "sample" : ""}">${esc(f.value)}</textarea>`
        : `<input name="${k}" value="${escAttr(f.value)}" class="${f.sample ? "sample" : ""}" />`}
      ${f.help ? `<div class="field-help">${esc(f.help)}</div>` : ""}
    </div>`).join("");
  }).join("");
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
const CHANNEL_KINDS = [
  ["pre_arrival", "3 days before arrival"], ["arrival_day", "Arrival day"], ["in_stay", "Welcome, after check-in"],
  ["morning", "Good morning, each day of the stay"],
  ["post_stay", "Thank you, after check-out"], ["event_invite", "Event invitations"],
];

async function loadConfig() {
  const [cfg, integ] = await Promise.all([api.get("/api/config"), api.get("/api/integrations")]);
  for (const k of NUM_KEYS) $(`#c_${k}`).value = cfg[k];
  $("#c_approvalPolicy").value = cfg.approvalPolicy;
  $("#channelGrid").innerHTML = CHANNEL_KINDS.map(([k, l]) => `
    <div><div class="field-lbl">${l}</div>
      <select data-channel="${k}">
        ${[["email", "Email"], ["whatsapp", "WhatsApp"], ["both", "Email + WhatsApp"], ["off", "Off"]].map(([v, t]) =>
          `<option value="${v}" ${cfg.channels[k] === v ? "selected" : ""}>${t}</option>`).join("")}
      </select></div>`).join("");
  $("#integrations").innerHTML = integ.map((i) => `
    <div class="integ"><b>${esc(i.name)}</b><span class="st ${i.status}">${esc(i.status)}</span><span class="d">${esc(i.detail)}</span></div>`).join("");
}

$("#applyConfig").addEventListener("click", async () => {
  const body = {};
  for (const k of NUM_KEYS) body[k] = Number($(`#c_${k}`).value);
  body.channels = Object.fromEntries([...document.querySelectorAll("[data-channel]")].map((s) => [s.dataset.channel, s.value]));
  body.approvalPolicy = $("#c_approvalPolicy").value;
  await api.post("/api/config", body);
  toast("Settings saved — schedule updated");
  renderOverview();
});

function refreshAll() {
  renderOverview(); renderPrefs(); renderTasks();
  const active = document.querySelector(".tabbtn.active")?.dataset.tab ?? "emails";
  if (active === "emails") renderEmails(); else { renderEmails(); RENDER[active](); }
  api.get("/api/messages").then((all) => { $("#msgCount").textContent = `(${all.length})`; });
}

// --- boot ---
(async () => {
  const s = await api.get("/api/session");
  if (s.authed) showApp(); else showLogin();
})();
