// ---------- APPLICATIONS: search, list, pages ----------
function readFilters() {
    return { q: $("fQ").value.trim(), type: $("fType").value, stage: $("fStage").value, pay: $("fPay").value, from: $("fFrom").value, to: $("fTo").value };
}
async function runSearch(reset) {
    if (reset) curPage = 0;
    feedback("");
    const box = $("adminList");
    try {
        const f = Object.assign(readFilters(), { page: curPage });
        const { rows, count } = await api.list(f);
        if (!rows.length) {
            box.innerHTML = '<p class="muted">' + "No applications found.</p>";
            $("adminPager").innerHTML = "";
            return;
        }
        let html = '<div class="table-scroll"><table class="admin-list"><tr><th>' + "No.</th><th>Name</th><th>Type</th><th>Payment</th><th>Stage</th></tr>";
        rows.forEach((r) => {
            html += '<tr class="pick" data-serial="' + escapeHtml(r.serial) + '"><td>' + escapeHtml(r.serial) + "</td><td>" + escapeHtml(r.name) + "</td><td>" +
                escapeHtml(typeLabel(r.document_type)) + "</td><td>" + payBadge(r.status, r.amount_centavos) + "</td><td>" + stageBadge(r.stage || "submitted") + "</td></tr>";
        });
        box.innerHTML = html + "</table></div>";
        const from = curPage * PAGE_SIZE + 1, to = curPage * PAGE_SIZE + rows.length;
        $("adminPager").innerHTML = '<button type="button" id="pgPrev"' + (curPage === 0 ? " disabled" : "") + ">&larr; Previous</button><span>" +
            from + "–" + to + " of " + count + '</span><button type="button" id="pgNext"' + (to >= count ? " disabled" : "") + ">Next &rarr;</button>";
    } catch (err) {
        box.innerHTML = errMsg("Error: " + errText(err));
    }
}

function clearFilters() {
    ["fQ", "fFrom", "fTo"].forEach((id) => { $(id).value = ""; });
    ["fType", "fStage", "fPay"].forEach((id) => { $(id).value = ""; });
    runSearch(true);
}

// ---------- one application: details + actions ----------
async function openRecord(serial) {
    try {
        const row = await api.get(serial);
        if (!row) { feedback(errMsg("No application found for that reference number.")); return; }
        curRow = row;
        renderRecord(row);
        await renderRequirements(row);
        showCertificateIfAllowed(row);
        $("adminDetails").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
        feedback(errMsg("Error: " + errText(err)));
    }
}

function renderRecord(row) {
    const stage = row.stage || "submitted";
    const paid = row.status === "paid";
    const d = row.details || {};
    let btns = "";
    if (can.pay() && !paid && stage !== "rejected") btns += '<button type="button" class="act-btn ok" data-act="paid">💰 ' + "Mark as Paid</button>";
    if (can.review()) {
        (NEXT_STAGES[stage] || []).forEach((n) => {
            const lbl = STAGE_BTN[n], needsPay = (n === "ready" || n === "released") && !paid;
            btns += '<button type="button" class="act-btn ' + lbl[1] + '" data-stage="' + n + '"' + (needsPay ? " disabled" : "") + ">" + escapeHtml(lbl[0]) + "</button>";
        });
    }
    if (can.admin()) btns += '<button type="button" class="act-btn danger" data-act="delete">🗑️ ' + "Delete this permit</button>";
    const waitNote = (!paid && can.review() && (stage === "approved")) ? '<p class="muted">' + "Waiting for payment before it can be marked ready.</p>" : "";

    let html = '<div class="admin-details"><div class="record-head"><div><h3>' + escapeHtml(row.name) + '</h3><div class="muted">' + "No. " + escapeHtml(row.serial) +
        " · " + escapeHtml(typeLabel(row.document_type)) + "</div></div><div>" + payBadge(row.status, row.amount_centavos) + " " + stageBadge(stage) + "</div></div>" +
        '<div class="muted">' + "Applied: " + escapeHtml(fmtDate(row.created_at)) +
        (rowAmount(row) != null ? " · Fee: " + peso(rowAmount(row)) : "") + "</div>" +
        (stage === "rejected" && row.reject_reason ? '<div class="reject-box"><b>' + "Rejected:</b> " + escapeHtml(row.reject_reason) + "</div>" : "") +
        '<div class="action-row">' + btns + "</div>" + waitNote +
        "<h4>Full Application Details (Confidential)" + '</h4><table>';
    Object.keys(d).forEach((k) => {
        if (k === "Requirements" || k === "Group Code" || d[k] === "" || d[k] == null) return;
        html += "<tr><td>" + escapeHtml(k) + "</td><td>" + escapeHtml(d[k]) + "</td></tr>";
    });
    html += '</table><div id="reqBox"></div></div>';
    $("adminDetails").innerHTML = html;
}

