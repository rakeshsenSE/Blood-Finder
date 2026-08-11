# 🩸 Blood Finder — Emergency Blood Donation Platform

<p align="center">
  <img src="https://img.shields.io/badge/FastAPI-005587?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript" />
  <img src="https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/Google_OAuth-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Google OAuth" />
  <img src="https://img.shields.io/badge/Status-Active-brightgreen?style=for-the-badge" alt="Status" />
</p>

An intelligent, responsive, and full-stack emergency blood management platform designed to connect blood seekers with nearby donors and verified blood banks in real time.

---

## ✨ Features

- ⚡ **Instant Live Search & Filtering:** Filter donors and blood banks dynamically by location or blood group without reloading the page.
- 📍 **Browser Geolocation:** Auto-detect current user location to fetch nearest blood repositories instantly.
- 🔐 **Google OAuth 2.0 Integration:** Secure, seamless one-click user authentication using Google Identity Services.
- 📲 **One-Click Share & Quick Actions:**
  - Direct WhatsApp & SMS sharing for emergency blood requests via Web Share API.
  - One-click contact copying with interactive toast notifications.
- 🎨 **Modern Responsive UI/UX:**
  - Glassmorphism & clean card-based design optimized for mobile and desktop screens.
  - Smooth skeletal shimmer loading effects and intelligent empty-state handling.
- ⚡ **Offline Caching:** Fast load times with `localStorage` response caching and silent background updates.

---

## 🛠️ Tech Stack

### **Front-End**
- **HTML5 & CSS3:** Flexbox, Grid, Custom Shimmer Animations, Responsive Layouts.
- **Vanilla JavaScript (ES6+):** Async/Await, Web Share API, Geolocation API, Google GIS Client.

### **Back-End**
- **Python (FastAPI):** High-performance asynchronous REST API.
- **SQLAlchemy & SQLite:** Lightweight relational database and ORM for managing users and blood bank inventories.
- **Uvicorn:** ASGI web server implementation.

---

## 📁 Project Structure

```text
├── FrontEnd/
│   ├── index.html       # Primary UI structure
│   ├── style.css        # Responsive styling & dynamic animations
│   └── script.js        # Dynamic DOM manipulation & API connectivity
├── backend/
│   ├── main.py          # FastAPI application & endpoints
│   ├── database.py      # Database engine & session setup
│   ├── models.py        # SQLAlchemy database models
│   ├── schemas.py       # Pydantic data validation schemas
│   ├── crud.py          # Database queries & logic
│   └── seed.py          # Initial data seeder script
├── requirements.txt     # Python dependencies
└── README.md            # Project documentation
