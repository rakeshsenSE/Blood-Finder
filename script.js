/* ===================================================================
   BloodFinder — Vanilla JavaScript
   Features: Animated counters, filtering, modals, eligibility calc,
   accordion, scroll animations, toast notifications
   =================================================================== */

// ===== API BASE URL =====
const API_BASE = "http://127.0.0.1:8000/api/v1";

// ===== IN-MEMORY CACHE (populated from API) =====
let ALL_DONORS = [];

const DIVISIONS = ["Dhaka", "Chittagong", "Rajshahi", "Sylhet", "Khulna", "Barishal", "Rangpur", "Mymensingh"];

const DISTRICTS_BY_DIVISION = {
  "Dhaka": ["Dhaka", "Gazipur", "Narayanganj", "Manikganj", "Munshiganj", "Narsingdi", "Tangail"],
  "Chittagong": ["Chittagong", "Comilla", "Cox's Bazar", "Feni", "Noakhali", "Rangamati"],
  "Rajshahi": ["Rajshahi", "Bogra", "Natore", "Naogaon", "Pabna"],
  "Sylhet": ["Sylhet", "Habiganj", "Moulvibazar", "Sunamganj"],
  "Khulna": ["Khulna", "Jessore", "Satkhira", "Bagerhat", "Kushtia"],
  "Barishal": ["Barishal", "Bhola", "Patuakhali", "Pirojpur"],
  "Rangpur": ["Rangpur", "Dinajpur", "Kurigram", "Gaibandha", "Thakurgaon"],
  "Mymensingh": ["Mymensingh", "Jamalpur", "Netrokona", "Sherpur"],
};

// ===== CONSTANTS =====
const DONATION_INTERVAL_DAYS = 120; // 4 months gap between donations

// ===== DOM READY =====
document.addEventListener("DOMContentLoaded", async () => {
  initHeader();
  renderNavAuth();          // render sign-in button or user info
  populateDivisionDropdowns();
  initDonorSearch();
  initGeolocation();       // wire up GPS location detection
  initEligibilityCalc();
  initModals();
  initHospitalSearch();     // wire up nearby hospital search
  initScrollAnimations();

  // Load everything from the API in parallel
  await Promise.all([
    loadStats(),
    loadDonors(),
    loadBloodBanks(),
  ]);
});

// ===== API HELPERS =====
async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ===== HEADER =====
function initHeader() {
  const header = document.querySelector(".header");
  const hamburger = document.querySelector(".hamburger");
  const navLinks = document.querySelector(".nav-links");

  // Scroll effect
  window.addEventListener("scroll", () => {
    header.classList.toggle("scrolled", window.scrollY > 20);
  });

  // Mobile toggle
  hamburger.addEventListener("click", () => {
    hamburger.classList.toggle("active");
    navLinks.classList.toggle("open");
  });

  // Close mobile nav on link click
  navLinks.querySelectorAll("a:not(.btn-cta)").forEach(link => {
    link.addEventListener("click", () => {
      hamburger.classList.remove("active");
      navLinks.classList.remove("open");
    });
  });
}

// ===== AUTH STATE MANAGEMENT =====
function getCurrentUserEmail() {
  return localStorage.getItem('currentUserEmail') || null;
}

function renderNavAuth() {
  const navLinks = document.getElementById('navLinks');
  const existingSignIn = document.getElementById('nav-signin-btn');
  const existingChip = document.querySelector('.user-profile-chip');

  // Clean up any previously injected chip
  if (existingChip) existingChip.remove();

  const email = getCurrentUserEmail();

  if (email) {
    // Signed in: hide sign-in button, inject compact profile chip
    if (existingSignIn) existingSignIn.style.display = 'none';

    const chip = document.createElement('div');
    chip.className = 'user-profile-chip';
    chip.innerHTML = `
      <span class="nav-user-email" title="${email}">${email}</span>
      <button id="nav-signout-btn">Sign Out</button>
    `;

    // Insert chip before the CTA button
    const ctaBtn = navLinks.querySelector('.btn-cta');
    navLinks.insertBefore(chip, ctaBtn);

    document.getElementById('nav-signout-btn').addEventListener('click', () => {
      localStorage.removeItem('currentUserEmail');
      renderNavAuth();
      renderDonors(ALL_DONORS);   // re-render cards so buttons revert to locked state
    });
  } else {
    // Signed out: show sign-in button
    if (existingSignIn) existingSignIn.style.display = '';
  }
}

// ===== LIVE STATS — loaded from backend =====
async function loadStats() {
  try {
    // Stats endpoint is kept but Lives Saved card has been removed
    const stats = await apiFetch("/stats");
    void stats; // intentionally unused after Lives Saved removal
  } catch (e) {
    console.error("Could not load stats:", e);
  }
}

