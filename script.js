/* ===================================================================
   BloodFinder — Vanilla JavaScript
   Features: Animated counters, filtering, modals, eligibility calc,
   accordion, scroll animations, toast notifications
   =================================================================== */

// ===== API BASE URL =====
const API_BASE = "https://ckl15rq6-8000.asse.devtunnels.ms/api/v1";

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
  initHealthTipsScroll();   // wire up automated smooth scrolling health tips
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
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    if (err.name === 'TypeError' && err.message && err.message.includes('fetch')) {
      throw new Error('Server connection offline');
    }
    throw err;
  }
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

// ===== POPULATE REGISTRATION DIVISION/DISTRICT DROPDOWN =====
function populateDivisionDropdowns() {
  const regDiv = document.getElementById("regDistrict");

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

// ===== PAGINATION STATE =====
let currentPage = 1;
let currentFilters = { blood_group: "", district: "" };

// ===== LOAD DONORS FROM API — Pagination-aware (Task 3 fix) =====
async function loadDonors(blood_group = "", district = "", page = 1) {
  blood_group = (blood_group || "").trim();
  district    = (district || "").trim();

  // Store filters for pagination navigation
  currentFilters = { blood_group, district };
  currentPage = page;

  const grid = document.getElementById("donorsGrid");
  if (!grid) return;

  const isFilterActive = Boolean(blood_group || district);

  // Show shimmer skeletons immediately
  if (!grid.children.length || page === 1) {
    renderDonorsSkeleton(grid);
  }

  try {
    const params = new URLSearchParams();
    if (blood_group) params.append("blood_group", blood_group);
    if (district)    params.append("district", district);
    params.append("page", page);
    params.append("limit", 6);

    const response = await apiFetch(`/donors?${params.toString()}`);
    const donors      = (response && response.donors) ? response.donors : (Array.isArray(response) ? response : []);
    const totalPages  = (response && response.total_pages) ? response.total_pages : 1;
    const totalCount  = (response && response.total_count) ? response.total_count : 0;
    const currentPg   = (response && response.current_page) ? response.current_page : 1;

    ALL_DONORS = donors;

    if (!isFilterActive && page === 1) {
      updateStatUI('count-donors', totalCount);
    }

    renderDonors(donors);
    renderPagination(currentPg, totalPages);
  } catch (e) {
    console.error("Search API Error:", e);
    const errorMsg = escapeHTML(e.message || 'Server connection offline');
    showToast(`Search error: ${e.message || 'Server offline'}`, "error");
    grid.innerHTML = `
      <div class="empty-state-card">
        <div class="icon">🔍</div>
        <h3>No Donors Found</h3>
        <p>Could not connect to donor backend (${errorMsg}). Please check server connection or reset filters.</p>
        <button class="btn-reset-filters" onclick="resetFilters()">🔄 Reset Filters</button>
      </div>`;
    const paginationEl = document.getElementById("donorsPagination");
    if (paginationEl) paginationEl.innerHTML = "";
  }
}

// ===== PAGINATION UI RENDERER (Task 3 fix) =====
function renderPagination(currentPg, totalPages) {
  // Find or create the pagination container
  let paginationEl = document.getElementById("donorsPagination");
  if (!paginationEl) {
    paginationEl = document.createElement("div");
    paginationEl.id = "donorsPagination";
    paginationEl.className = "pagination-container";
    const donorsSection = document.getElementById("donorsGrid");
    if (donorsSection && donorsSection.parentNode) {
      donorsSection.parentNode.insertBefore(paginationEl, donorsSection.nextSibling);
    }
  }

  if (totalPages <= 1) {
    paginationEl.innerHTML = "";
    return;
  }

  let pagesHTML = "";

  // Prev button
  pagesHTML += `<button class="page-btn ${currentPg <= 1 ? 'disabled' : ''}" ${currentPg <= 1 ? 'disabled' : ''} onclick="goToPage(${currentPg - 1})">‹ Prev</button>`;

  // Page number buttons (show at most 5 pages around current)
  const startPage = Math.max(1, currentPg - 2);
  const endPage   = Math.min(totalPages, currentPg + 2);

  if (startPage > 1) {
    pagesHTML += `<button class="page-btn" onclick="goToPage(1)">1</button>`;
    if (startPage > 2) pagesHTML += `<span class="page-ellipsis">…</span>`;
  }

  for (let i = startPage; i <= endPage; i++) {
    pagesHTML += `<button class="page-btn ${i === currentPg ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) pagesHTML += `<span class="page-ellipsis">…</span>`;
    pagesHTML += `<button class="page-btn" onclick="goToPage(${totalPages})">${totalPages}</button>`;
  }

  // Next button
  pagesHTML += `<button class="page-btn ${currentPg >= totalPages ? 'disabled' : ''}" ${currentPg >= totalPages ? 'disabled' : ''} onclick="goToPage(${currentPg + 1})">Next ›</button>`;

  paginationEl.innerHTML = `
    <div class="pagination-info">Page ${currentPg} of ${totalPages}</div>
    <div class="pagination-btns">${pagesHTML}</div>
  `;
}

function goToPage(page) {
  const { blood_group, district } = currentFilters;
  loadDonors(blood_group, district, page);
  // Scroll back to donors section
  const section = document.getElementById("donors");
  if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ===== DEBOUNCE HELPER =====
function debounce(func, wait = 300) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// ===== DONOR SEARCH / FILTER (Live Debounced & Form Handled) =====
function initDonorSearch() {
  // Selector matching: btnSearch, searchBtn, .btn-search, searchForm
  const searchBtn = document.getElementById("btnSearch") || document.getElementById("searchBtn") || document.querySelector(".btn-search");
  const searchForm = document.getElementById("searchForm") || (searchBtn ? searchBtn.closest("form") : null);

  if (searchBtn) {
    searchBtn.addEventListener("click", (e) => {
      e.preventDefault();
      filterDonors(e);
    });
  }

  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      filterDonors(e);
    });
  }

  const debouncedFilter = debounce((e) => filterDonors(e), 350);

  ["searchBlood", "searchDistrict"].forEach(id => {
    const inputEl = document.getElementById(id);
    if (inputEl) {
      inputEl.addEventListener("input", debouncedFilter);
      inputEl.addEventListener("change", (e) => {
        e.preventDefault();
        filterDonors(e);
      });
    }
  });
}

function filterDonors(e) {
  if (e && e.preventDefault) e.preventDefault();
  const blood    = (document.getElementById("searchBlood")?.value || '').trim();
  const district = (document.getElementById("searchDistrict")?.value || '').toLowerCase().trim();

  // Reset to page 1 when filter changes
  loadDonors(blood, district, 1);
}

// ===== RESET FILTERS ACTION =====
function resetFilters() {
  const blood = document.getElementById("searchBlood");
  const dist  = document.getElementById("searchDistrict");
  if (blood) blood.value = "";
  if (dist)  dist.value = "";
  loadDonors("", "", 1);
  showToast("Filters reset to show all donors.", "info");
}

// ===== RENDER DONOR CARDS =====
function renderDonors(donors) {
  const grid = document.getElementById("donorsGrid");
  if (!grid) return;

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

  const cardsHTML = donors.map(donor => buildDonorCardHTML(donor, isLoggedIn)).join("");

  grid.innerHTML = cardsHTML;
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

// ===== HTML ESCAPING HELPER (DOM XSS Protection) =====
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ===== ELIGIBILITY LOGIC =====
function getEligibility(lastDonationDateVal) {
  // Guard: null, empty string, or invalid date → treat as first-time donor (always eligible)
  if (!lastDonationDateVal) {
    return { ready: true, remainingDays: 0, daysLeft: 0, daysSince: null, firstTime: true, nextEligibleDate: new Date() };
  }

  let year, month, day;
  if (typeof lastDonationDateVal === 'string') {
    const dateStr = lastDonationDateVal.trim().split('T')[0];
    if (dateStr.includes('-')) {
      [year, month, day] = dateStr.split('-').map(Number);
    } else if (dateStr.includes('/')) {
      [day, month, year] = dateStr.split('/').map(Number);
    } else {
      const d = new Date(lastDonationDateVal);
      if (isNaN(d.getTime())) {
        return { ready: true, remainingDays: 0, daysLeft: 0, daysSince: null, firstTime: true, nextEligibleDate: new Date() };
      }
      year = d.getFullYear();
      month = d.getMonth() + 1;
      day = d.getDate();
    }
  } else if (lastDonationDateVal instanceof Date) {
    year = lastDonationDateVal.getFullYear();
    month = lastDonationDateVal.getMonth() + 1;
    day = lastDonationDateVal.getDate();
  } else {
    const d = new Date(lastDonationDateVal);
    if (isNaN(d.getTime())) {
      return { ready: true, remainingDays: 0, daysLeft: 0, daysSince: null, firstTime: true, nextEligibleDate: new Date() };
    }
    year = d.getFullYear();
    month = d.getMonth() + 1;
    day = d.getDate();
  }

  const lastDonationDate = new Date(year, month - 1, day);
  lastDonationDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calculate next eligible date: nextEligibleDate.setDate(nextEligibleDate.getDate() + 90);
  const nextEligibleDate = new Date(lastDonationDate);
  nextEligibleDate.setDate(nextEligibleDate.getDate() + 90);

  const diffTime = nextEligibleDate - today;
  const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const diffDays = Math.floor((today - lastDonationDate) / (1000 * 60 * 60 * 24));

  // Guard: future last-donation date (user entered tomorrow or later)
  const isFutureDate = lastDonationDate > today;

  return {
    ready: !isFutureDate && today >= nextEligibleDate,
    remainingDays: Math.max(0, remainingDays),
    daysLeft: Math.max(0, remainingDays),
    daysSince: diffDays,
    firstTime: false,
    invalidFuture: isFutureDate,
    lastDonationDate: lastDonationDate,
    nextEligibleDate: nextEligibleDate
  };
}

// ===== ELIGIBILITY CALCULATOR =====
function initEligibilityCalc() {
  const btn = document.getElementById("btnCalcEligibility");
  const input = document.getElementById("lastDonationDate");
  const result = document.getElementById("calcResult");

  if (!btn || !input || !result) return;

  btn.addEventListener("click", () => {
    const dateVal = input.value;
    if (!dateVal) {
      showToast("Please select your last donation date.", "error");
      return;
    }

    const [year, month, day] = dateVal.split('-').map(Number);
    const lastDonationDate = new Date(year, month - 1, day);
    lastDonationDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const nextEligibleDate = new Date(lastDonationDate);
    nextEligibleDate.setDate(nextEligibleDate.getDate() + 90);

    result.classList.add("show");

    // Format dates for display in UK/European style (DD Month YYYY or DD/MM/YYYY)
    const formattedDate = nextEligibleDate.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });

    if (today >= nextEligibleDate) {
      const pastDays = Math.floor((today - lastDonationDate) / (1000 * 60 * 60 * 24));
      result.className = "calc-result show ready";
      result.innerHTML = `
        <div class="result-icon">🎉</div>
        <div class="result-text">
          You are eligible to donate today! It's been ${pastDays} days since your last donation.
        </div>`;
    } else {
      const remainingDays = Math.ceil((nextEligibleDate - today) / (1000 * 60 * 60 * 24));
      result.className = "calc-result show not-ready";
      result.innerHTML = `
        <div class="result-icon">⏰</div>
        <div class="result-text">
          You will be eligible to donate in ${remainingDays} days. Next eligible date: ${formattedDate}.
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
  // HTML uses id="btn-geo-nearby" (Task 4 fix: correct button ID)
  const geoNearbyBtn = document.getElementById('btn-geo-nearby') || document.getElementById('btnGeoNearby');

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

      if (source === 'hero') {
        // Hero search: snap to closest city for text filters
        let closestCity = BD_CITIES[0];
        let minDist = Infinity;
        BD_CITIES.forEach(city => {
          const dist = Math.hypot(city.lat - userLat, city.lng - userLng);
          if (dist < minDist) { minDist = dist; closestCity = city; }
        });
        const distInput = document.getElementById("searchDistrict");
        if (distInput) distInput.value = closestCity.name;
        filterDonors(null);
        showToast(`📍 Location detected: ${closestCity.name}`, "success");
      } else if (source === 'nearby') {
        // Nearby section: call the real Haversine /donors/nearby endpoint (Task 4 fix)
        searchNearbyByGPS(userLat, userLng);
        showToast(`📍 GPS coordinates acquired — searching nearby donors…`, "success");
      }
    },
    (err) => {
      console.warn("Geolocation error:", err);
      showToast("Could not detect location. Please type your city/district.", "error");
    },
    { timeout: 10000, enableHighAccuracy: true }
  );
}

