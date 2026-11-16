// ---------- DRAFT: keep the unfinished form if the person closes it ----------
// Saved only in THIS phone/browser (never sent anywhere). Files cannot be saved. Cleared after submitting.
const DRAFT_PREFIX = "brgyDraft:", DRAFT_DAYS = 7;
function draftKey(t) { return DRAFT_PREFIX + (t || $("documentType").value); }
let draftTimer = null;

function saveDraft() {
    try {
        if ($("formModal").classList.contains("hidden")) return;
        const data = {};
        activeForm().querySelectorAll("input, select, textarea").forEach((el) => {
            if (!el.name || el.type === "file" || el.type === "password") return;
            if (el.type === "checkbox") { (data[el.name] = data[el.name] || []); if (el.checked) data[el.name].push(el.value); }
            else if (el.type === "radio") { if (el.checked) data[el.name] = el.value; }
            else data[el.name] = el.value;
        });
        localStorage.setItem(draftKey(), JSON.stringify({ t: Date.now(), data }));
    } catch (e) {}
}
function clearDraft(t) { try { localStorage.removeItem(draftKey(t)); } catch (e) {} }
function restoreDraft() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(draftKey()) || "null"); } catch (e) {}
    $("draftNote").classList.add("hidden");
    if (!saved || !saved.data || Date.now() - saved.t > DRAFT_DAYS * 864e5) return false;
    const d = saved.data, form = activeForm();
    form.querySelectorAll("input, select, textarea").forEach((el) => {
        if (!el.name || el.type === "file" || el.type === "password" || !(el.name in d)) return;
        if (el.type === "checkbox") el.checked = (d[el.name] || []).indexOf(el.value) >= 0;
        else if (el.type === "radio") el.checked = d[el.name] === el.value;
        else if (el.id !== "bizCategory" && el.id !== "pkCategory") el.value = d[el.name];
    });
    if (form.id === "bizForm") {
        updateBizCategories();
        if (d.bizCategory) $("bizCategory").value = d.bizCategory;
        updateRequirements();
    } else if (form.id === "pkForm") {
        updatePkCategories();
        if (d.pkCategory) $("pkCategory").value = d.pkCategory;
    }
    $("draftNote").classList.remove("hidden");
    return true;
}
function startOverDraft() { const t = $("documentType").value; clearDraft(t); openApplicationForm(t); }
function queueDraftSave(e) {
    const f = e.target && e.target.closest && e.target.closest("#bizForm, #pkForm, #clrForm");
    if (!f) return;
    clearTimeout(draftTimer); draftTimer = setTimeout(saveDraft, 400);
}
document.addEventListener("input", queueDraftSave);
document.addEventListener("change", queueDraftSave);

// Show NEW or RENEWAL requirement checklist (Business Permit form only)
function updateRequirements() {
    const checked = document.querySelector('#bizForm input[name="appType"]:checked');
    const isRenewal = !!(checked && checked.value === "Renewal");
    const show = { reqNew: !isRenewal, reqRenewal: isRenewal };
    Object.keys(show).forEach((id) => {
        $(id).classList.toggle("hidden", !show[id]);
        // Hidden list's inputs are disabled so they are not required / not validated
        $(id).querySelectorAll("input").forEach((i) => (i.disabled = !show[id]));
    });
}

// ---------- PANGKABUHAYAN: same picker as the Business Permit (group -> kind of business), but FREE ----------
function updatePkCategories() {
    const code = $("pkGroup").value, g = BUSINESS_GROUPS[code];
    const sel = $("pkCategory"), box = $("pkCategoryBox"), nd = $("pkNatureDetail");
    const special = code === "NC" || code === "REG";
    box.classList.toggle("hidden", special);
    sel.required = !!g && !special;
    sel.innerHTML = "";
    const first = document.createElement("option");
    first.value = ""; first.textContent = g && !special ? "-- Choose your kind of business --" : "-- Choose a group first --";
    sel.appendChild(first);
    if (g && !special) g.items.forEach((name) => { const o = document.createElement("option"); o.value = name; o.textContent = name; sel.appendChild(o); });
    nd.required = special;
    $("pkNatureHint").textContent = special ? "(required)" : "(optional)";
    $("pkRegNote").classList.toggle("hidden", code !== "REG");
}
function renderPkGuide(filter) {
    const q = (filter || "").trim().toLowerCase();
    let html = "", found = 0;
    ["A", "B", "C", "D", "E"].forEach((code) => {
        const g = BUSINESS_GROUPS[code];
        const items = g.items.filter((n) => !q || n.toLowerCase().indexOf(q) >= 0);
        if (!items.length) return;
        found += items.length;
        html += '<div class="guide-group"><div class="guide-head"><b>' + g.label + "</b></div>" +
            items.map((n) => '<button type="button" class="guide-item pkg" data-code="' + code + '" data-name="' + escapeHtml(n) + '">' + escapeHtml(n) + "</button>").join("") + "</div>";
    });
    [["NC", "Business not otherwise categorized"], ["REG", "Regulated business (resolution required)"]].forEach((x) => {
        if (q && x[1].toLowerCase().indexOf(q) < 0 && "other".indexOf(q) < 0) return;
        found++;
        html += '<div class="guide-group"><button type="button" class="guide-item pkg" data-code="' + x[0] + '" data-name="">' + x[1] + "</button></div>";
    });
    $("pkGuideList").innerHTML = html || '<p class="muted">No match. Try another word, or choose "Business not otherwise categorized".</p>';
}
document.addEventListener("input", (e) => { if (e.target && e.target.id === "pkGuideSearch") renderPkGuide(e.target.value); });
document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest(".guide-item.pkg");
    if (!b) return;
    $("pkGroup").value = b.dataset.code;
    updatePkCategories();
    if (b.dataset.name) $("pkCategory").value = b.dataset.name;
    $("pkGuide").open = false;
    queueDraftSave({ target: $("pkGroup") });
    $("pkGroup").scrollIntoView({ behavior: "smooth", block: "center" });
});