function updateStatUI(elementId, value) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const currentVal = parseInt(el.textContent.replace(/[^0-9]/g, '') || '0', 10);
  animateNumber(el, currentVal, value, 1000);

  const card = el.closest('.stat-card');
  if (card) {
    card.classList.remove('pulse-update');
    void card.offsetWidth;
    card.classList.add('pulse-update');
  }
}

function animateNumber(element, start, end, duration) {
  if (!element) return;
  const suffix = element.getAttribute('data-suffix') || "";
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // Ease-out cubic
    const current = Math.floor(start + (end - start) * eased);

    element.textContent = current.toLocaleString() + suffix;

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = end.toLocaleString() + suffix;
    }
  }
  requestAnimationFrame(update);
}

// ===== POPULATE DIVISION DROPDOWNS =====
function populateDivisionDropdowns() {
  const heroDiv = document.getElementById("searchDivision");
  const heroDistrict = document.getElementById("searchDistrict");
  const regDiv = document.getElementById("regDistrict");

  // Populate hero division (যদি select ট্যাগ হয়)
  if (heroDiv && heroDiv.tagName === "SELECT") {
    DIVISIONS.forEach(div => {
      if (!Array.from(heroDiv.options).some(opt => opt.value === div)) {
        heroDiv.add(new Option(div, div));
      }
    });

    heroDiv.addEventListener("change", () => {
      if (heroDistrict && heroDistrict.tagName === "SELECT") {
        heroDistrict.innerHTML = '<option value="">All Districts</option>';
        const districts = DISTRICTS_BY_DIVISION[heroDiv.value] || [];
        districts.forEach(d => heroDistrict.add(new Option(d, d)));
      }
    });
  }

  // Populate reg district/division
  if (regDiv && regDiv.tagName === "SELECT") {
    DIVISIONS.forEach(div => {
      if (!Array.from(regDiv.options).some(opt => opt.value === div)) {
        regDiv.add(new Option(div, div));
      }
    });
  }
}

// ===== SKELETON SHIMMER PLACEHOLDERS =====
function renderDonorsSkeleton(container) {
  if (!container) return;
  container.innerHTML = Array(6).fill(0).map(() => `
    <div class="skeleton-card">
      <div style="display: flex; gap: 12px; align-items: center;">
        <div class="skeleton-avatar"></div>
        <div style="flex: 1;">
          <div class="skeleton-line" style="width: 60%; margin-bottom: 6px;"></div>
          <div class="skeleton-line" style="width: 40%;"></div>
        </div>
      </div>
      <div class="skeleton-line" style="width: 100%;"></div>
      <div class="skeleton-line" style="width: 80%;"></div>
    </div>
  `).join('');
}

function renderBanksSkeleton(container) {
  if (!container) return;
  container.innerHTML = Array(4).fill(0).map(() => `
    <div class="skeleton-card">
      <div class="skeleton-line" style="width: 70%; margin-bottom: 8px;"></div>
      <div class="skeleton-line" style="width: 50%;"></div>
    </div>
  `).join('');
}

// ===== LOAD DONORS FROM API (with 0ms localStorage Caching) =====
async function loadDonors(blood_group = "", division = "", district = "") {
  blood_group = blood_group.trim();
  division    = division.trim();
  district    = district.trim();

  const grid = document.getElementById("donorsGrid");
  const isFilterActive = Boolean(blood_group || division || district);

  // 1. Instant cache rendering for zero filter latency
  if (!isFilterActive) {
    const cached = localStorage.getItem("bloodfinder_cache_donors");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          ALL_DONORS = parsed;
          renderDonors(parsed);
          updateStatUI('count-donors', parsed.length);
        }
      } catch (e) {
        console.warn("Cache parse error:", e);
      }
    }
  }

  // Show shimmer skeletons if empty
  if (!grid.children.length) {
    renderDonorsSkeleton(grid);
  }

  try {
    const params = new URLSearchParams();
    if (blood_group) params.append("blood_group", blood_group);
    if (division)    params.append("division", division);
    if (district)    params.append("district", district);

    const donors = await apiFetch(`/donors?${params.toString()}`);
    ALL_DONORS = donors;

    if (!isFilterActive) {
      localStorage.setItem("bloodfinder_cache_donors", JSON.stringify(donors));
      updateStatUI('count-donors', donors.length);
    }

    renderDonors(donors);
  } catch (e) {
    if (!ALL_DONORS.length) {
      grid.innerHTML = `
        <div class="empty-state-card">
          <div class="icon">⚠️</div>
          <h3>Could Not Load Donors</h3>
          <p>${e.message}</p>
          <button class="btn-reset-filters" onclick="resetFilters()">🔄 Retry Loading</button>
        </div>`;
    }
    console.error("loadDonors error:", e);
  }
}