// ===== GPS-BASED NEARBY SEARCH — calls /donors/nearby Haversine endpoint (Task 4) =====
async function searchNearbyByGPS(lat, lon) {
  const results    = document.getElementById('hospital-donors-results');
  if (!results) return;
  const radiusSel  = document.getElementById('search-radius');
  const radiusVal  = radiusSel ? radiusSel.value : '5';
  const radius     = radiusVal === 'all' ? 50 : parseFloat(radiusVal) || 5;

  renderDonorsSkeleton(results);

  try {
    const params = new URLSearchParams({ lat, lon, radius });
    const response = await apiFetch(`/donors/nearby?${params.toString()}`);
    const donors = Array.isArray(response) ? response : (response?.donors || []);

    if (!donors || donors.length === 0) {
      results.innerHTML = `
        <div class="empty-state-card">
          <div class="icon">📍</div>
          <h3>No Donors Found Nearby</h3>
          <p>No donors found within ${radius} km of your current GPS location. Try increasing the radius.</p>
        </div>`;
      return;
    }

    const currentUserEmail = getCurrentUserEmail();
    const isLoggedIn = Boolean(currentUserEmail);
    results.innerHTML = `<div class="donors-grid">${donors.map(d => buildDonorCardHTML(d, isLoggedIn, d.distance_km)).join('')}</div>`;
    initScrollAnimations();
    showToast(`✅ Found ${donors.length} donor(s) within ${radius} km`, 'success');
  } catch (e) {
    console.error('searchNearbyByGPS error:', e);
    const errorMsg = escapeHTML(e.message || 'Server offline');
    results.innerHTML = `
      <div class="empty-state-card">
        <div class="icon">⚠️</div>
        <h3>GPS Search Unavailable</h3>
        <p>Unable to connect to location server (${errorMsg}). Please try searching by hospital name or area.</p>
      </div>`;
    showToast(`Unable to fetch nearby donors: ${e.message || 'Server connection offline'}`, "error");
  }
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
  if (!results) return;

  const rawQuery = input ? input.value : '';
  const query    = (rawQuery || '').toLowerCase().trim();

  if (!query) {
    results.innerHTML = `<div class="nearby-empty"><div class="icon">💡</div><h3>Enter a hospital or area name to search</h3></div>`;
    return;
  }

  renderDonorsSkeleton(results);

  try {
    const params = new URLSearchParams({ hospital_or_area: query, limit: 50 });
    const response = await apiFetch(`/donors?${params.toString()}`);
    const donors = (response && response.donors) ? response.donors : (Array.isArray(response) ? response : []);

    if (donors.length === 0) {
      results.innerHTML = `
        <div class="empty-state-card">
          <div class="icon">📍</div>
          <h3>No Donors Found Nearby</h3>
          <p>No donors found matching "${escapeHTML(query)}". Try a different area name or use the 📍 Near Me button for GPS search.</p>
        </div>`;
      return;
    }

    const currentUserEmail = getCurrentUserEmail();
    const isLoggedIn = Boolean(currentUserEmail);
    results.innerHTML = `<div class="donors-grid">${donors.map(d => buildDonorCardHTML(d, isLoggedIn)).join('')}</div>`;
    initScrollAnimations();
  } catch (e) {
    console.error('searchNearbyDonors error:', e);
    const errorMsg = escapeHTML(e.message || 'Server offline');
    results.innerHTML = `
      <div class="empty-state-card">
        <div class="icon">⚠️</div>
        <h3>Search Currently Unavailable</h3>
        <p>Could not connect to donor backend (${errorMsg}). Please check server connection and try again.</p>
      </div>`;
    showToast(`Search error: ${e.message || 'Server connection offline'}`, "error");
  }
}

