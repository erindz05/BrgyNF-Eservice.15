// ---------- CSV EXPORT ----------
function csvCell(v) {
    let s = String(v == null ? "" : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;       // stops spreadsheet formula injection
    return '"' + s.replace(/"/g, '""') + '"';
}
async function exportCsv() {
    if (!can.csv()) return;
    const btn = $("btnCsv");
    btn.disabled = true;
    try {
        const f = readFilters();
        let all = [];
        for (let p = 0; p < 20; p++) {
            const { rows, count } = await api.list(Object.assign({}, f, { page: p, size: 1000 }));
            all = all.concat(rows);
            if (all.length >= count || !rows.length) break;
        }
        const day = (iso) => (iso ? new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }) : "");
        const lines = [["Reference No.", "Name", "Document Type", "Payment", "Stage", "Amount (PHP)", "Date Applied", "Date Paid"].map(csvCell).join(",")];
        all.forEach((r) => {
            const amt = rowAmount(r);
            lines.push([r.serial, r.name, typeLabel(r.document_type), r.status === "paid" ? "Paid" : "Unpaid", STAGE_LABEL[r.stage || "submitted"],
                amt != null ? (amt / 100).toFixed(2) : "", day(r.created_at), r.status === "paid" ? day(r.issued_at) : ""].map(csvCell).join(","));
        });
        const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "applications-" + day(new Date().toISOString()) + ".csv";
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 3000);
        feedback(okMsg(all.length + " rows exported."));
        api.log("export_csv");
    } catch (err) {
        feedback(errMsg("Error: " + errText(err)));
    }
    btn.disabled = false;
}

// --- ADMIN: CERTIFICATE (print / PDF) -----------------
function imgTag(key, cls) {
    var src = IMAGES[key] || "";
    if (!src) { return ""; }
    var hide = "this.style.display=" + String.fromCharCode(39) + "none" + String.fromCharCode(39);
    return "<img class=" + String.fromCharCode(34) + cls + String.fromCharCode(34) +
        " src=" + String.fromCharCode(34) + escapeHtml(src) + String.fromCharCode(34) +
        " alt=" + String.fromCharCode(34) + String.fromCharCode(34) +
        " onerror=" + String.fromCharCode(34) + hide + String.fromCharCode(34) + ">";
}

function certHeader() {
    return '<div class="cert-head"><div class="cert-logos">' +
        imgTag("logo", "cert-img") + imgTag("seal", "cert-img") + imgTag("bagongPilipinas", "cert-img") +
        '</div><div class="cert-agency"><div class="cert-republic">Republic of the Philippines</div>' +
        '<div class="cert-brgy">BARANGAY NORTH FAIRVIEW</div><div class="cert-district">District 5, Quezon City</div>' +
        '<div class="cert-phones">8-355-9458/ 8-355-9410</div></div></div>';
}

