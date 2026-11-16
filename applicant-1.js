/* jshint esversion: 11, browser: true, devel: true, asi: true, laxbreak: true, undef: false, unused: false */
// APPLICANT SITE (index.html): home screen + application forms. No staff code and no personal data is ever shown here.
function showFormError(msg) {
    const box = $("formError");
    if (!msg) { box.classList.add("hidden"); box.textContent = ""; return; }
    box.textContent = msg;
    box.classList.remove("hidden");
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
// --- MODAL CONTROLS (APPLICATION FORMS) ---------------
const FORM_OF = { "Business Permit": "bizForm", "Pangkabuhayan": "pkForm", "Barangay Clearance": "clrForm" };
function activeForm() {
    return $(FORM_OF[$("documentType").value] || "bizForm");
}

function openApplicationForm(docType) {
    $("documentType").value = docType;
    setFormTitle();
    $("confirmCard").classList.add("hidden");
    showFormError("");

    // Show ONLY the form of the chosen service (each service has its own form)
    Object.keys(FORM_OF).forEach((t) => {
        const f = $(FORM_OF[t]);
        f.reset();
        f.querySelectorAll(".touched").forEach((el) => el.classList.remove("touched"));
        f.classList.toggle("hidden", t !== docType);
    });
    renderClearanceFees();

    $("bizDate").value = todayISO();
    if (docType === "Business Permit") {
        updateBizCategories();
        updateRequirements();
        $("guideSearch").value = ""; renderGuide("");
    } else if (docType === "Pangkabuhayan") {
        updatePkCategories();
        $("pkGuideSearch").value = ""; renderPkGuide("");
    }
    restoreDraft();

    $("submitBtn").disabled = false;
    setSubmitLabel();
    $("formModal").classList.remove("hidden");
    document.body.style.overflow = "hidden";
    $("formModal").querySelector(".modal-body").scrollTop = 0;
}

function setFormTitle() {
    const docType = $("documentType").value;
    if (docType) $("modalFormTitle").innerText = "Apply for " + (DOCUMENT_LABELS[docType] || docType);
}

function setSubmitLabel() {
    const docType = $("documentType").value;
    if (!docType) return;
    const form = activeForm();
    const fd = new FormData(form);
    const amount = feeFor(docType, docType === "Business Permit"
        ? { "Group Code": ($("bizGroup") || {}).value }
        : { "Purpose": fd.getAll("purpose").join(", ") });
    let text;
    if (amount === null) text = docType === "Business Permit" ? "Submit Application (choose your business group)" : "Submit Application (tick a purpose)";
    else if (amount === 0) text = "Submit Application (FREE)";
    else text = (db && ENABLE_ONLINE_PAYMENT ? "Submit & Pay Online (" : "Submit Application (Fee ") + peso(amount) + ")";
    $("submitBtn").innerText = text;
}

// Show the fee next to each clearance purpose
function renderClearanceFees() {
    document.querySelectorAll(".fee-tag").forEach((el) => {
        const p = el.dataset.purpose;
        el.textContent = FREE_PURPOSES.indexOf(p) >= 0 ? "- FREE" : (CLEARANCE_FEES[p] != null ? "- " + peso(CLEARANCE_FEES[p]) : "");
    });
}

// Business group -> list of businesses in that group
function updateBizCategories() {
    const pk = false;
    const code = $("bizGroup").value, g = BUSINESS_GROUPS[code];
    const sel = $("bizCategory"), box = $("bizCategoryBox"), nd = $("natureDetail");
    const special = pk || code === "NC" || code === "REG";
    $("bizGroupBox").classList.toggle("hidden", pk);
    $("bizGroup").required = !pk;
    box.classList.toggle("hidden", special);
    sel.required = !!g && !special;
    sel.innerHTML = "";
    const first = document.createElement("option");
    first.value = ""; first.textContent = g && !special ? "-- Choose your kind of business --" : "-- Choose a group first --";
    sel.appendChild(first);
    if (g && !special) g.items.forEach((name) => { const o = document.createElement("option"); o.value = name; o.textContent = name; sel.appendChild(o); });
    nd.required = special;
    $("natureHint").textContent = special ? "(required)" : "(optional)";
    $("regNote").classList.toggle("hidden", code !== "REG");
    setSubmitLabel();
}
document.addEventListener("change", (ev) => {
    const t = ev.target;
    if (!t) return;
    if (t.id === "bizGroup") updateBizCategories();
    else if (t.id === "pkGroup") updatePkCategories();
    else if (t.name === "purpose") setSubmitLabel();
});

function closeFormModal() {
    $("formModal").classList.add("hidden");
    document.body.style.overflow = "";
}

// ---------- BUSINESS LIST GUIDE (find your group) ----------
function renderGuide(filter) {
    const q = (filter || "").trim().toLowerCase();
    let html = "", found = 0;
    ["A", "B", "C", "D", "E"].forEach((code) => {
        const g = BUSINESS_GROUPS[code];
        const items = g.items.filter((n) => !q || n.toLowerCase().indexOf(q) >= 0);
        if (!items.length) return;
        found += items.length;
        html += '<div class="guide-group"><div class="guide-head"><b>' + g.label + "</b><span>" + peso(g.amount) + "</span></div>" +
            items.map((n) => '<button type="button" class="guide-item" data-code="' + code + '" data-name="' + escapeHtml(n) + '">' + escapeHtml(n) + "</button>").join("") + "</div>";
    });
    [["NC", "Business not otherwise categorized"], ["REG", "Regulated business (resolution required)"]].forEach((x) => {
        if (q && x[1].toLowerCase().indexOf(q) < 0 && "other".indexOf(q) < 0) return;
        found++;
        html += '<div class="guide-group"><button type="button" class="guide-item" data-code="' + x[0] + '" data-name="">' + x[1] +
            ' <span class="guide-fee">' + peso(BUSINESS_GROUPS[x[0]].amount) + "</span></button></div>";
    });
    $("guideList").innerHTML = html || '<p class="muted">No match. Try another word, or choose "Business not otherwise categorized".</p>';
}
document.addEventListener("input", (e) => { if (e.target && e.target.id === "guideSearch") renderGuide(e.target.value); });
document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest(".guide-item");
    if (!b || b.classList.contains("pkg")) return;
    $("bizGroup").value = b.dataset.code;
    updateBizCategories();
    if (b.dataset.name) $("bizCategory").value = b.dataset.name;
    setSubmitLabel();
    $("groupGuide").open = false;
    queueDraftSave({ target: $("bizGroup") });
    $("bizGroup").scrollIntoView({ behavior: "smooth", block: "center" });
});