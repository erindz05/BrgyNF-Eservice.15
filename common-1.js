/* jshint esversion: 11, browser: true, devel: true, asi: true, laxbreak: true, undef: false, unused: false */
// SHARED by index.html (applicants) and admin.html (staff). Both sites use the SAME config.js and the SAME Supabase database.
"use strict";
var _c = window.APP_CONFIG || {};
var SUPABASE_URL = _c.SUPABASE_URL || "";
var SUPABASE_KEY = _c.SUPABASE_KEY || "";
var ENABLE_ONLINE_PAYMENT = !!_c.ENABLE_ONLINE_PAYMENT;
var PUNONG_BARANGAY = _c.PUNONG_BARANGAY || "HON. AMELIA C. CHUA";
var PUNONG_BARANGAY_TITLE = _c.PUNONG_BARANGAY_TITLE || "Punong Barangay";
var SITE_URL = _c.SITE_URL || "";
var IMAGES = Object.assign({ logo: "", banner: "", seal: "", bagongPilipinas: "", signature: "", certificateBackground: "" }, _c.IMAGES || {});
// =====================================================
//  BARANGAY NORTH FAIRVIEW eSERVICES PORTAL
//  (keys, pictures and certificate details are in config.js)
// =====================================================

// --- THEME (LIGHT / DARK) ---
function toggleTheme() {
    const body = document.body;
    const btn = document.getElementById("themeToggleBtn");
    body.classList.toggle("dark-mode");
    const dark = body.classList.contains("dark-mode");
    btn.innerHTML = (dark ? "☀️" : "🌙") + "<br>Mode";
    try { localStorage.setItem("siteTheme", dark ? "dark" : "light"); } catch (e) {}
}

// --- BACKEND CONNECTION -------------------------------
const isSet = (v) => typeof v === "string" && v.length > 0 && !v.startsWith("YOUR_");