// ===== DEBOUNCE HELPER =====
function debounce(func, wait = 300) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// ===== DONOR SEARCH / FILTER (Live Debounced) =====
function initDonorSearch() {
  const searchBtn = document.getElementById("btnSearch");
  if (searchBtn) searchBtn.addEventListener("click", filterDonors);

  const debouncedFilter = debounce(() => filterDonors(), 350);

  ["searchBlood", "searchDivision", "searchDistrict"].forEach(id => {
    const inputEl = document.getElementById(id);
    if (inputEl) {
      inputEl.addEventListener("input", debouncedFilter);
      inputEl.addEventListener("change", filterDonors);
    }
  });
}

function filterDonors() {
  const blood    = (document.getElementById("searchBlood").value || '').trim();
  const division = (document.getElementById("searchDivision").value || '').toLowerCase().trim();
  const district = (document.getElementById("searchDistrict").value || '').toLowerCase().trim();

  loadDonors(blood, division, district);
}

// ===== RESET FILTERS ACTION =====
function resetFilters() {
  const blood = document.getElementById("searchBlood");
  const div   = document.getElementById("searchDivision");
  const dist  = document.getElementById("searchDistrict");
  if (blood) blood.value = "";
  if (div)   div.value = "";
  if (dist)  dist.value = "";
  loadDonors("", "", "");
  showToast("Filters reset to show all donors.", "info");
}

// ===== RENDER DONOR CARDS =====
function renderDonors(donors) {
  const grid = document.getElementById("donorsGrid");

  if (!donors || donors.length === 0) {
    grid.innerHTML = `
      <div class="empty-state-card">
        <div class="icon">🔍</div>
        <h3>No Matching Donors Found</h3>
        <p>We couldn't find any verified donors matching your search criteria. Try expanding your location filter or resetting filters.</p>
        <button class="btn-reset-filters" onclick="resetFilters()">🔄 Reset Filters</button>
      </div>`;
    return;
  }

  const currentUserEmail = getCurrentUserEmail();
  const isLoggedIn = Boolean(currentUserEmail);

  grid.innerHTML = donors.map(donor => buildDonorCardHTML(donor, isLoggedIn)).join("");
  initScrollAnimations();
}

// ===== CONTACT GUARD — called when donor button clicked while logged out =====
function requireSignIn() {
  openModal(document.getElementById('signin-modal'));
}

