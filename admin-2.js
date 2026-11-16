// ---------- DATA LAYER for staff (Supabase functions, or demo storage) ----------
const api = {
    async role() {
        if (!db) return null;
        const { data } = await db.rpc("staff_role");
        return data || null;
    },
    async stats() {
        if (db) { const { data, error } = await db.rpc("admin_dashboard"); if (error) throw error; return data; }
        return demoStats();
    },
    async list(f) {
        const size = f.size || PAGE_SIZE, from = (f.page || 0) * size;
        if (db) {
            let q = db.from("clearances")
                .select("serial,name,document_type,status,stage,created_at,issued_at,amount_centavos,deleted_at,deleted_by", { count: "exact" });
            q = f.trash ? q.not("deleted_at", "is", null) : q.is("deleted_at", null);
            if (f.q) {
                const s = f.q.replace(/[,()%*\\]/g, " ").trim();
                if (s) q = q.or("serial.ilike.*" + s + "*,name.ilike.*" + s + "*");
            }
            if (f.type) q = q.eq("document_type", f.type);
            if (f.stage) q = q.eq("stage", f.stage);
            if (f.pay === "paid") q = q.eq("status", "paid");
            if (f.pay === "unpaid") q = q.neq("status", "paid");
            if (f.from) q = q.gte("created_at", f.from + "T00:00:00+08:00");
            if (f.to) q = q.lte("created_at", f.to + "T23:59:59.999+08:00");
            q = q.order(f.trash ? "deleted_at" : "created_at", { ascending: false }).range(from, from + size - 1);
            const { data, error, count } = await q;
            if (error) throw error;
            return { rows: data || [], count: count || 0 };
        }
        const all = demoList().filter((r) => demoMatches(r, f)).sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
        return { rows: all.slice(from, from + size), count: all.length };
    },
    async get(serial) {
        if (db) {
            const { data, error } = await db.from("clearances").select("*").eq("serial", serial).maybeSingle();
            if (error) throw error;
            return data;
        }
        return demoFind(demoList(), serial) || null;
    },
    async markPaid(serial) {
        if (db) { const { error } = await db.rpc("mark_paid", { p_serial: serial }); if (error) throw error; return; }
        const list = demoList(), r = demoFind(list, serial);
        if (!r) throw new Error("Application not found");
        if (r.status !== "paid") {
            r.status = "paid"; r.issued_at = r.issued_at || new Date().toISOString();
            r.amount_centavos = r.amount_centavos != null ? r.amount_centavos : feeFor(r.document_type, r.details) || fees[r.document_type]; demoSave(list); demoAudit("mark_paid", serial);
        }
    },
    async setStage(serial, stage, reason) {
        if (db) { const { error } = await db.rpc("set_stage", { p_serial: serial, p_stage: stage, p_reason: reason || null }); if (error) throw error; return; }
        const list = demoList(), r = demoFind(list, serial);
        if (!r) throw new Error("Application not found");
        if ((stage === "ready" || stage === "released") && r.status !== "paid") throw new Error("Payment has not been received yet");
        if (stage === "rejected" && !(reason || "").trim()) throw new Error("Please give a reason for rejecting");
        const from = r.stage || "submitted";
        r.stage = stage; r.reject_reason = stage === "rejected" ? reason.trim() : null;
        demoSave(list); demoAudit("stage_" + stage, serial, { from, to: stage, reason: reason || null });
    },
    async archive(serial) {
        if (db) { const { error } = await db.rpc("archive_application", { p_serial: serial }); if (error) throw error; return; }
        const list = demoList(), r = demoFind(list, serial);
        if (!r) throw new Error("Application not found");
        r.deleted_at = new Date().toISOString(); r.deleted_by = staff.email; demoSave(list); demoAudit("delete", serial);
    },
    async restore(serial) {
        if (db) { const { error } = await db.rpc("restore_application", { p_serial: serial }); if (error) throw error; return; }
        const list = demoList(), r = demoFind(list, serial);
        if (!r) throw new Error("Application not found in Trash");
        r.deleted_at = null; r.deleted_by = null; demoSave(list); demoAudit("restore", serial);
    },
    async purge(serial) {
        const row = await api.get(serial);
        if (db) {
            const { error } = await db.rpc("purge_application", { p_serial: serial });
            if (error) throw error;
            const reqs = (row && row.details && row.details["Requirements"]) || {};
            const paths = Object.keys(reqs).map((k) => reqs[k]).filter(Boolean);
            if (paths.length) { try { await db.storage.from("requirements").remove(paths); } catch (e) { console.error(e); } }
            return;
        }
        if (!row || !row.deleted_at) throw new Error("Only items in Trash can be deleted forever");
        demoSave(demoList().filter((r) => r.serial !== serial)); demoAudit("purge", serial);
    },
    async audit() {
        if (db) {
            const { data, error } = await db.from("audit_log").select("*").order("at", { ascending: false }).limit(300);
            if (error) throw error;
            return data || [];
        }
        return demoAuditList().slice().reverse();
    },
    async log(action, serial) {
        try {
            if (db) await db.rpc("log_event", { p_action: action, p_serial: serial || null });
            else demoAudit(action, serial);
        } catch (e) { console.error(e); }
    }
};
// ---------- login / logout ----------
function unlockAdminUI(role, email) {
    staff = { role, email: email || "" };
    $("adminAuthForm").classList.add("hidden");
    $("adminCoreControls").classList.remove("hidden");
    $("authFeedback").innerHTML = "";
    $("roleBadge").textContent = (ROLE_LABEL[role] || role);
    document.querySelectorAll("#adminTabs [data-role]").forEach((b) => b.classList.toggle("hidden", b.dataset.role !== role));
    $("btnCsv").classList.toggle("hidden", !can.csv());
    api.log("login");
    showTab("dashboard");
}