// Shared helper: builds a single donor card HTML string (used by renderDonors + nearby search)
// distance_km is optional — shown on cards returned from /donors/nearby (Task 4)
function buildDonorCardHTML(donor, isLoggedIn, distance_km = null) {
  const nameEscaped = escapeHTML(donor.name || '');
  const districtEscaped = escapeHTML(donor.district || '');
  const upazilaEscaped = escapeHTML(donor.upazila || '');
  const divisionEscaped = escapeHTML(donor.division || '');
  const blood = escapeHTML(donor.blood_group || '');
  const lastDon = donor.last_donation_date || null;

  const eligibility = getEligibility(lastDon);
  const initials = escapeHTML((donor.name || 'D').split(' ').map(n => n[0]).join('').slice(0, 2));
  const formattedDate = lastDon
    ? new Date(lastDon).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'First-time donor';

  const phoneRaw = (donor.phone || '').replace(/[^+\d]/g, '');
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

  const shareBtn = `<button class="btn-share" onclick="shareDonorCard('${nameEscaped.replace(/'/g, "\\'")}', '${blood}', '${districtEscaped.replace(/'/g, "\\'")}', '${phoneRaw}')">🔗 Share</button>`;

  const distanceBadge = (distance_km !== null && distance_km !== undefined)
    ? `<div class="distance-badge">📍 ${distance_km} km away</div>`
    : '';

  let eligibilityText;
  if (eligibility.firstTime) {
    eligibilityText = '✅ Ready to Donate (First-time)';
  } else if (eligibility.ready) {
    eligibilityText = `✅ Ready to Donate (${eligibility.daysSince}d since last)`;
  } else if (eligibility.invalidFuture) {
    eligibilityText = '⏳ Pending Date Verification';
  } else {
    eligibilityText = `⏳ Eligible in ${eligibility.daysLeft} days`;
  }

  return `
    <div class="donor-card animate-on-scroll">
      <div class="donor-card-header">
        <div class="donor-avatar">${initials}</div>
        <div class="donor-info">
          <h3>${nameEscaped} ${donor.verified ? '<span class="verified-badge">✓ Verified</span>' : ''}</h3>
          <p>📍 ${upazilaEscaped ? upazilaEscaped + ', ' : ''}${districtEscaped}</p>
        </div>
        <div class="blood-badge">${blood}</div>
      </div>
      ${distanceBadge}
      <div class="donor-details">
        <div class="detail-item"><span class="icon">🏥</span> ${divisionEscaped} Division</div>
        <div class="detail-item"><span class="icon">📅</span> Last: ${formattedDate}</div>
      </div>
      <div class="eligibility-status ${(eligibility.ready || eligibility.firstTime) ? 'ready' : 'not-ready'}">
        ${eligibilityText}
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

let isBanksExpanded = false;

function renderBloodBanks(banks) {
  const grid = document.getElementById("banksGrid");
  if (!grid) return;

  if (!banks || banks.length === 0) {
    grid.innerHTML = `
      <div class="empty-state-card">
        <div class="icon">🏛️</div>
        <h3>No Blood Banks Directory Found</h3>
        <p>Currently no blood banks are registered in this view.</p>
      </div>`;
    const oldWrapper = document.getElementById("banksToggleWrapper");
    if (oldWrapper) oldWrapper.remove();
    return;
  }

  const cardsHTML = banks.map((bank, i) => {
    const cleanPhone = (bank.phone || '').replace(/[^+\d]/g, '');
    const isHidden = (i >= 4 && !isBanksExpanded) ? "bank-card-hidden" : "";
    const bankName = escapeHTML(bank.name || 'Blood Bank');
    const bankLoc = escapeHTML(bank.location || '');
    const bankCity = escapeHTML((bank.location || '').split(",").pop().trim());
    const bankHours = escapeHTML(bank.operating_hours || bank.hours || '');
    const bankServices = escapeHTML(bank.services || '');

    return `
      <div class="bank-card animate-on-scroll ${isHidden}" data-bank="${i}">
        <div class="bank-card-header" onclick="toggleBank(event, ${i})" aria-expanded="false" role="button" tabindex="0">
          <div class="bank-info">
            <div class="bank-icon">🏛️</div>
            <div>
              <h3>${bankName}</h3>
              <p>${bankCity}</p>
            </div>
          </div>
          <div class="bank-toggle">▼</div>
        </div>
        <div class="bank-card-body">
          <div class="bank-card-content">
            <div class="bank-detail"><span class="icon">📍</span> ${bankLoc}</div>
            <div class="bank-detail"><span class="icon">🕐</span> ${bankHours}</div>
            <div class="bank-detail"><span class="icon">🩺</span> ${bankServices}</div>
            <div style="display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap;">
              <a href="tel:${cleanPhone}" class="btn-bank-call" style="flex: 1;">📞 Call ${cleanPhone}</a>
              <button class="btn-copy-num" style="flex: 1;" onclick="copyPhoneNumber('${cleanPhone}', null)">📋 Copy</button>
              <button class="btn-share" style="width: 100%; margin-top: 4px;" onclick="shareBankCard('${bankName.replace(/'/g, "\\'")}', '${bankLoc.replace(/'/g, "\\'")}', '${cleanPhone}')">🔗 Share Bank</button>
            </div>
          </div>
        </div>
      </div>`;
  }).join("");

  grid.innerHTML = cardsHTML;

  // Setup / update toggle button if there are > 4 blood banks
  let wrapper = document.getElementById("banksToggleWrapper");
  if (banks.length > 4) {
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.id = "banksToggleWrapper";
      wrapper.className = "banks-toggle-wrapper";
      if (grid.parentNode) {
        grid.parentNode.insertBefore(wrapper, grid.nextSibling);
      }
    }
    wrapper.innerHTML = `
      <button class="btn-toggle-banks" id="btnToggleBanks" aria-label="Toggle blood banks view">
        ${isBanksExpanded ? 'Show Less <span class="arrow">▲</span>' : 'Show All Blood Banks <span class="arrow">▼</span>'}
      </button>
    `;
    const toggleBtn = document.getElementById("btnToggleBanks");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        isBanksExpanded = !isBanksExpanded;
        const allBankCards = grid.querySelectorAll(".bank-card");
        if (isBanksExpanded) {
          allBankCards.forEach(card => card.classList.remove("bank-card-hidden"));
          toggleBtn.innerHTML = 'Show Less <span class="arrow">▲</span>';
          initScrollAnimations();
        } else {
          allBankCards.forEach((card, idx) => {
            if (idx >= 4) card.classList.add("bank-card-hidden");
          });
          toggleBtn.innerHTML = 'Show All Blood Banks <span class="arrow">▼</span>';
          const bloodBanksSection = document.getElementById("bloodBanks");
          if (bloodBanksSection) {
            bloodBanksSection.scrollIntoView({ behavior: 'smooth' });
          }
        }
      });
    }
  } else if (wrapper) {
    wrapper.remove();
  }

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

  // ESC to close all modals
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal(regOverlay);
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
  if (!overlay) return;
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

// ===== HEALTH & BLOOD DONATION TIPS CENTER-ZOOM CAROUSEL =====
function initHealthTipsScroll() {
  const container = document.getElementById("healthTipsContainer");
  const track = document.getElementById("healthTipsTrack");
  if (!container || !track) return;

  // Duplicate cards twice (3 sets total) for seamless infinite looping without blank gaps
  const originalHTML = track.innerHTML;
  track.innerHTML = originalHTML + originalHTML + originalHTML;

  const cards = track.querySelectorAll(".health-card");
  const numCards = cards.length;
  const originalCount = numCards / 3;

  let isPaused = false;
  let isMouseDown = false;
  let startX = 0;
  let scrollLeftStart = 0;
  const speed = 0.8; // scroll speed in pixels per frame

  // Loop distance for 1 set of original cards
  function getLoopDistance() {
    if (cards.length >= originalCount * 2 && cards[originalCount]) {
      return cards[originalCount].offsetLeft - cards[0].offsetLeft;
    }
    return track.scrollWidth / 3;
  }

  // Calculate center active card
  function updateCenterActiveCard() {
    const containerRect = container.getBoundingClientRect();
    const containerCenter = containerRect.left + containerRect.width / 2;

    let minDistance = Infinity;
    let activeCard = null;

    cards.forEach(card => {
      const cardRect = card.getBoundingClientRect();
      const cardCenter = cardRect.left + cardRect.width / 2;
      const distance = Math.abs(containerCenter - cardCenter);

      if (distance < minDistance) {
        minDistance = distance;
        activeCard = card;
      }
    });

    cards.forEach(card => {
      if (card === activeCard) {
        card.classList.add("active-center");
      } else {
        card.classList.remove("active-center");
      }
    });
  }

  // Initialize scroll position to set 2 (middle set) so left and right sides are fully populated
  function initScrollPosition() {
    const loopDist = getLoopDistance();
    if (cards[originalCount]) {
      const cardCenterOffset = cards[originalCount].offsetLeft - (container.clientWidth / 2 - cards[originalCount].offsetWidth / 2);
      container.scrollLeft = cardCenterOffset;
    } else {
      container.scrollLeft = loopDist;
    }
    updateCenterActiveCard();
  }

  function step() {
    if (!isPaused && !isMouseDown) {
      container.scrollLeft += speed;
      const loopDist = getLoopDistance();
      // Seamless wrap when reaching end of middle set
      if (container.scrollLeft >= loopDist * 2) {
        container.scrollLeft -= loopDist;
      }
    }
    updateCenterActiveCard();
    requestAnimationFrame(step);
  }

  // Handle loop reset on manual scroll
  container.addEventListener("scroll", () => {
    const loopDist = getLoopDistance();
    if (container.scrollLeft >= loopDist * 2) {
      container.scrollLeft -= loopDist;
    } else if (container.scrollLeft <= loopDist * 0.2) {
      container.scrollLeft += loopDist;
    }
    updateCenterActiveCard();
  });

  // Dynamic Pause on Mouse Hover / Enter
  container.addEventListener("mouseenter", () => { isPaused = true; });
  container.addEventListener("mouseleave", () => {
    isPaused = false;
    isMouseDown = false;
  });

  // Dynamic Pause on Touch Events (Mobile)
  container.addEventListener("touchstart", () => { isPaused = true; }, { passive: true });
  container.addEventListener("touchend", () => { isPaused = false; });
  container.addEventListener("touchcancel", () => { isPaused = false; });

  // Mouse Drag / Manual Swipe
  container.addEventListener("mousedown", (e) => {
    isMouseDown = true;
    isPaused = true;
    startX = e.pageX - container.offsetLeft;
    scrollLeftStart = container.scrollLeft;
  });

  container.addEventListener("mouseup", () => {
    isMouseDown = false;
    isPaused = false;
  });

  container.addEventListener("mousemove", (e) => {
    if (!isMouseDown) return;
    e.preventDefault();
    const x = e.pageX - container.offsetLeft;
    const walk = (x - startX) * 1.5;
    container.scrollLeft = scrollLeftStart - walk;
    updateCenterActiveCard();
  });

  // Recalculate layout on window resize
  window.addEventListener("resize", () => {
    updateCenterActiveCard();
  });

  // Set initial scroll position and start animation
  setTimeout(initScrollPosition, 50);
  requestAnimationFrame(step);
}