// ===== LOG CONTACT — background audit call =====
function logContact(donorId) {
  const email = getCurrentUserEmail();
  if (!email) return;
  fetch(`${API_BASE}/log-contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ viewer_email: email, donor_id: donorId }),
  }).catch(err => console.warn('Contact log failed:', err));
}

// ===== ELIGIBILITY LOGIC =====
function getEligibility(lastDonationDate) {
  const lastDate = new Date(lastDonationDate);
  const today = new Date();
  const diffDays = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
  const daysLeft = DONATION_INTERVAL_DAYS - diffDays;

  return {
    ready: daysLeft <= 0,
    daysLeft: Math.max(0, daysLeft),
    daysSince: diffDays,
  };
}

// ===== ELIGIBILITY CALCULATOR =====
function initEligibilityCalc() {
  const btn = document.getElementById("btnCalcEligibility");
  const input = document.getElementById("calcLastDonation");
  const result = document.getElementById("calcResult");

  btn.addEventListener("click", () => {
    const dateVal = input.value;
    if (!dateVal) {
      showToast("Please select your last donation date.", "error");
      return;
    }

    const eligibility = getEligibility(dateVal);
    result.classList.add("show");

    if (eligibility.ready) {
      result.className = "calc-result show ready";
      result.innerHTML = `
        <div class="result-icon">🎉</div>
        <div class="result-text">
          <strong>You're eligible to donate!</strong><br>
          It's been <strong>${eligibility.daysSince} days</strong> since your last donation. You can save a life today!
        </div>`;
    } else {
      const nextDate = new Date(dateVal);
      nextDate.setDate(nextDate.getDate() + DONATION_INTERVAL_DAYS);
      const formatted = nextDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

      result.className = "calc-result show not-ready";
      result.innerHTML = `
        <div class="result-icon">⏰</div>
        <div class="result-text">
          <strong>${eligibility.daysLeft} more days to go!</strong><br>
          You'll be eligible again on <strong>${formatted}</strong>. Thank you for your generosity!
        </div>`;
    }
  });
}

// ===== GEOLOCATION AUTO-DETECTION =====
const BD_CITIES = [
  { name: "Dhaka", division: "Dhaka", lat: 23.8103, lng: 90.4125 },
  { name: "Chittagong", division: "Chittagong", lat: 22.3569, lng: 91.7832 },
  { name: "Rajshahi", division: "Rajshahi", lat: 24.3745, lng: 88.6042 },
  { name: "Sylhet", division: "Sylhet", lat: 24.8949, lng: 91.8687 },
  { name: "Khulna", division: "Khulna", lat: 22.8456, lng: 89.5403 },
  { name: "Barishal", division: "Barishal", lat: 22.7010, lng: 90.3535 },
  { name: "Rangpur", division: "Rangpur", lat: 25.7439, lng: 89.2752 },
  { name: "Mymensingh", division: "Mymensingh", lat: 24.7471, lng: 90.4203 }
];

function initGeolocation() {
  const geoBtn = document.getElementById('btnGeoLocation');
  const geoNearbyBtn = document.getElementById('btnGeoNearby');

  if (geoBtn) {
    geoBtn.addEventListener('click', () => detectUserLocation('hero'));
  }
  if (geoNearbyBtn) {
    geoNearbyBtn.addEventListener('click', () => detectUserLocation('nearby'));
  }
}

function detectUserLocation(source = 'hero') {
  if (!navigator.geolocation) {
    showToast("Geolocation is not supported by your browser.", "error");
    return;
  }

  showToast("📍 Detecting your GPS location…", "info");

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const userLat = pos.coords.latitude;
      const userLng = pos.coords.longitude;

      let closestCity = BD_CITIES[0];
      let minDist = Infinity;

      BD_CITIES.forEach(city => {
        const dist = Math.hypot(city.lat - userLat, city.lng - userLng);
        if (dist < minDist) {
          minDist = dist;
          closestCity = city;
        }
      });

      if (source === 'hero') {
        const divInput = document.getElementById("searchDivision");
        const distInput = document.getElementById("searchDistrict");
        if (divInput) divInput.value = closestCity.division;
        if (distInput) distInput.value = closestCity.name;
        filterDonors();
        showToast(`📍 Location detected: ${closestCity.name}, ${closestCity.division}`, "success");
      } else if (source === 'nearby') {
        const hospInput = document.getElementById("hospital-search-input");
        if (hospInput) hospInput.value = closestCity.name;
        searchNearbyDonors();
        showToast(`📍 Nearby location set to ${closestCity.name}`, "success");
      }
    },
    (err) => {
      console.warn("Geolocation error:", err);
      showToast("Could not detect location. Please type your city/district.", "error");
    },
    { timeout: 10000, enableHighAccuracy: true }
  );
}

// ===== QUICK ACTIONS & SHARE HELPERS =====
function copyPhoneNumber(phone, donorId) {
  const email = getCurrentUserEmail();
  if (!email) {
    requireSignIn();
    return;
  }
  if (donorId) logContact(donorId);

  const cleanPhone = (phone || '').replace(/[^+\d]/g, '');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(cleanPhone).then(() => {
      showToast(`📋 Phone number copied: ${cleanPhone}`, 'success');
    }).catch(() => {
      showToast(`Phone number: ${cleanPhone}`, 'info');
    });
  } else {
    showToast(`Phone number: ${cleanPhone}`, 'info');
  }
}

function shareDonorCard(name, bloodGroup, district, phone) {
  const text = `🩸 BloodFinder — ${name} (${bloodGroup}) is ready to donate blood in ${district}. Contact: ${phone}`;
  if (navigator.share) {
    navigator.share({ title: `Blood Donor: ${name}`, text: text, url: window.location.href })
      .catch(() => copyToClipboardFallback(text, "Donor contact details copied to clipboard!"));
  } else {
    copyToClipboardFallback(text, "Donor contact details copied to clipboard!");
  }
}

function shareBankCard(name, location, phone) {
  const text = `🏛️ BloodBank Directory: ${name} | Location: ${location} | Contact: ${phone}`;
  if (navigator.share) {
    navigator.share({ title: `Blood Bank: ${name}`, text: text, url: window.location.href })
      .catch(() => copyToClipboardFallback(text, "Blood bank details copied to clipboard!"));
  } else {
    copyToClipboardFallback(text, "Blood bank details copied to clipboard!");
  }
}

function copyToClipboardFallback(text, toastMsg) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(`📋 ${toastMsg}`, 'success');
    });
  } else {
    showToast(`ℹ️ ${text}`, 'info');
  }
}

// ===== HOSPITAL NEARBY DONOR SEARCH =====
function initHospitalSearch() {
  const btn = document.getElementById('btn-search-nearby');
  const input = document.getElementById('hospital-search-input');
  if (!btn || !input) return;

  btn.addEventListener('click', searchNearbyDonors);

  const debouncedNearby = debounce(() => {
    if (input.value.trim().length >= 2) searchNearbyDonors();
  }, 400);

  input.addEventListener('input', debouncedNearby);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchNearbyDonors();
  });
}

async function searchNearbyDonors() {
  const input   = document.getElementById('hospital-search-input');
  const results = document.getElementById('hospital-donors-results');
  const query   = (input.value || '').toLowerCase().trim();

  if (!query) {
    results.innerHTML = `<div class="nearby-empty"><div class="icon">💡</div><h3>Enter a hospital or area name to search</h3></div>`;
    return;
  }

  renderDonorsSkeleton(results);

  try {
    const params = new URLSearchParams({ hospital_or_area: query });
    const donors = await apiFetch(`/donors?${params.toString()}`);

    const allMatched = ALL_DONORS.filter(d => {
      const haystack = [d.district || '', d.upazila || '', d.division || ''].join(' ').toLowerCase();
      return haystack.includes(query);
    });

    const idsSeen = new Set(donors.map(d => d.id));
    const merged  = [...donors, ...allMatched.filter(d => !idsSeen.has(d.id))];

    if (merged.length === 0) {
      results.innerHTML = `
        <div class="empty-state-card">
          <div class="icon">📍</div>
          <h3>No Donors Found Nearby</h3>
          <p>No donors found within 1-5 km of this hospital or area. Try expanding your search location.</p>
        </div>`;
      return;
    }

    const currentUserEmail = getCurrentUserEmail();
    const isLoggedIn = Boolean(currentUserEmail);

    results.innerHTML = `<div class="donors-grid">${merged.map(donor => buildDonorCardHTML(donor, isLoggedIn)).join('')}</div>`;
    initScrollAnimations();
  } catch (e) {
    results.innerHTML = `<div class="nearby-empty"><div class="icon">⚠️</div><h3>Search failed</h3><p>${e.message}</p></div>`;
    console.error('searchNearbyDonors error:', e);
  }
}

// Shared helper: builds a single donor card HTML string (used by renderDonors + nearby search)
function buildDonorCardHTML(donor, isLoggedIn) {
  const blood = donor.blood_group || '';
  const lastDon = donor.last_donation_date || null;
  const eligibility = lastDon ? getEligibility(lastDon) : { ready: false, daysLeft: 9999 };
  const initials = donor.name.split(' ').map(n => n[0]).join('').slice(0, 2);
  const formattedDate = lastDon
    ? new Date(lastDon).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'N/A';

  const phoneRaw = donor.phone.replace(/[^+\d]/g, '');
  const waPhone  = phoneRaw.startsWith('+') ? phoneRaw.slice(1) : phoneRaw;
  const waText   = encodeURIComponent(`Looking for ${blood} blood donor: ${donor.name} — ${donor.phone}`);

  let callBtn, waBtn, copyBtn;
  if (isLoggedIn) {
    callBtn = `<a class="btn-call" href="tel:${phoneRaw}" id="call-${donor.id}" onclick="logContact(${donor.id})">📞 Call</a>`;
    waBtn   = `<a class="btn-whatsapp" href="https://wa.me/${waPhone}?text=${waText}" target="_blank" rel="noopener" id="wa-${donor.id}" onclick="logContact(${donor.id})">💬 WhatsApp</a>`;
    copyBtn = `<button class="btn-copy-num" onclick="copyPhoneNumber('${phoneRaw}', ${donor.id})">📋 Copy</button>`;
  } else {
    callBtn = `<button class="btn-call" id="call-${donor.id}" onclick="requireSignIn()">📞 Call</button>`;
    waBtn   = `<button class="btn-whatsapp" id="wa-${donor.id}" onclick="requireSignIn()">💬 WhatsApp</button>`;
    copyBtn = `<button class="btn-copy-num" onclick="requireSignIn()">📋 Copy</button>`;
  }

  const shareBtn = `<button class="btn-share" onclick="shareDonorCard('${donor.name.replace(/'/g, "\\'")}', '${blood}', '${donor.district.replace(/'/g, "\\'")}', '${phoneRaw}')">🔗 Share</button>`;

  return `
    <div class="donor-card animate-on-scroll">
      <div class="donor-card-header">
        <div class="donor-avatar">${initials}</div>
        <div class="donor-info">
          <h3>${donor.name} ${donor.verified ? '<span class="verified-badge">✓ Verified</span>' : ''}</h3>
          <p>📍 ${donor.upazila ? donor.upazila + ', ' : ''}${donor.district}</p>
        </div>
        <div class="blood-badge">${blood}</div>
      </div>
      <div class="donor-details">
        <div class="detail-item"><span class="icon">🏥</span> ${donor.division} Division</div>
        <div class="detail-item"><span class="icon">📅</span> Last: ${formattedDate}</div>
      </div>
      <div class="eligibility-status ${eligibility.ready ? 'ready' : 'not-ready'}">
        ${eligibility.ready ? '✅ Ready to Donate' : `⏳ Eligible in ${eligibility.daysLeft} days`}
      </div>
      <div class="donor-actions">
        ${callBtn}
        ${waBtn}
        ${copyBtn}
        ${shareBtn}
      </div>
    </div>`;
}

