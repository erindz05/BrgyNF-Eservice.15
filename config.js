// =====================================================================
//  config.js  -  USE THE SAME VALUES IN BOTH FOLDERS (applicant and admin)
// =====================================================================
window.APP_CONFIG = {
    // 1) Supabase: Project Settings > API.  Paste the Project URL and the "anon public" key.
    //    While these still say YOUR_..., the site runs in DEMO MODE (yellow bar at the top):
    //    nothing is saved online and PayRex is never called.
    SUPABASE_URL: "https://zndunimxcaxlifajlmtx.supabase.co",        // example: "https://abcdxyz.supabase.co"
    SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuZHVuaW14Y2F4bGlmYWpsbXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxODIyNjcsImV4cCI6MjEwODc1ODI2N30.63CRpMACuj8v00Dkn4R75wZlgFgZLg_UwhJmt4wk_HM",   // the long key that starts with eyJ...  (NOT the service_role key)

    // 2) Online payment through PayRex (needs the Supabase keys above + the 2 Edge Functions)
    ENABLE_ONLINE_PAYMENT: true,

    // Barangay Clearance fees in PESOS, by purpose (Indigency / Medical / Financial are always FREE)
    CLEARANCE_FEES: { "Residency": 50, "Clearance": 100, "Non Resident": 250 },
    PUNONG_BARANGAY: "HON. AMELIA C. CHUA",
    PUNONG_BARANGAY_TITLE: "Punong Barangay",

    // Your applicant website link (used by the QR code), e.g. "https://USERNAME.github.io/REPO/"
    SITE_URL: "",
    IMAGES: { logo: "/BarangayPortal (applicant)/images /1000019270-removebg-preview.png", seal: "", bagongPilipinas: "", signature: "", certificateBackground: "/BarangayPortal (applicant)/images /IMG_409d5580-fde0-4144-9cb8-c953a8ab719e.jpg" }
};