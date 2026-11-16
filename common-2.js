// Price of an application. Returns centavos, or null if the business group is not chosen yet.
const isBizType = (t) => t === "Business Permit" || t === "Pangkabuhayan";
function feeFor(docType, details) {
    details = details || {};
    if (docType === "Pangkabuhayan") return 0;                        // always free
    if (docType === "Business Permit") {
        const g = BUSINESS_GROUPS[details["Group Code"]];
        return g ? g.amount : null;
    }
    const purposes = String(details["Purpose"] || "").split(",").map((x) => x.trim()).filter(Boolean);
    if (!purposes.length) return null;                                   // no purpose ticked yet
    const paid = purposes.filter((p) => FREE_PURPOSES.indexOf(p) < 0);
    if (!paid.length) return 0;                                          // only Indigency / Medical / Financial
    return Math.max.apply(null, paid.map((p) => (CLEARANCE_FEES[p] != null ? CLEARANCE_FEES[p] : CLEARANCE_FEE)));
}

// --- HELPERS ------------------------------------------
const $ = (id) => document.getElementById(id);
const MAX_FILE_MB = 5;

function todayISO() {
    return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
}
function peso(centavos) {
    return "₱" + (centavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 });
}
function longDate(iso) {
    const d = iso ? new Date(iso) : new Date();
    return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}
function fullName(first, middle, last) {
    return [first, middle, last].map((s) => (s || "").trim()).filter(Boolean).join(" ");
}
function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
}
// --- DATABASE LAYER (applicant side) -------------------
function demoList() {
    try { return JSON.parse(localStorage.getItem("demoClearances") || "[]"); } catch (e) { return []; }
}
function demoSave(list) {
    try { localStorage.setItem("demoClearances", JSON.stringify(list)); } catch (e) {}
}
// --- PICTURES, WEBSITE QR CODE, START-UP --------------
function applyImages() {
    const logo = $("navLogo");
    if (logo && IMAGES.logo) {
        logo.onerror = function () { console.warn("Logo not found: '" + String(IMAGES.logo).slice(0, 60) + "'"); logo.style.display = "none"; };
        logo.onload = function () { logo.style.display = ""; };
        logo.src = IMAGES.logo;
    } else if (logo) {
        logo.style.display = "none";
    }
    if (IMAGES.banner && $("heroBanner")) {
        const hero = $("heroBanner");
        const probe = new Image();
        probe.onload = function () {
            hero.style.backgroundImage = 'linear-gradient(135deg, rgba(27,77,62,0.88), rgba(244,196,48,0.35)), url("' + IMAGES.banner + '")';
            hero.style.backgroundSize = "cover";
            hero.style.backgroundPosition = "center";
        };
        probe.onerror = function () { console.warn("Banner not found: '" + String(IMAGES.banner).slice(0, 60) + "'"); };
        probe.src = IMAGES.banner;
    }
}

// The portal QR code now lives ONLY in the staff site (Settings tab), not on the public website.
function applicantUrl() {
    if (typeof SITE_URL !== "undefined" && SITE_URL) return SITE_URL;
    let u = location.href.split("?")[0].split("#")[0];
    u = u.replace(/admin(\/index)?\.html$/i, "").replace(/admin\/(index\.html)?$/i, "");
    return u;
}
window.applicantUrl = applicantUrl;

window.addEventListener("DOMContentLoaded", () => {
    let saved = null;
    try { saved = localStorage.getItem("siteTheme"); } catch (e) {}
    if (saved === "dark") {
        document.body.classList.add("dark-mode");
        if ($("themeToggleBtn")) $("themeToggleBtn").innerHTML = "☀️<br>Mode";
    }
    applyImages();
});
window.toggleTheme = toggleTheme;