// ===== LOAD & RENDER BLOOD BANKS FROM API (with localStorage caching) =====
async function loadBloodBanks() {
  const grid = document.getElementById("banksGrid");

  // 1. Instant cache check
  const cached = localStorage.getItem("bloodfinder_cache_banks");
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        renderBloodBanks(parsed);
      }
    } catch (e) {
      console.warn("Banks cache parse error:", e);
    }
  }

  if (!grid.children.length) {
    renderBanksSkeleton(grid);
  }

  try {
    const banks = await apiFetch("/blood-banks");
    localStorage.setItem("bloodfinder_cache_banks", JSON.stringify(banks));
    renderBloodBanks(banks);
  } catch (e) {
    if (!grid.children.length) {
      grid.innerHTML = `
        <div class="empty-state-card">
          <div class="icon">⚠️</div>
          <h3>Could Not Load Blood Banks</h3>
          <p>${e.message}</p>
        </div>`;
    }
    console.error("loadBloodBanks error:", e);
  }
}

function renderBloodBanks(banks) {
  const grid = document.getElementById("banksGrid");

  if (!banks || banks.length === 0) {
    grid.innerHTML = `
      <div class="empty-state-card">
        <div class="icon">🏛️</div>
        <h3>No Blood Banks Directory Found</h3>
        <p>Currently no blood banks are registered in this view.</p>
      </div>`;
    return;
  }

  grid.innerHTML = banks.map((bank, i) => {
    const cleanPhone = bank.phone.replace(/[^+\d]/g, '');
    return `
      <div class="bank-card animate-on-scroll" data-bank="${i}">
        <div class="bank-card-header" onclick="toggleBank(event, ${i})" aria-expanded="false" role="button" tabindex="0">
          <div class="bank-info">
            <div class="bank-icon">🏛️</div>
            <div>
              <h3>${bank.name}</h3>
              <p>${bank.location.split(",").pop().trim()}</p>
            </div>
          </div>
          <div class="bank-toggle">▼</div>
        </div>
        <div class="bank-card-body">
          <div class="bank-card-content">
            <div class="bank-detail"><span class="icon">📍</span> ${bank.location}</div>
            <div class="bank-detail"><span class="icon">🕐</span> ${bank.operating_hours || bank.hours || ""}</div>
            <div class="bank-detail"><span class="icon">🩺</span> ${bank.services}</div>
            <div style="display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap;">
              <a href="tel:${cleanPhone}" class="btn-bank-call" style="flex: 1;">📞 Call ${bank.phone}</a>
              <button class="btn-copy-num" style="flex: 1;" onclick="copyPhoneNumber('${cleanPhone}', null)">📋 Copy</button>
              <button class="btn-share" style="width: 100%; margin-top: 4px;" onclick="shareBankCard('${bank.name.replace(/'/g, "\\'")}', '${bank.location.replace(/'/g, "\\'")}', '${cleanPhone}')">🔗 Share Bank</button>
            </div>
          </div>
        </div>
      </div>`;
  }).join("");

  initScrollAnimations();
}