function certFooter(row) {
    // left: red serial box | center: signature + Punong Barangay | right: seal note
    return '<div class="cert-foot"><div class="cert-foot-left"><div class="cert-serial">' + escapeHtml(row.serial) + '</div></div>' +
        '<div class="cert-sign">' + imgTag("signature", "cert-signature") +
        '<div class="cert-signer">' + escapeHtml(PUNONG_BARANGAY) + '</div>' +
        '<div class="cert-title">' + escapeHtml(PUNONG_BARANGAY_TITLE) + '</div></div>' +
        '<div class="cert-foot-right"><div class="cert-seal-note">Not valid without<br>Barangay Seal</div></div></div>';
}
function typeLabel(t) { return (typeof DOCUMENT_LABELS !== "undefined" && DOCUMENT_LABELS[t]) || t; }
function renderCertificate(row) {
    currentCert = row;
    const d = row.details || {};
    const e = escapeHtml;
    const year = new Date(row.issued_at || Date.now()).getFullYear();
    const issued = longDate(row.issued_at);
    let body;

    if (isBizType(row.document_type)) {
        const tag = (d["Application Type"] || "NEW").toUpperCase();
        const owner = d["Company Name"] || d["Owner"] || "";
        const isPk = row.document_type === "Pangkabuhayan";
        body = '<div class="cert-banner' + (isPk ? " cert-banner-pk" : "") + '">' + (isPk ? "BARANGAY CLEARANCE PANGKABUHAYAN " : "BUSINESS CLEARANCE ") + year + '</div>' +
            '<div class="cert-row"><div class="cert-who">TO WHOM IT MAY CONCERN:</div><div class="cert-tag">' + e(tag) + '</div></div>' +
            '<p class="cert-center cert-italic">This is to certify that</p>' +
            '<div class="cert-line cert-big">' + e(row.name) + '</div><div class="cert-cap">NAME OF BUSINESS</div>' +
            '<div class="cert-line">' + e(d["Business Location"] || "Barangay North Fairview, District V, Quezon City") + '</div><div class="cert-cap">BUSINESS/ OFFICE ADDRESS</div>' +
            '<div class="cert-two"><div><div class="cert-line">' + e(owner) + '</div><div class="cert-cap">OWNER\'S/ COMPANY\'S NAME</div></div>' +
            '<div><div class="cert-line">' + e(d["Type of Business"]) + '</div><div class="cert-cap">KIND OF BUSINESS</div></div></div>' +
            '<p class="cert-text">Is now operating a business within the jurisdiction of this Barangay.</p>' +
            '<p class="cert-text">This clearance is being issued under the requirements of the Local Government Code of 1991, Republic Act 7160, Article IV, Section 152, paragraph C for the purpose of Securing or Renewing Mayor\'s Business Permit from the Quezon City Government.</p>' +
            '<p class="cert-issued">Issued this <u>&nbsp;' + e(issued) + '&nbsp;</u> at<br>Barangay North Fairview, District 5, Quezon City,<br>Metro Manila, Philippines.</p>' +
            '<p class="cert-note"><b class="cert-red">NOTE/CONDITION:</b> This clearance is issued and may be revoked and cancelled anytime should public health, safety, convenience, comfort, interest and social welfare in the area are adversely affected. This Clearance is valid for <b class="cert-red">ONE (1) YEAR</b> from date of issuance in compliance with City Ordinance No. SP-2989, S-2020.</p>';
    } else {
        body = '<div class="cert-banner cert-banner-clr">BARANGAY CLEARANCE ' + year + '</div>' +
            '<div class="cert-row"><div class="cert-who">TO WHOM IT MAY CONCERN:</div></div>' +
            '<p class="cert-center cert-italic">This is to certify that</p>' +
            '<div class="cert-line cert-big">' + e(row.name) + '</div><div class="cert-cap">NAME OF APPLICANT</div>' +
            '<div class="cert-line">' + e(d["Address"]) + '</div><div class="cert-cap">RESIDENCE ADDRESS</div>' +
            '<div class="cert-two"><div><div class="cert-line">' + e(d["Civil Status"]) + '</div><div class="cert-cap">CIVIL STATUS</div></div>' +
            '<div><div class="cert-line">' + e(d["Age"]) + '</div><div class="cert-cap">AGE</div></div></div>' +
            '<p class="cert-text">Is a resident of Barangay North Fairview, District 5, Quezon City.</p>' +
            '<p class="cert-text">This clearance is issued upon the request of the above-named person for the purpose of <b>' + e(d["Purpose"]) + '</b>' +
            (d["Clearance For"] ? ' (' + e(d["Clearance For"]) + ')' : '') + (d["To Agency/Office"] ? ', to be submitted to ' + e(d["To Agency/Office"]) : '') + '.</p>' +
            '<p class="cert-issued">Issued this <u>&nbsp;' + e(issued) + '&nbsp;</u> at<br>Barangay North Fairview, District 5, Quezon City,<br>Metro Manila, Philippines.</p>';
    }

    const el = $("printable-clearance");
    el.innerHTML = certHeader() + body + certFooter(row);
    const bg = (typeof IMAGES !== "undefined" && IMAGES.certificateBackground) || "";
        el.style.setProperty("--cert-bg", bg ? 'url("' + bg + '")' : "none");
    $("certPanel").classList.remove("hidden");
    fitCertificate();
}

// The certificate is A4 width (794px). On a phone we shrink the preview to fit.
function fitCertificate() {
    const vp = $("certViewport");
    const c = $("printable-clearance");
    if (!vp || !c || $("certPanel").classList.contains("hidden")) return;
    c.style.transform = "none";
    const scale = Math.min(1, vp.clientWidth / 794);
    c.style.transformOrigin = "top left";
    c.style.transform = scale < 1 ? "scale(" + scale + ")" : "none";
    vp.style.height = Math.ceil(c.offsetHeight * scale) + "px";
}
window.addEventListener("resize", fitCertificate);

function printCertificate() {
    if (!currentCert) return;
    api.log("print", currentCert.serial);
    window.print(); // style.css prints ONLY the certificate
}

function downloadPDF() {
    if (!currentCert) return;
    if (!window.html2pdf) { alert("PDF library did not load. Check your internet connection."); return; }
    api.log("export_pdf", currentCert.serial);
    const el = $("printable-clearance");
    const vp = $("certViewport");
    const oldT = el.style.transform;
    const oldH = vp.style.height;
    el.style.transform = "none";
    vp.style.height = "auto";
    const restore = () => { el.style.transform = oldT; vp.style.height = oldH; fitCertificate(); };
    html2pdf().set({
        margin: 0,
        filename: currentCert.serial + ".pdf",
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
    }).from(el).save().then(restore).catch(restore);
}


