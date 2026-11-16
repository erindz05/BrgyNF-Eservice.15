// Close modal by clicking the dark backdrop or pressing Escape
// (Tapping the dark backdrop no longer closes the form, so nothing is lost by accident.)
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("formModal").classList.contains("hidden")) closeFormModal();
});
// Red borders only after the user has touched a field
document.addEventListener("blur", (e) => {
    if (e.target && e.target.classList && e.target.matches && e.target.matches("input, select, textarea")) {
        e.target.classList.add("touched");
    }
}, true);

// --- COLLECT FORM DATA --------------------------------
function collectBusiness(form) {
    const f = new FormData(form);
    const g = (k) => (f.get(k) || "").toString().trim();
    const owner = fullName(g("ownerFirst"), g("ownerMiddle"), g("ownerLast"));
    const details = {
        "Application Type": g("appType"),
        "Date of Application": g("dateApplication") || todayISO(),
        "Business Trade Name": g("tradeName"),
        "Type of Business": g("businessType"),
        "Owner": owner,
        "Company Name": g("companyName"),
        "Owner Home Address": g("ownerAddress"),
        "Business Contact No.": g("contactBusiness"),
        "Owner Contact No.": g("ownerContact"),
        "Business Location": g("businessLocation"),
        "CCTV": g("cctv") + (g("cctvCount") ? " (" + g("cctvCount") + " cameras)" : ""),
        "Store Hours": g("storeHours"),
        "Business Capital (Php)": g("capital"),
        "TIN": g("tin"),
        "DTI Registration No.": g("dtiNo"),
        "DTI Registration Date": g("dtiDate"),
        "Employer SSS No.": g("sssNo"),
        "No. of Employees": g("employees"),
        "Rented Since": g("rentSince"),
        "Monthly Rental (Php)": g("rentMonthly"),
        "Rented From": g("rentFrom"),
        "Signboard": g("signboard") + (g("signboardArea") ? " (" + g("signboardArea") + ")" : ""),
        "Business Group": (BUSINESS_GROUPS[g("bizGroup")] || {}).label || "",
        "Group Code": g("bizGroup"),
        "Nature of Business": g("bizCategory") ? g("bizCategory") + (g("natureOfBusiness") ? " - " + g("natureOfBusiness") : "") : g("natureOfBusiness"),
        "Signed By": g("signature")
    };
    return { name: g("tradeName"), details };
}

// Pangkabuhayan: only the owner's name and the nature of business (the requirements are uploaded separately)
function collectPangkabuhayan(form) {
    const f = new FormData(form);
    const g = (k) => (f.get(k) || "").toString().trim();
    const owner = fullName(g("ownerFirst"), g("ownerMiddle"), g("ownerLast"));
    const nature = g("pkCategory") ? g("pkCategory") + (g("pkNatureDetail") ? " - " + g("pkNatureDetail") : "") : g("pkNatureDetail");
    const details = {
        "Application Type": "New",
        "Owner": owner,
        "Type of Business": nature,
        "Nature of Business": nature,
        "Business Group": "Pangkabuhayan (free)",
        "Nature Group": (BUSINESS_GROUPS[g("pkGroup")] || {}).label || "",
        "Group Code": "PK",
        "Date of Application": todayISO()
    };
    return { name: owner, details };
}

function collectClearance(form) {
    const f = new FormData(form);
    const g = (k) => (f.get(k) || "").toString().trim();
    const purposes = f.getAll("purpose");
    const applicant = fullName(g("appFirst"), g("appMiddle"), g("appLast"));
    const details = {
        "Head of Family": fullName(g("headFirst"), g("headMiddle"), g("headLast")),
        "Head Address": g("headAddress"),
        "Head Age": g("headAge"),
        "Year of Residence": g("headResidence"),
        "Head Civil Status": g("headCivil"),
        "Head Gender": g("headGender"),
        "Head Birthday": g("headBirthday"),
        "Head Birthplace": g("headBirthplace"),
        "Applicant": applicant,
        "Address": g("appAddress"),
        "Civil Status": g("appCivil"),
        "Gender": g("appGender"),
        "Age": g("appAge"),
        "Birthday": g("appBirthday"),
        "Birthplace": g("appBirthplace"),
        "Contact No.": g("appContact"),
        "Religion": g("appReligion"),
        "Citizenship": g("appCitizenship"),
        "Precinct No.": g("appPrecinct"),
        "Purpose": purposes.join(", "),
        "Renewal": g("renew") ? "Yes" : "",
        "Clearance For": g("clearanceFor"),
        "To Agency/Office": g("toAgency"),
        "Patient/Student": g("patName"),
        "Patient Age": g("patAge"),
        "Patient Civil Status": g("patCivil"),
        "Patient Gender": g("patGender"),
        "Patient Birthday": g("patBirthday"),
        "Patient Birthplace": g("patBirthplace"),
        "Patient Precinct No.": g("patPrecinct"),
        "Relation to Applicant": g("patRelation"),
        "Signed By": g("signature")
    };
    return { name: applicant, details, purposes };
}

// --- REQUIREMENT FILE UPLOADS -------------------------
async function uploadRequirements(form) {
    const result = {};
    const folder = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
    const inputs = form.querySelectorAll('input[type="file"]:not(:disabled)');
    for (const input of inputs) {
        const file = input.files && input.files[0];
        if (!file) continue;
        if (file.size > MAX_FILE_MB * 1024 * 1024) {
            throw new Error(file.name + " is larger than " + MAX_FILE_MB + " MB.");
        }
        const label = input.closest(".req-item").querySelector("label").innerText.trim();
        if (db) {
            const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
            const path = folder + "/" + input.name + "-" + safe;
            const { error } = await db.storage.from("requirements").upload(path, file);
            if (error) throw new Error("Upload failed for " + label + ": " + error.message);
            result[label] = path;
        } else {
            // demo mode: keep a small viewable copy in this browser so staff can view it
            const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
            const path = folder + "/" + input.name + "-" + safe;
            result[label] = path;
            try { const dataUrl = await demoFileData(file); if (dataUrl) localStorage.setItem("brgyFile:" + path, dataUrl); } catch (e) { console.warn("demo file not stored", e); }
        }
    }
    return result;
}