// BUG FIX: Strictly isolate bank accordion toggles
function toggleBank(event, index) {
  if (event && event.stopPropagation) event.stopPropagation();

  let card = event && event.currentTarget ? event.currentTarget.closest('.bank-card') : null;
  if (!card) card = document.querySelector(`[data-bank="${index}"]`);
  if (!card) return;

  // Close other open cards cleanly
  document.querySelectorAll(".bank-card.open").forEach(c => {
    if (c !== card) {
      c.classList.remove("open");
      const h = c.querySelector('.bank-card-header');
      if (h) h.setAttribute('aria-expanded', 'false');
    }
  });

  const isOpen = card.classList.contains("open");
  card.classList.toggle("open");

  const header = card.querySelector('.bank-card-header');
  if (header) {
    header.setAttribute('aria-expanded', !isOpen);
  }
}

// ===== MODALS =====
function initModals() {
  // Register modal
  const regOverlay = document.getElementById("registerModal");
  const regOpenBtns = document.querySelectorAll("[data-open-register]");
  const regClose = document.getElementById("closeRegister");

  regOpenBtns.forEach(btn => btn.addEventListener("click", () => openModal(regOverlay)));
  regClose.addEventListener("click", () => closeModal(regOverlay));
  regOverlay.addEventListener("click", (e) => { if (e.target === regOverlay) closeModal(regOverlay); });

  // Request Blood modal
  const reqOverlay = document.getElementById("requestModal");
  const reqOpenBtns = document.querySelectorAll("[data-open-request]");
  const reqClose = document.getElementById("closeRequest");

  reqOpenBtns.forEach(btn => btn.addEventListener("click", () => openModal(reqOverlay)));
  reqClose.addEventListener("click", () => closeModal(reqOverlay));
  reqOverlay.addEventListener("click", (e) => { if (e.target === reqOverlay) closeModal(reqOverlay); });

  // ===== Sign-In Modal (Emergency Speed Access) =====
  const signinOverlay = document.getElementById("signin-modal");
  const signinBtn    = document.getElementById("nav-signin-btn");
  const signinClose  = document.getElementById("close-modal-btn");
  const signinSubmit = document.getElementById("signin-submit-btn");
  const signinForm   = document.getElementById("signin-form");
  const emailInput   = document.getElementById("user-email-input");
  const googleBtn    = document.getElementById("google-signin-btn");

  if (signinBtn) {
    signinBtn.addEventListener("click", () => openModal(signinOverlay));
  }
  if (signinClose) {
    signinClose.addEventListener("click", () => closeModal(signinOverlay));
  }
  if (signinOverlay) {
    signinOverlay.addEventListener("click", (e) => {
      if (e.target === signinOverlay) closeModal(signinOverlay);
    });
  }

  function handleQuickSignIn(identifier, providerName = null) {
    const val = (identifier || '').trim();
    if (!val || val.length < 3) {
      showToast('Please enter a valid email or phone number.', 'error');
      return;
    }

    localStorage.setItem('currentUserEmail', val);
    closeModal(signinOverlay);
    if (emailInput) emailInput.value = '';
    renderNavAuth();
    renderDonors(ALL_DONORS);   // re-render so donor cards become unlocked immediately

    // Also update hospital search results if displayed
    const hospitalResults = document.getElementById('hospital-donors-results');
    if (hospitalResults && hospitalResults.children.length > 0) {
      const input = document.getElementById('hospital-search-input');
      if (input && input.value.trim()) {
        searchNearbyDonors();
      }
    }

    const toastMsg = providerName
      ? `✅ Signed in via ${providerName} as ${val}!`
      : `✅ Emergency access granted for ${val}!`;
    showToast(toastMsg, 'success');
  }

  // ===== GOOGLE OAUTH CLIENT CONFIGURATION =====
  const GOOGLE_CLIENT_ID = "899075634630-7ur3p9414k1q4krqbh07djdioclp3cs1.apps.googleusercontent.com";

  // Google Credential Response Handler (JWT Decoder)
  function handleCredentialResponse(response) {
    if (!response || !response.credential) {
      showToast('Google Sign-In was not completed.', 'error');
      return;
    }
    try {
      // Decode JWT payload using Base64 decoding: JSON.parse(atob(response.credential.split('.')[1]))
      const base64Url = response.credential.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const payload = JSON.parse(jsonPayload);
      const realEmail = payload && payload.email;

      if (realEmail) {
        // Save real email to localStorage
        localStorage.setItem('currentUserEmail', realEmail);

        // Update UI immediately
        closeModal(signinOverlay);
        if (emailInput) emailInput.value = '';
        renderNavAuth();           // update navbar user profile chip
        renderDonors(ALL_DONORS);  // unlock donor contact details immediately

        // Also update hospital search results if displayed
        const hospitalResults = document.getElementById('hospital-donors-results');
        if (hospitalResults && hospitalResults.children.length > 0) {
          const input = document.getElementById('hospital-search-input');
          if (input && input.value.trim()) {
            searchNearbyDonors();
          }
        }

        showToast(`✅ Signed in as ${realEmail}`, 'success');
      } else {
        showToast('Could not extract email from Google credential.', 'error');
      }
    } catch (err) {
      console.error('Error decoding Google JWT credential:', err);
      showToast('Error processing Google Sign-In credential.', 'error');
    }
  }

  // Expose global credential handler for GSI script
  window.handleCredentialResponse = handleCredentialResponse;
  window.handleGoogleCredentialResponse = handleCredentialResponse;

  // Initialize & render Google Identity Services (GSI)
  function initGoogleGSI() {
    if (window.google && window.google.accounts && window.google.accounts.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
          auto_select: false,
        });

        const container = document.getElementById("g_id_signin_container");
        if (container) {
          container.innerHTML = "";
          window.google.accounts.id.renderButton(container, {
            theme: "outline",
            size: "large",
            width: "360",
            text: "signin_with",
          });
          // Hide redundant custom button if official button successfully renders
          if (googleBtn) googleBtn.style.display = "none";
        }
      } catch (err) {
        console.warn("GSI render button warning:", err);
      }
    }
  }

  // Attempt initial render
  initGoogleGSI();
  window.addEventListener('load', initGoogleGSI);

  if (signinForm) {
    signinForm.addEventListener("submit", (e) => {
      e.preventDefault();
      handleQuickSignIn(emailInput ? emailInput.value : '');
    });
  } else if (signinSubmit) {
    signinSubmit.addEventListener("click", () => {
      handleQuickSignIn(emailInput ? emailInput.value : '');
    });
  }

  if (googleBtn) {
    googleBtn.addEventListener("click", () => {
      if (window.google && window.google.accounts && window.google.accounts.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse,
          });
          window.google.accounts.id.prompt();
          return;
        } catch (e) {
          console.warn("GSI prompt failed:", e);
        }
      }

      // Fallback if GSI script is blocked: ask for user's actual email (no mock emails)
      const enteredInput = emailInput ? emailInput.value.trim() : '';
      if (enteredInput && enteredInput.length >= 3) {
        handleQuickSignIn(enteredInput, 'Google');
      } else {
        const userProvidedEmail = prompt("Please enter your actual Google or personal email address:");
        if (userProvidedEmail && userProvidedEmail.trim().length >= 3) {
          handleQuickSignIn(userProvidedEmail.trim(), 'Google');
        } else if (emailInput) {
          emailInput.focus();
          showToast('Please enter a valid email address.', 'error');
        }
      }
    });
  }

  // Form submissions wired to API
  document.getElementById("registerForm").addEventListener("submit", handleRegister);
  document.getElementById("requestForm").addEventListener("submit", handleRequest);

  // ESC to close all modals
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal(regOverlay);
      closeModal(reqOverlay);
      closeModal(signinOverlay);
    }
  });
}

