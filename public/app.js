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
  setTimeout(() => t.classList.remove("show"), 2600);
}

function showLogin() {
  $("#login").classList.remove("hidden");
  $("#app").classList.add("hidden");
}
function showApp() {
  $("#login").classList.add("hidden");
  $("#app").classList.remove("hidden");
  refreshAll();
}

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

$("#logoutBtn").addEventListener("click", async () => {
  await api.post("/api/logout");
  showLogin();
});

// --- tabs ---
document.querySelectorAll(".tabbtn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tabbtn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    $("#tab-messages").classList.toggle("hidden", tab !== "messages");
    $("#tab-log").classList.toggle("hidden", tab !== "log");
    if (tab === "log") renderLog();
  });
});

// --- config ---
$("#applyConfig").addEventListener("click", async () => {
  const cfg = await api.post("/api/config", {
    preStayHoursBefore: Number($("#preHours").value),
    postStayHoursAfter: Number($("#postHours").value),
    channelStrategy: $("#channelStrategy").value,
  });
  toast("Schedule updated");
  renderMessages();
});

// --- simulate ---
$("#simBtn").addEventListener("click", async () => {
  const hrs = Number($("#simSelect").value);
  const res = await api.post("/api/simulate", { atHoursFromNow: hrs });
  toast(res.sentCount > 0
    ? `Scheduler ran — ${res.sentCount} message(s) delivered`
    : "Scheduler ran — nothing due yet");
  renderMessages();
  renderLog();
});

// --- rendering ---
function fmt(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}
function relative(iso) {
  const diff = Date.parse(iso) - Date.now();
  const h = Math.round(diff / 3600000);
  if (Math.abs(h) < 1) return "within the hour";
  if (h > 0 && h < 48) return `in ${h}h`;
  if (h < 0 && h > -48) return `${-h}h ago`;
  const d = Math.round(h / 24);
  return d > 0 ? `in ${d}d` : `${-d}d ago`;
}

const KIND_LABEL = { pre_stay: "Pre-stay", post_stay: "Post-stay" };

async function renderMessages() {
  const msgs = await api.get("/api/messages");
  const el = $("#messages");
  el.innerHTML = "";
  for (const m of msgs) {
    const card = document.createElement("div");
    card.className = "msg-card";
    const kindClass = m.kind === "pre_stay" ? "pre" : "post";
    card.innerHTML = `
      <div class="msg-head">
        <span class="who">${m.guest?.firstName ?? ""} ${m.guest?.lastName ?? ""}</span>
        <span class="muted sans" style="font-size:12px">${m.villa ?? ""} · ${m.reference ?? ""}</span>
        <span class="pill ${kindClass}">${KIND_LABEL[m.kind]}</span>
        <span class="pill ${m.channel}">${m.channel}</span>
        <span class="pill lang">${m.language}</span>
        <span class="spacer"></span>
        <span class="pill ${m.status}">${m.status}</span>
      </div>
      <div class="msg-body">
        ${m.subject ? `<div class="msg-subject">${escapeHtml(m.subject)}</div>` : ""}
        <div class="msg-text">${escapeHtml(m.body)}</div>
        <div class="msg-meta">
          <span>Send ${relative(m.sendAt)} · ${fmt(m.sendAt)}</span>
          <span>Copy by: ${m.generatedBy === "llm" ? "AI model" : "brand template"}</span>
          ${m.sentAt ? `<span>Delivered ${fmt(m.sentAt)}</span>` : ""}
        </div>
      </div>
      ${m.status === "scheduled" ? `
      <div class="msg-actions">
        <button class="ghost" data-edit="${m.id}">Edit wording</button>
        <button class="ghost" data-cancel="${m.id}">Cancel</button>
      </div>` : ""}
    `;
    el.appendChild(card);
  }

  el.querySelectorAll("[data-edit]").forEach((b) =>
    b.addEventListener("click", () => openEditor(b.dataset.edit, msgs)));
  el.querySelectorAll("[data-cancel]").forEach((b) =>
    b.addEventListener("click", async () => {
      await api.post(`/api/messages/${b.dataset.cancel}/cancel`);
      toast("Message cancelled");
      renderMessages();
    }));
}

function openEditor(id, msgs) {
  const m = msgs.find((x) => x.id === id);
  if (!m) return;
  const card = [...document.querySelectorAll(".msg-card")]
    .find((c) => c.querySelector(`[data-edit="${id}"]`));
  const body = card.querySelector(".msg-body");
  body.innerHTML = `
    ${m.subject !== undefined ? `<input id="editSubject" value="${escapeAttr(m.subject ?? "")}" />` : ""}
    <textarea id="editBody">${escapeHtml(m.body)}</textarea>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="primary" id="saveEdit">Save</button>
      <button class="ghost" id="cancelEdit">Discard</button>
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

async function renderLog() {
  const log = await api.get("/api/sent-log");
  const el = $("#log");
  if (!log.length) {
    el.innerHTML = `<p class="muted">Nothing delivered yet. Use “Run scheduler” to send what’s due.</p>`;
    return;
  }
  el.innerHTML = "";
  for (const item of log) {
    const d = document.createElement("div");
    d.className = "log-item";
    d.innerHTML = `
      <div class="top">
        <span class="pill ${item.channel}">${item.channel}</span>
        <b>${escapeHtml(item.guestName)}</b>
        <span class="muted sans">${escapeHtml(item.villa)} · ${item.to}</span>
        <span class="spacer"></span>
        <span class="muted sans" style="font-size:12px">${fmt(item.at)}</span>
      </div>
      ${item.subject ? `<div><b>${escapeHtml(item.subject)}</b></div>` : ""}
      <div class="msg-text" style="font-size:13px">${escapeHtml(item.body)}</div>
    `;
    el.appendChild(d);
  }
}

async function loadConfig() {
  const cfg = await api.get("/api/config");
  $("#preHours").value = cfg.preStayHoursBefore;
  $("#postHours").value = cfg.postStayHoursAfter;
  $("#channelStrategy").value = cfg.channelStrategy;
}

function refreshAll() {
  loadConfig();
  renderMessages();
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function escapeAttr(s) {
  return escapeHtml(s).replaceAll('"', "&quot;");
}

// --- boot ---
(async () => {
  const s = await api.get("/api/session");
  if (s.authed) showApp(); else showLogin();
})();
