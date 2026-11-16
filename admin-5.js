async function afterChange(serial, msg) {
    feedback(okMsg(msg));
    await runSearch(false);
    if (serial) await openRecord(serial);
}

async function onDetailsClick(e) {
    const btn = e.target.closest("button");
    if (!btn || !curRow) return;
    const serial = curRow.serial;
    try {
        if (btn.dataset.act === "paid") { await api.markPaid(serial); await afterChange(serial, "Marked as paid."); }
        else if (btn.dataset.act === "delete") askDelete(curRow);
        else if (btn.dataset.stage === "rejected") openReject(serial);
        else if (btn.dataset.stage) { await api.setStage(serial, btn.dataset.stage); await afterChange(serial, "Updated."); }
    } catch (err) {
        feedback(errMsg("Error: " + (errText(err))));
    }
}

// ---------- confirm modal (delete / delete forever) ----------
function openConfirm(o) {
    $("confirmTitle").textContent = o.title;
    $("confirmMsg").innerHTML = o.msg;
    $("confirmWarn").innerHTML = o.warn || "";
    $("confirmErr").innerHTML = "";
    const b = $("confirmBtn");
    b.textContent = o.btn; b.disabled = false;
    confirmRun = o.run;
    $("confirmModal").classList.remove("hidden");
}
function closeConfirm() { confirmRun = null; $("confirmModal").classList.add("hidden"); }
async function runConfirm() {
    if (!confirmRun) return;
    const b = $("confirmBtn");
    b.disabled = true;
    try { await confirmRun(); closeConfirm(); }
    catch (err) { $("confirmErr").innerHTML = errMsg("Could not complete: " + (errText(err))); b.disabled = false; }
}
function askDelete(row) {
    openConfirm({
        title: "Delete this permit?",
        msg: "Are you sure you want to delete the " + escapeHtml(typeLabel(row.document_type)) + " belonging to <b>" + escapeHtml(row.name) + "</b> (No. <b>" + escapeHtml(row.serial) + "</b>)?",
        warn: "<b>It will be moved to Trash. You can restore it later.</b>",
        btn: "Yes, move to Trash",
        run: async () => {
            await api.archive(row.serial);
            curRow = null; currentCert = null;
            $("adminDetails").innerHTML = ""; $("certPanel").classList.add("hidden"); $("certNote").classList.add("hidden"); $("printable-clearance").innerHTML = "";
            feedback(okMsg("Permit " + row.serial + " was moved to Trash."));
            await runSearch(false);
        }
    });
}

// ---------- reject modal ----------
function openReject(serial) {
    rejectSerial = serial;
    $("rejectReason").value = ""; $("rejectErr").innerHTML = "";
    $("rejectModal").classList.remove("hidden");
}
function closeReject() { rejectSerial = null; $("rejectModal").classList.add("hidden"); }
async function runReject() {
    const reason = $("rejectReason").value.trim();
    if (!reason) { $("rejectErr").innerHTML = errMsg("Please give a reason for rejecting"); return; }
    const serial = rejectSerial;
    try { await api.setStage(serial, "rejected", reason); closeReject(); await afterChange(serial, "Application rejected."); }
    catch (err) { $("rejectErr").innerHTML = errMsg((errText(err))); }
}

// ---------- TRASH (administrator only) ----------
async function loadTrash() {
    const box = $("trashList");
    try {
        const { rows } = await api.list({ trash: true, page: 0, size: 200 });
        if (!rows.length) { box.innerHTML = '<p class="muted">' + "Trash is empty.</p>";  return; }
        let html = '<div class="table-scroll"><table class="admin-list"><tr><th>' + "No.</th><th>Name</th><th>Deleted</th><th></th></tr>";
        rows.forEach((r) => {
            html += "<tr><td>" + escapeHtml(r.serial) + "</td><td>" + escapeHtml(r.name) + "</td><td>" + escapeHtml(fmtDate(r.deleted_at)) +
                '<br><span class="muted">' + escapeHtml(r.deleted_by || "") + "</span></td><td>" +
                '<button type="button" class="row-btn" data-restore="' + escapeHtml(r.serial) + '">' + "Restore</button>" +
                '<button type="button" class="row-btn danger" data-purge="' + escapeHtml(r.serial) + '" data-name="' + escapeHtml(r.name) + '">' + "Delete forever</button></td></tr>";
        });
        box.innerHTML = html + "</table></div>";
    } catch (err) { box.innerHTML = errMsg("Error: " + errText(err)); }
}
async function onTrashClick(e) {
    const btn = e.target.closest("button");
    if (!btn) return;
    try {
        if (btn.dataset.restore) { await api.restore(btn.dataset.restore); await loadTrash(); }
        else if (btn.dataset.purge) {
            const serial = btn.dataset.purge;
            openConfirm({
                title: "Delete forever?",
                msg: "Permanently delete <b>" + escapeHtml(btn.dataset.name) + "</b> (No. <b>" + escapeHtml(serial) + "</b>)?",
                warn: "<b>This cannot be undone. The application and its uploaded requirements will be permanently removed.</b>",
                btn: "Yes, delete forever",
                run: async () => { await api.purge(serial); await loadTrash(); }
            });
        }
    } catch (err) { $("trashList").insertAdjacentHTML("afterbegin", errMsg("Error: " + (errText(err)))); }
}

// ---------- AUDIT LOG (administrator only) ----------
let auditCache = [];
function renderAudit() {
    const q = $("auditFilter").value.trim().toLowerCase();
    const rows = auditCache.filter((r) => !q || [r.actor_email, r.actor_role, r.action, (ACTION_LABEL[r.action] || r.action), r.serial].join(" ").toLowerCase().includes(q)).slice(0, 150);
    const box = $("auditList");
    if (!rows.length) { box.innerHTML = '<p class="muted">' + "No entries.</p>";  return; }
    let html = '<div class="table-scroll"><table class="admin-list"><tr><th>' + "When</th><th>Who</th><th>Action</th><th>No.</th></tr>";
    rows.forEach((r) => {
        html += "<tr><td>" + escapeHtml(fmtDateTime(r.at)) + "</td><td>" + escapeHtml(r.actor_email || "system") +
            '<br><span class="muted">' + escapeHtml(ROLE_LABEL[r.actor_role] || r.actor_role || "") + "</span></td><td>" +
            escapeHtml(ACTION_LABEL[r.action] || r.action) +
            (r.detail && r.detail.reason ? '<br><span class="muted">' + escapeHtml(r.detail.reason) + "</span>" : "") +
            "</td><td>" + escapeHtml(r.serial || "") + "</td></tr>";
    });
    box.innerHTML = html + "</table></div>";
}
async function loadAudit() {
    try { auditCache = await api.audit(); renderAudit(); }
    catch (err) { $("auditList").innerHTML = errMsg("Error: " + errText(err)); }
}