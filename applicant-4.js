// Demo mode only: shrink a photo (or keep a small PDF) so it fits in the browser storage
function demoFileData(file) {
    return new Promise((resolve) => {
        const rd = new FileReader();
        rd.onerror = () => resolve("");
        rd.onload = () => {
            const url = rd.result;
            if (!/^image\//.test(file.type)) return resolve(url.length < 900000 ? url : "");
            const im = new Image();
            im.onerror = () => resolve("");
            im.onload = () => {
                const k = Math.min(1, 1000 / Math.max(im.width, im.height));
                const c = document.createElement("canvas");
                c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
                c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
                resolve(c.toDataURL("image/jpeg", 0.7));
            };
            im.src = url;
        };
        rd.readAsDataURL(file);
    });
}

// --- PAYMENT (done by the secure backend) -------------
// The website never sees a PayRex secret key. It asks the "create-payment" Edge Function,
// which creates the PayRex checkout page on the server and returns only its URL.
async function requestPayment(serial) {
    const { data, error } = await db.functions.invoke("create-payment", { body: { serial, returnUrl: location.href.split("#")[0].split("?")[0] } });
    if (error) {
        let why = error.message || String(error);
        try { const b = await error.context.json(); if (b && b.error) why = b.error; } catch (e) {}   // the real reason from the server
        throw new Error(why);
    }
    if (!data || !data.url) throw new Error((data && data.error) || "No payment link returned");
    return { url: data.url, id: data.id };
}

// --- DATABASE LAYER (applicant side) -------------------
function demoList() {
    try { return JSON.parse(localStorage.getItem("demoClearances") || "[]"); } catch (e) { return []; }
}
function demoSave(list) {
    try { localStorage.setItem("demoClearances", JSON.stringify(list)); } catch (e) {}
}

async function saveApplication(name, docType, details) {
    if (db) {
        const { data, error } = await db.rpc("submit_application", {
            p_name: name, p_doc_type: docType, p_details: details
        });
        if (error) throw error;
        return { serial: data, status: "pending" };
    }
    // demo mode - number format YY-NNNN (digits only), restarts at 0001 every year
    const list = demoList();
    const yy = String(new Date().getFullYear()).slice(-2);
    let highest = 0;
    list.forEach((r) => {
        const m = /^(\d{2})-(\d+)$/.exec(r.serial || "");
        if (m && m[1] === yy) highest = Math.max(highest, parseInt(m[2], 10));
    });
    const serial = yy + "-" + String(highest + 1).padStart(4, "0");
    const amount = feeFor(docType, details);
    if (amount === null) throw new Error("Please choose the business group");
    const free = amount === 0, nowIso = new Date().toISOString();
    list.push({ serial, name, document_type: docType, details, status: free ? "paid" : "pending", stage: "submitted", created_at: nowIso, issued_at: free ? nowIso : null, amount_centavos: amount });
    demoSave(list);
    return { serial, status: "pending" };
}

// --- SUBMIT APPLICATION (APPLICANT) -------------------
async function processApplication() {
    const docType = $("documentType").value;
    const form = activeForm();
    showFormError("");

    // Built-in browser validation
    form.querySelectorAll("input, select, textarea").forEach((el) => el.classList.add("touched"));
    if (!form.checkValidity()) {
        const bad = form.querySelector(":invalid");
        form.reportValidity();
        if (bad) bad.focus();
        showFormError("Please complete all required fields (and attach every requirement).");
        return;
    }

    let data;
    if (docType === "Business Permit") {
        data = collectBusiness(form);
    } else if (docType === "Pangkabuhayan") {
        data = collectPangkabuhayan(form);
    } else {
        data = collectClearance(form);
        if (!data.purposes.length) {
            showFormError("Please tick at least one Purpose.");
            return;
        }
    }

    const btn = $("submitBtn");
    const idleText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "Processing…";

    try {
        // 1) Upload requirement files (permits)
        const files = await uploadRequirements(form);
        if (Object.keys(files).length) data.details["Requirements"] = files;

        // 2) Save record (the database creates the reference number)
        const saved = await saveApplication(data.name, docType, data.details);

        // 3) Payment link from the secure backend (only when enabled in config.js)
        let payment = null;
        let payNote = "";
        if (db && ENABLE_ONLINE_PAYMENT && feeFor(docType, data.details) > 0) {
            try {
                payment = await requestPayment(saved.serial);
            } catch (e) {
                console.error(e);
                payNote = "Online payment could not start (" + (e.message || e) + "). Please pay at the Barangay Hall and show your reference number.";
            }
        }

        // 4) Confirmation for the applicant (NOT the certificate - only admins can print that)
        clearDraft(docType);
        closeFormModal();
        showConfirmation({ serial: saved.serial, name: data.name, document_type: docType, amount: feeFor(docType, data.details) }, payment, payNote);
    } catch (err) {
        console.error(err);
        showFormError("Something went wrong: " + (err.message || err));
        btn.disabled = false;
        btn.innerText = idleText;
    }
}
function showConfirmation(rec, payment, payNote) {
    const amount = rec.amount;
    let html = "<h3>✅ Application Submitted</h3>" +
        "<p>Your reference number:</p><p class=\"ref-number\">" + escapeHtml(rec.serial) + "</p>" +
        "<p>Name: <b>" + escapeHtml(rec.name) + "</b><br>Type: <b>" + escapeHtml(DOCUMENT_LABELS[rec.document_type]) +
        "</b><br>Fee: <b>" + (amount === 0 ? "FREE" : peso(amount)) + "</b><br>Status: <b>" + (amount === 0 ? "NO PAYMENT NEEDED" : "PENDING") + "</b></p>";
    if (amount === 0) {
        html += "<p>This document is free of charge. Please wait for the barangay to review your application, then show this reference number at the Barangay Hall.</p>";
    } else if (payment) {
        html += "<p><b>Taking you to PayRex to pay…</b></p>" +
            "<a class=\"success-btn pay-btn\" href=\"" + escapeHtml(payment.url) + "\">Pay " +
            peso(amount) + " online (GCash, Maya, QR Ph, card)</a>" +
            "<p class=\"muted\">If the page does not open by itself, tap the green button. After paying you come back to this website. Your payment is confirmed automatically, then the barangay reviews your application.</p>";
        setTimeout(() => { location.href = payment.url; }, 1500);   // go to the PayRex payment page automatically
    } else {
        html += "<p>Please pay the fee of <b>" + peso(amount) + "</b> at the Barangay Hall and show this reference number.</p>";
    }
    if (payNote) html += "<p class=\"muted\">" + escapeHtml(payNote) + "</p>";
    html += "<p class=\"muted\">Please save this number and present it at the Barangay Hall. Your personal details are confidential and can only be viewed by authorized barangay personnel.</p>";

    const card = $("confirmCard");
    card.innerHTML = html;
    card.classList.remove("hidden");
    setTimeout(() => card.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
}

window.addEventListener("DOMContentLoaded", () => {
    // Coming back from the PayRex payment page: ?paid=26-0001  or  ?cancelled=26-0001
    const qs = new URLSearchParams(location.search), ps = qs.get("paid"), pc = qs.get("cancelled");
    if (ps || pc) {
        const card = $("confirmCard");
        card.innerHTML = ps
            ? "<h3>Thank you!</h3><p>Reference number:</p><p class=\"ref-number\">" + escapeHtml(ps) + "</p><p>If your payment went through, it is confirmed automatically in a few seconds. Please keep this number and wait for the barangay to review your application.</p>"
            : "<h3>Payment not completed</h3><p>Reference number:</p><p class=\"ref-number\">" + escapeHtml(pc) + "</p><p>You can pay at the Barangay Hall and show this number.</p>";
        card.classList.remove("hidden");
        try { history.replaceState(null, "", location.pathname); } catch (e) {}
    }
    // (re)open the form when someone follows a link like index.html#clearance
    const map = { permit: "Business Permit", clearance: "Barangay Clearance", pangkabuhayan: "Pangkabuhayan" };
    const t = map[(location.hash || "").replace("#", "")];
    if (t) openApplicationForm(t);
});
window.updateRequirements = updateRequirements;
window.startOverDraft = startOverDraft;
window.openApplicationForm = openApplicationForm;
window.processApplication = processApplication;
window.closeFormModal = closeFormModal;