let db = null; // Supabase client (null = demo mode)
try {
    if (isSet(SUPABASE_URL) && isSet(SUPABASE_KEY) && window.supabase) {
        db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
} catch (err) {
    console.error("Supabase init failed, running in demo mode:", err);
}

// Demo mode notice: shown on both sites so it is obvious when config.js is not filled in yet
if (!db) {
    document.addEventListener("DOMContentLoaded", () => {
        const b = document.createElement("div");
        b.className = "demo-banner";
        b.textContent = "DEMO MODE: nothing is saved online and no payment is made. Put your SUPABASE_URL and SUPABASE_KEY in config.js to go live.";
        document.body.insertBefore(b, document.body.firstChild);
    });
}

let currentCert = null; // application whose certificate is on screen (admin only)

// --- FEES (fixed by the barangay fee schedule; nobody edits them on the website) --------------
// Amounts are in centavos (100 = P1.00). The database has the SAME rules (fee_for), so the
// price can never be changed from the browser.
const BUSINESS_GROUPS = {
 "A": {
  "label": "Group A",
  "amount": 100000,
  "items": [
   "Food stalls",
   "Hawker",
   "Junk Shops/Retailer Scrap Materials",
   "Key Duplication",
   "Market Vendor",
   "Pushcart Vendor/ Street & Market Vendors",
   "E-Loading Station/Cellphone Shop",
   "Sari-sari store",
   "Shoe/Bag Repair",
   "Vulcanizing/Tire Repair"
  ]
 },
 "B": {
  "label": "Group B",
  "amount": 200000,
  "items": [
   "Bakeries/Bakeshops",
   "Car Wash",
   "Carinderia/ Mini-restaurant",
   "Computer Shop/Internet Café",
   "Entertainment/Event Organizer/Supplier",
   "Food/beverage or hospitality services, restaurants",
   "Garments / Ukay-Ukay",
   "General Store/ Hardware Store",
   "Janitorial/Cleaning Services",
   "Jewelry Making/Repair",
   "Laundry Shop",
   "Labor Services (Salon, nail services, barber shop)",
   "Pest control",
   "Pet shop",
   "Photocopying/Printing",
   "Public Utility Terminal (Tricycle)",
   "Recruitment/Manpower",
   "Sash and Wood Works",
   "Septic Tank Siphoning",
   "Softdrinks / Liquor Dealer",
   "Tailoring",
   "Upholstery",
   "Watch Repair",
   "Water refilling"
  ]
 },
 "C": {
  "label": "Group C",
  "amount": 300000,
  "items": [
   "Advertising Agency/Promotional",
   "Administration Office",
   "Air Conditioning/Refrigeration Maintenance or Repair",
   "Aluminum/Glass/Ironworks Supplier or installer",
   "Appliance Dealer",
   "Audio Repair/ Electronics/ Radio Electrical Equipment Services",
   "Auto Repair or Maintenance Shop",
   "Book and Newspaper Publishing",
   "Business and Information Services",
   "Collecting Agency",
   "Construction and Utilities Contractor/ Supplier/ Service Provider",
   "Dental Clinic",
   "Emission Testing",
   "Furniture Dealer",
   "Funeral Services/Columbarium",
   "Labor Agency",
   "Machine Shop",
   "Health Clinic/Care Center",
   "Office Equipment Dealer",
   "Security Services",
   "Technical/Vocational Services (Plumbing, Electrical, Building Maintenance/Repair, etc.)",
   "Travel Agency",
   "Veterinary Clinic"
  ]
 },
 "D": {
  "label": "Group D",
  "amount": 400000,
  "items": [
   "Car Rental Services",
   "Delivery/Courier Services",
   "Pawnshop/Micro-Lending",
   "Pharmacy",
   "Public Utility Terminal (Bus or Taxi)",
   "Schools/Education Services/Tutorial Center",
   "Public Transportation Services (Taxi, Bus, Jeepney etc.)",
   "Slaughter House",
   "Truck/Hauling"
  ]
 },
 "E": {
  "label": "Group E",
  "amount": 500000,
  "items": [
   "Auto/Truck Dealer",
   "Banks and Financial Services/Insurance/Pre-Need",
   "Condominium",
   "Gasoline Station",
   "Heavy Equipment Shop/Services",
   "Hospitals",
   "Hotel/Motel/Apartelle",
   "Industrial Manufacturing",
   "KTV Bar/Music Lounge",
   "Money Changer",
   "Night Clubs/Cocktail Lounges and Beer House",
   "Real Estate and/or Housing",
   "Shopping Mall, Supermarket",
   "Telecommunications"
  ]
 }
};
BUSINESS_GROUPS.NC  = { label: "Business not otherwise categorized", amount: 200000, items: [] };
BUSINESS_GROUPS.REG = { label: "Regulated business (DILG Memo 2003-231, 12-10-2003) - resolution required", amount: 200000, items: [] };
// Clearance fee per purpose (centavos). Edit the pesos in config.js -> CLEARANCE_FEES
const _cf = Object.assign({ "Residency": 50, "Clearance": 100, "Non Resident": 250 }, _c.CLEARANCE_FEES || {});
const CLEARANCE_FEES = {};
Object.keys(_cf).forEach((k) => { CLEARANCE_FEES[k] = Math.round(Number(_cf[k]) * 100); });
const CLEARANCE_FEE = CLEARANCE_FEES["Clearance"];            // fallback for any other purpose
const FREE_PURPOSES = ["Indigency", "Medical", "Financial"];  // no payment for these
const DEFAULT_FEES = { "Business Permit": 50000, "Barangay Clearance": CLEARANCE_FEE }; // only for old records saved before groups existed
const fees = DEFAULT_FEES;
const DOCUMENT_LABELS = {
    "Business Permit": "Barangay Business Permit",
    "Pangkabuhayan": "Barangay Clearance Pangkabuhayan",
    "Barangay Clearance": "Barangay Clearance"
};