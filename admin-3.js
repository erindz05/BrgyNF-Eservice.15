async function restoreAdminSession() {
    if (!db) return;
    try {
        const { data } = await db.auth.getSession();
        if (data && data.session) {
            const role = await api.role();
            if (role) unlockAdminUI(role, data.session.user.email);
            else await db.auth.signOut();
        }
    } catch (e) { console.error(e); }
}

async function authenticateAdmin() {
    const email = $("adminEmailInput").value.trim();
    const password = $("adminPasswordInput").value;
    const fb = $("authFeedback");
    let role = null, message = "";
    if (db) {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) message = error.message;
        else {
            role = await api.role();   // logged in is not enough: must be listed in "admins"
            if (!role) { await db.auth.signOut(); message = "This account is not an authorized barangay staff member."; }
        }
    } else {
        // Demo mode only (no Supabase keys set)
        if (DEMO_USERS[email] && password === "demo1234") role = DEMO_USERS[email];
        else message = "Demo mode: use demo@brgy.local, secretary@brgy.local or treasurer@brgy.local with password demo1234";
    }
    if (!role) { fb.innerHTML = '<div class="alert-danger">❌ ' + escapeHtml("Error: " + (message)) + "</div>"; return; }
    $("adminPasswordInput").value = "";
    unlockAdminUI(role, email);
}

// Signs out AND wipes every confidential detail from the screen
async function logoutAdmin() {
    try { if (db) await db.auth.signOut(); } catch (e) { console.error(e); }
    $("adminCoreControls").classList.add("hidden");
    $("adminAuthForm").classList.remove("hidden");
    ["searchFeedback", "adminDetails", "adminList", "adminPager", "dashBox", "trashList", "auditList", "authFeedback", "printable-clearance"]
        .forEach((id) => { $(id).innerHTML = ""; });
    $("certPanel").classList.add("hidden");
    $("certNote").classList.add("hidden");
    ["adminPasswordInput", "fQ", "fFrom", "fTo", "auditFilter"].forEach((id) => { $(id).value = ""; });
    ["fType", "fStage", "fPay"].forEach((id) => { $(id).value = ""; });
    currentCert = null; curRow = null; curPage = 0;
    staff = { role: null, email: "" };
    closeConfirm(); closeReject();
}

// ---------- tabs ----------
function showTab(name) {
    document.querySelectorAll("#adminTabs .tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
    ["dashboard", "apps", "trash", "audit", "settings"].forEach((n) => $("tab-" + n).classList.toggle("hidden", n !== name));
    if (name === "dashboard") loadDashboard();
    if (name === "apps" && !$("adminList").innerHTML) runSearch(true);
    if (name === "trash") loadTrash();
    if (name === "audit") loadAudit();
    if (name === "settings") checkPictures();
}

// ---------- DASHBOARD ----------
const STAGE_COLOR = { submitted: "#5b9bd5", under_review: "#e0a800", approved: "#5aa469", ready: "#1f8a5b", released: "#1b4d3e", rejected: "#c0392b" };
let dashData = null, dashChart = "collected";

function shortPeso(c) {
    const p = c / 100;
    return p >= 1000 ? "₱" + (Math.round(p / 100) / 10) + "k" : "₱" + Math.round(p);
}
function chartHtml(months, key) {
    const money = key === "collected";
    const max = Math.max(1, ...months.map((m) => m[key]));
    return '<div class="chart">' + months.map((m, i) => {
        const label = new Date(m.month + "-01T00:00:00").toLocaleString("en", { month: "short" });
        const h = Math.max(3, Math.round((m[key] / max) * 100));
        const last = i === months.length - 1;
        return '<div class="col' + (last ? " now" : "") + '"><div class="bar-val">' + (m[key] ? (money ? shortPeso(m[key]) : m[key]) : "") + '</div><div class="bar-track"><div class="bar" style="height:' + h + '%"></div></div><div class="bar-label">' + escapeHtml(label) + "</div></div>";
    }).join("") + "</div>";
}
function kpi(num, label, tone) {
    return '<div class="kpi ' + (tone || "") + '"><div class="kpi-num">' + num + '</div><div class="kpi-lbl">' + escapeHtml(label) + "</div></div>";
}
function renderDashboard() {
    const s = dashData, box = $("dashBox");
    const months = s.months || [];
    const stageKeys = Object.keys(STAGE_LABEL);
    const counts = stageKeys.map((k) => (s.by_stage && s.by_stage[k]) || 0);
    const totalStages = counts.reduce((a, b) => a + b, 0);
    const seg = totalStages
        ? stageKeys.map((k, i) => counts[i] ? '<span style="flex:' + counts[i] + ';background:' + STAGE_COLOR[k] + '" title="' + escapeHtml(STAGE_LABEL[k]) + ": " + counts[i] + '"></span>' : "").join("")
        : '<span style="flex:1;background:var(--border-color)"></span>';
    const legend = stageKeys.map((k, i) =>
        '<li><i style="background:' + STAGE_COLOR[k] + '"></i>' + escapeHtml(STAGE_LABEL[k]) + "<b>" + counts[i] + "</b></li>").join("");
    box.innerHTML =
        '<div class="dash-hero">' +
            '<div class="dash-hero-lbl">Collected this month</div>' +
            '<div class="dash-hero-num">' + peso(s.collected_month) + "</div>" +
            '<div class="dash-hero-sub"><span>Today <b>' + peso(s.collected_today) + "</b></span><span>This year <b>" + peso(s.collected_year) + "</b></span></div>" +
        "</div>" +
        '<div class="kpi-row">' +
            kpi(s.today, "New today") + kpi(s.this_month, "This month") + kpi(s.unpaid, "Waiting for payment", s.unpaid ? "warn" : "") +
        "</div>" +
        '<div class="dash-card"><div class="dash-card-h">Where the applications are</div>' +
            '<div class="stack">' + seg + "</div>" + '<ul class="legend">' + legend + "</ul></div>" +
        '<div class="dash-card"><div class="dash-card-h">Last 6 months' +
            '<span class="seg-toggle"><button type="button" data-chart="collected" class="' + (dashChart === "collected" ? "on" : "") + '">Money</button>' +
            '<button type="button" data-chart="applications" class="' + (dashChart === "applications" ? "on" : "") + '">Applications</button></span></div>' +
            chartHtml(months, dashChart) + "</div>" +
        '<details class="dash-card"><summary>All-time totals</summary><div class="kpi-row two">' +
            kpi(s.total, "All applications") + kpi(peso(s.collected_total), "Collected in total") +
            kpi(s.paid, "Paid") + kpi(s.this_year, "Applications this year") + "</div></details>";
}
async function loadDashboard() {
    const box = $("dashBox");
    try {
        dashData = await api.stats();
        renderDashboard();
    } catch (err) {
        box.innerHTML = errMsg("Could not load the dashboard: " + errText(err) + (db ? " — did you run supabase_setup_ALL.sql?" : ""));
    }
}
document.addEventListener("click", (ev) => {
    const b = ev.target.closest && ev.target.closest("#dashBox [data-chart]");
    if (b && dashData) { dashChart = b.getAttribute("data-chart"); renderDashboard(); }
});