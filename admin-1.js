/* jshint esversion: 11, browser: true, devel: true, asi: true, laxbreak: true, undef: false, unused: false */
// ADMIN SITE (admin.html): staff login, dashboard, applications, requirements viewer, certificates.
// =====================================================
//  ADMINISTRATOR AREA  (roles: admin / secretary / treasurer)
// =====================================================
const STAGE_LABEL = {
    submitted: "Submitted", under_review: "Under review", approved: "Approved",
    ready: "Ready for pickup", released: "Released", rejected: "Rejected"
};
const NEXT_STAGES = {
    submitted: ["under_review", "rejected"],
    under_review: ["approved", "rejected"],
    approved: ["ready", "rejected"],
    ready: ["released"],
    released: [],
    rejected: ["submitted"]
};
const STAGE_BTN = {
    under_review: ["Start review", "plain"], approved: ["Approve", "ok"], rejected: ["Reject…", "danger"],
    ready: ["Mark ready for pickup", "ok"], released: ["Mark as released", "ok"], submitted: ["Reopen", "plain"]
};
const ACTION_LABEL = {
    mark_paid: "Marked as paid", stage_under_review: "Started review", stage_approved: "Approved",
    stage_ready: "Marked ready for pickup", stage_released: "Marked as released", stage_rejected: "Rejected",
    stage_submitted: "Reopened", "delete": "Moved to Trash", restore: "Restored from Trash", purge: "Deleted forever",
    fees_changed: "Changed fees", print: "Printed certificate", export_pdf: "Exported PDF", export_csv: "Exported CSV", login: "Signed in"
};
const ROLE_LABEL = { admin: "Administrator", secretary: "Secretary", treasurer: "Treasurer" };
const DEMO_USERS = { "demo@brgy.local": "admin", "secretary@brgy.local": "secretary", "treasurer@brgy.local": "treasurer" };
const PAGE_SIZE = 15;

let staff = { role: null, email: "" };
let curRow = null;       // record open in the details panel
let curPage = 0;
let confirmRun = null;
let rejectSerial = null;

const can = {
    review: () => staff.role === "admin" || staff.role === "secretary",
    pay: () => staff.role === "admin" || staff.role === "treasurer",
    admin: () => staff.role === "admin",
    print: () => staff.role === "admin" || staff.role === "secretary",
    csv: () => staff.role === "admin" || staff.role === "treasurer"
};

// ---------- small helpers ----------
function fmtDate(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric" });
}
function fmtDateTime(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function stageBadge(stage) { return '<span class="badge ' + escapeHtml(stage) + '">' + escapeHtml(STAGE_LABEL[stage] || stage) + "</span>"; }
function payBadge(status, amount) {
    if (status === "paid") return amount === 0 ? '<span class="badge paid">Free</span>' : '<span class="badge paid">Paid</span>';
    return '<span class="badge unpaid">Unpaid</span>';
}
function rowAmount(r) {
    if (r.amount_centavos != null) return r.amount_centavos;
    return r.status === "paid" ? (fees[r.document_type] || 0) : null;
}
function errText(e) { return (e && (e.message || e.details)) || String(e); }
function feedback(html) { $("searchFeedback").innerHTML = html || ""; }
function okMsg(msg) { return '<div class="alert-success">' + escapeHtml(msg) + "</div>"; }
function errMsg(msg) { return '<div class="alert-danger">' + escapeHtml(msg) + "</div>"; }

// ---------- demo-mode storage (only used when no Supabase keys are set) ----------
function demoAuditList() { try { return JSON.parse(localStorage.getItem("demoAudit") || "[]"); } catch (e) { return []; } }
function demoAudit(action, serial, detail) {
    const l = demoAuditList();
    l.push({ at: new Date().toISOString(), actor_email: staff.email, actor_role: staff.role, action, serial: serial || null, detail: detail || {} });
    try { localStorage.setItem("demoAudit", JSON.stringify(l.slice(-500))); } catch (e) {}
}
function demoFind(list, serial) { return list.find((r) => r.serial === serial); }
function demoMatches(r, f) {
    if (f.trash ? !r.deleted_at : r.deleted_at) return false;
    if (f.q) {
        const q = f.q.toLowerCase();
        if (!(String(r.serial).toLowerCase().includes(q) || String(r.name || "").toLowerCase().includes(q))) return false;
    }
    if (f.type && r.document_type !== f.type) return false;
    if (f.stage && (r.stage || "submitted") !== f.stage) return false;
    if (f.pay === "paid" && r.status !== "paid") return false;
    if (f.pay === "unpaid" && r.status === "paid") return false;
    const day = (r.created_at || "").slice(0, 10);
    if (f.from && day < f.from) return false;
    if (f.to && day > f.to) return false;
    return true;
}
function demoStats() {
    const list = demoList().filter((r) => !r.deleted_at);
    const now = new Date();
    const key = (d) => d.toLocaleDateString("en-CA");
    const today = key(now), month = today.slice(0, 7), year = today.slice(0, 4);
    const day = (r) => (r.created_at || "").slice(0, 10);
    const paidDay = (r) => (r.issued_at || r.created_at || "").slice(0, 10);
    const amt = (r) => (r.amount_centavos != null ? r.amount_centavos : (fees[r.document_type] || 0));
    const paid = list.filter((r) => r.status === "paid");
    const sum = (a) => a.reduce((s, r) => s + amt(r), 0);
    const by_stage = {}, by_type = {};
    list.forEach((r) => { const s = r.stage || "submitted"; by_stage[s] = (by_stage[s] || 0) + 1; by_type[r.document_type] = (by_type[r.document_type] || 0) + 1; });
    const months = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const m = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
        months.push({ month: m, applications: list.filter((r) => day(r).slice(0, 7) === m).length, collected: sum(paid.filter((r) => paidDay(r).slice(0, 7) === m)) });
    }
    return {
        total: list.length,
        today: list.filter((r) => day(r) === today).length,
        this_month: list.filter((r) => day(r).slice(0, 7) === month).length,
        this_year: list.filter((r) => day(r).slice(0, 4) === year).length,
        unpaid: list.filter((r) => r.status !== "paid" && (r.stage || "submitted") !== "rejected").length,
        paid: paid.length,
        collected_today: sum(paid.filter((r) => paidDay(r) === today)),
        collected_month: sum(paid.filter((r) => paidDay(r).slice(0, 7) === month)),
        collected_year: sum(paid.filter((r) => paidDay(r).slice(0, 4) === year)),
        collected_total: sum(paid),
        by_stage, by_type, months
    };
}