function openModal(overlay) {
  if (!overlay) return;
  overlay.classList.add("active");
  document.body.style.overflow = "hidden";
  if (overlay.id === "signin-modal") {
    const input = document.getElementById("user-email-input");
    if (input) setTimeout(() => input.focus(), 150);
  }
}

function closeModal(overlay) {
  overlay.classList.remove("active");
  document.body.style.overflow = "";
}

// ===== REGISTER DONOR — POST to /api/v1/donors =====
async function handleRegister(e) {
  e.preventDefault();
  const form = e.target;
  const agree = form.querySelector("#regAgree");
  if (!agree.checked) {
    showToast("Please agree to the privacy policy.", "error");
    return;
  }

  const submitBtn = form.querySelector("button[type='submit']");
  submitBtn.disabled = true;
  submitBtn.textContent = "Registering…";

  const payload = {
    name: form.querySelector("#regName").value.trim(),
    phone: form.querySelector("#regPhone").value.trim(),
    blood_group: form.querySelector("#regBlood").value,
    division: form.querySelector("#regDistrict").value, // dropdown is labelled District but holds division
    district: form.querySelector("#regDistrict").value,
    upazila: form.querySelector("#regUpazila").value.trim(),
    last_donation_date: form.querySelector("#regLastDonation").value || null,
  };

  try {
    await apiFetch("/donors", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    showToast("🎉 Registration successful! Thank you for joining BloodFinder.", "success");
    form.reset();
    closeModal(document.getElementById("registerModal"));
    // Refresh donor list
    loadDonors();
  } catch (err) {
    showToast(`❌ Registration failed: ${err.message}`, "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Register as Donor";
  }
}

// ===== SOS REQUEST — POST to /api/v1/sos-requests =====
async function handleRequest(e) {
  e.preventDefault();
  const form = e.target;

  const submitBtn = form.querySelector("button[type='submit']");
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting…";

  const payload = {
    patient_name: form.querySelector("#reqPatient").value.trim(),
    blood_group: form.querySelector("#reqBlood").value,
    bags_needed: parseInt(form.querySelector("#reqBags").value, 10),
    hospital_name: form.querySelector("#reqHospital").value.trim(),
    urgency: form.querySelector("#reqUrgency").value,
    contact_number: form.querySelector("#reqContact").value.trim(),
    notes: form.querySelector("#reqNote").value.trim() || null,
  };

  try {
    await apiFetch("/sos-requests", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    showToast("🚨 Blood request submitted! Donors will be notified immediately.", "success");
    form.reset();
    closeModal(document.getElementById("requestModal"));
    // Refresh SOS feed
    loadSOSRequests();
  } catch (err) {
    showToast(`❌ Request failed: ${err.message}`, "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit Urgent Request";
  }
}

// ===== SHARE FUNCTIONS =====
function shareWhatsApp(text) {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
}

function shareFacebook(text) {
  window.open(`https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(text)}`, "_blank");
}

// ===== TOAST NOTIFICATION =====
function showToast(message, type = "success") {
  // Remove existing
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === "success" ? "✅" : "⚠️"}</span> ${message}`;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

// ===== SCROLL ANIMATIONS =====
function initScrollAnimations() {
  const elements = document.querySelectorAll(".animate-on-scroll:not(.visible)");
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.classList.add("visible");
        }, i * 80);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: "0px 0px -40px 0px" });

  elements.forEach(el => observer.observe(el));
}