const PIC_NAMES = { logo: "Logo", banner: "Banner", seal: "Seal", bagongPilipinas: "Bagong Pilipinas", signature: "Signature", certificateBackground: "Certificate background" };
function checkPictures() {
    const box = $("picCheck");
    if (!box) return;
    box.innerHTML = Object.keys(PIC_NAMES).map((k) => {
        const v = IMAGES[k] || "";
        const label = v.indexOf("data:") === 0 ? "(pasted picture, " + Math.round(v.length / 1024) + " KB)" : v;
        if (!v) return '<div class="pic-row" data-pic="' + k + '"><div class="pic-none"></div><div class="pic-name">' + PIC_NAMES[k] + '<small>not set</small></div><span class="pic-empty">empty</span></div>';
        return '<div class="pic-row" data-pic="' + k + '"><img alt=""><div class="pic-name">' + PIC_NAMES[k] + "<small>" + escapeHtml(label) + '</small></div><span class="pic-state">checking…</span></div>';
    }).join("");
    Object.keys(PIC_NAMES).forEach((k) => {
        const v = IMAGES[k]; if (!v) return;
        const row = box.querySelector('[data-pic="' + k + '"]'), st = row.querySelector(".pic-state"), im = row.querySelector("img");
        const probe = new Image();
        probe.onload = () => { im.src = v; st.className = "pic-state pic-ok"; st.textContent = "works"; };
        probe.onerror = () => {
            st.className = "pic-state pic-bad";
            st.textContent = v.indexOf("data:") === 0 ? "bad code" : "not found";
            row.querySelector("small").innerHTML += v.indexOf("data:") === 0
                ? "<br>The pasted text is cut or broken. Run image-tool.html again and copy ALL of it."
                : "<br>No file with this exact name in the same folder as index.html (capital letters matter). Or use image-tool.html.";
        };
        probe.src = v;
    });
}

window.addEventListener("DOMContentLoaded", () => {
    $("adminTabs").addEventListener("click", (e) => { const b = e.target.closest(".tab-btn"); if (b) showTab(b.dataset.tab); });
    $("btnSearch").addEventListener("click", () => runSearch(true));
    $("btnClear").addEventListener("click", clearFilters);
    $("btnCsv").addEventListener("click", exportCsv);
    $("btnDashRefresh").addEventListener("click", loadDashboard);
    $("fQ").addEventListener("keydown", (e) => { if (e.key === "Enter") runSearch(true); });
    $("adminPasswordInput").addEventListener("keydown", (e) => { if (e.key === "Enter") authenticateAdmin(); });
    $("auditFilter").addEventListener("input", renderAudit);
    $("adminList").addEventListener("click", (e) => { const tr_ = e.target.closest("tr.pick"); if (tr_) openRecord(tr_.dataset.serial); });
    $("adminPager").addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (!b || b.disabled) return;
        curPage += b.id === "pgNext" ? 1 : -1;
        runSearch(false);
    });
    $("adminDetails").addEventListener("click", onDetailsClick);
    $("trashList").addEventListener("click", onTrashClick);
    $("confirmBtn").addEventListener("click", runConfirm);
    $("rejectBtn").addEventListener("click", runReject);
    restoreAdminSession();     // stay signed in after a page refresh
});
window.authenticateAdmin = authenticateAdmin;
window.logoutAdmin = logoutAdmin;
window.printCertificate = printCertificate;
window.downloadPDF = downloadPDF;
window.closeConfirm = closeConfirm;
window.closeReject = closeReject;


// ---- Portal QR code (staff site only) ----
function drawQr() {
    const box = document.getElementById("siteQr"), inp = document.getElementById("qrUrl");
    if (!box || !inp) return;
    if (!inp.value) {
        let saved = "";
        try { saved = localStorage.getItem("portalQrUrl") || ""; } catch (e) {}
        inp.value = (typeof SITE_URL !== "undefined" && SITE_URL) ? SITE_URL : (saved || applicantUrl());
    }
    if (!window.QRCode) { box.textContent = "QR library could not load (check internet)."; return; }
    box.innerHTML = "";
    new QRCode(box, { text: inp.value.trim(), width: 220, height: 220 });
}
window.downloadQr = function () {
    const cv = document.querySelector("#siteQr canvas"), im = document.querySelector("#siteQr img");
    const src = cv ? cv.toDataURL("image/png") : (im ? im.src : "");
    if (!src) return;
    const a = document.createElement("a"); a.href = src; a.download = "portal-qr.png"; a.click();
};
window.printQr = function () {
    const cv = document.querySelector("#siteQr canvas"), im = document.querySelector("#siteQr img");
    const src = cv ? cv.toDataURL("image/png") : (im ? im.src : "");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write('<body style="text-align:center;font-family:sans-serif"><h2>Barangay North Fairview eServices</h2><img src="' + src + '" style="width:300px"><p>Scan to apply online</p><script>onload=function(){print()}<\/script></body>');
    w.document.close();
};
document.addEventListener("DOMContentLoaded", () => {
    drawQr();
    const inp = document.getElementById("qrUrl");
    if (inp) inp.addEventListener("input", () => { try { localStorage.setItem("portalQrUrl", inp.value.trim()); } catch (e) {} drawQr(); });
});