// ---- Requirement files: each one has a big "View" button that opens it right on the page ----
let reqFiles = [];   // { label, path, url, isImg, isPdf }
async function renderRequirements(row) {
    const box = $("reqBox");
    if (!box) return;
    const reqs = (row.details && row.details["Requirements"]) || {};
    const names = Object.keys(reqs);
    const title = "<h4>Uploaded Requirements</h4>";
    reqFiles = [];
    if (!names.length) { box.innerHTML = title + '<p class="muted">No files were uploaded with this application.</p>'; return; }
    box.innerHTML = title + '<p class="muted">Loading files…</p>';
    let html = '<div class="req-view">';
    for (let i = 0; i < names.length; i++) {
        const label = names[i], path = String(reqs[label]);
        const isImg = /\.(png|jpe?g|gif|webp|bmp)$/i.test(path), isPdf = /\.pdf$/i.test(path);
        let url = "", msg = "";
        if (db) {
            try {
                const { data, error } = await db.storage.from("requirements").createSignedUrl(path, 600); // link works for 10 minutes
                if (error || !data) msg = (error && error.message) || "no link"; else url = data.signedUrl;
            } catch (e) { msg = errText(e); }
        } else {
            try { url = localStorage.getItem("brgyFile:" + path) || ""; } catch (e) {}
            if (!url) msg = "this file was submitted before viewing was added, or the browser storage is full";
        }
        reqFiles.push({ label, path, url, isImg: isImg || /^data:image/.test(url), isPdf: isPdf || /^data:application\/pdf/.test(url) });
        const fname = path.split("/").pop().replace(/^req_[a-z_]+-/, "");
        let inner;
        if (url) {
            inner = (reqFiles[i].isImg ? '<img class="req-thumb" src="' + escapeHtml(url) + '" alt="" data-view="' + i + '">' : "") +
                '<div class="req-file">' + escapeHtml(fname) + '</div>' +
                '<button type="button" class="act-btn req-view-btn" data-view="' + i + '">&#128065; View</button>';
        } else {
            inner = '<div class="req-file">' + escapeHtml(fname) + '</div><span class="pic-bad">Cannot view: ' + escapeHtml(msg) + "</span>";
        }
        html += '<div class="req-row"><div class="req-label">' + escapeHtml(label) + "</div>" + inner + "</div>";
    }
    box.innerHTML = title + html + "</div>";
}
async function fileUrlForViewer(f) {
    if (!/^data:/.test(f.url)) return f.url;
    const blob = await (await fetch(f.url)).blob();   // data: -> blob: so PDFs and large photos open reliably
    return URL.createObjectURL(blob);
}
async function openReqViewer(i) {
    const f = reqFiles[i];
    if (!f || !f.url) return;
    let v = $("reqViewer");
    if (!v) {
        v = document.createElement("div");
        v.id = "reqViewer"; v.className = "modal-layer";
        v.innerHTML = '<div class="modal-card viewer-card"><div class="modal-header"><h3 id="reqViewerTitle"></h3>' +
            '<button type="button" class="close-modal-btn" id="reqViewerClose" aria-label="Close">&times;</button></div>' +
            '<div class="viewer-body" id="reqViewerBody"></div>' +
            '<div class="viewer-foot"><a id="reqViewerOpen" class="act-btn" target="_blank" rel="noopener">Open in new tab</a>' +
            '<button type="button" class="act-btn" id="reqViewerPrev">&larr; Prev</button>' +
            '<button type="button" class="act-btn" id="reqViewerNext">Next &rarr;</button></div></div>';
        document.body.appendChild(v);
        $("reqViewerClose").onclick = closeReqViewer;
        $("reqViewerPrev").onclick = () => stepReqViewer(-1);
        $("reqViewerNext").onclick = () => stepReqViewer(1);
    }
    v.dataset.i = i;
    $("reqViewerTitle").textContent = f.label;
    const u = await fileUrlForViewer(f);
    $("reqViewerBody").innerHTML = f.isPdf
        ? '<iframe src="' + escapeHtml(u) + '" title="' + escapeHtml(f.label) + '"></iframe>'
        : '<img src="' + escapeHtml(u) + '" alt="' + escapeHtml(f.label) + '">';
    $("reqViewerOpen").href = u;
    const viewable = reqFiles.map((x, k) => (x.url ? k : -1)).filter((k) => k >= 0);
    $("reqViewerPrev").classList.toggle("hidden", viewable.length < 2);
    $("reqViewerNext").classList.toggle("hidden", viewable.length < 2);
    v.classList.remove("hidden");
    document.body.style.overflow = "hidden";
}
function stepReqViewer(d) {
    const cur = parseInt($("reqViewer").dataset.i, 10), n = reqFiles.length;
    for (let k = 1; k <= n; k++) {
        const j = (cur + d * k + n * k) % n;
        if (reqFiles[j] && reqFiles[j].url) { openReqViewer(j); return; }
    }
}
function closeReqViewer() {
    const v = $("reqViewer");
    if (v) { v.classList.add("hidden"); $("reqViewerBody").innerHTML = ""; }
    document.body.style.overflow = "";
}
document.addEventListener("click", (e) => {
    const t = e.target.closest && e.target.closest("[data-view]");
    if (t) openReqViewer(parseInt(t.dataset.view, 10));
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("reqViewer") && !$("reqViewer").classList.contains("hidden")) closeReqViewer(); });
function showCertificateIfAllowed(row) {
    const stage = row.stage || "submitted";
    const note = $("certNote");
    const allowed = can.print() && row.status === "paid" && ["approved", "ready", "released"].includes(stage);
    if (allowed) {
        note.classList.add("hidden");
        renderCertificate(row);
        return;
    }
    $("certPanel").classList.add("hidden");
    $("printable-clearance").innerHTML = "";
    currentCert = null;
    note.textContent = !can.print() ? "Your role cannot print certificates." : "The certificate can be printed once the application is paid and approved.";
    note.classList.remove("hidden");
}