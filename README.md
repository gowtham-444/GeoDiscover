# 🌍 GeoDiscover — Full Stack REST Countries Explorer

A production-ready full-stack web application built with:
- **Frontend**: HTML + CSS + Vanilla JavaScript
- **Backend**: Node.js + Express.js
- **Database**: MongoDB + Mongoose
- **API**: [REST Countries API](https://restcountries.com/v3.1/all)

---

## 📁 Project Structure

```
REST CONTRIES API/
├── server/                    ← Express backend
│   ├── config/
│   │   └── db.js              ← MongoDB connection
│   ├── controllers/
│   │   ├── authController.js  ← Signup / Login / GetMe
│   │   ├── countryController.js ← Countries CRUD
│   │   └── favoriteController.js ← Favorites CRUD
│   ├── middleware/
│   │   └── authMiddleware.js  ← JWT protect / optionalAuth
│   ├── models/
│   │   ├── User.js            ← User schema (bcrypt password)
│   │   └── Favorite.js        ← Favorite schema
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── countryRoutes.js
│   │   └── favoriteRoutes.js
│   ├── .env                   ← Environment variables
│   ├── package.json
│   └── server.js              ← Express entry point
│
└── client/                    ← Vanilla JS frontend
    ├── index.html
    ├── style.css
    └── script.js
```

---

## ⚙️ Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [MongoDB](https://www.mongodb.com/try/download/community) (local) OR a [MongoDB Atlas](https://cloud.mongodb.com/) cluster
- [VS Code Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) (recommended for frontend)

---

## 🚀 How to Run

### Step 1 — Install backend dependencies

```bash
cd server
npm install
```

### Step 2 — Configure environment

Edit `server/.env`:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/countries_explorer
JWT_SECRET=your_secret_key_here
JWT_EXPIRES_IN=7d
REST_COUNTRIES_API=https://restcountries.com/v3.1/all
CLIENT_ORIGIN=http://127.0.0.1:5500
```

> **For MongoDB Atlas**, replace `MONGODB_URI` with your Atlas connection string.

### Step 3 — Start MongoDB

```bash
# On Windows (if installed as a service, it may already be running)
net start MongoDB

# Or start manually:
mongod --dbpath "C:\data\db"
```

### Step 4 — Start the backend server

```bash
cd server

# Development (with auto-restart):
npm run dev

# Production:
npm start
```

You should see:
```
✅  MongoDB Connected: localhost
🚀  Server running on http://localhost:5000
📡  Environment : development
🔗  API Base URL: http://localhost:5000/api
```

### Step 5 — Open the frontend

Open `client/index.html` using **VS Code Live Server** (right-click → Open with Live Server), or simply open the file directly in your browser.

> The frontend points to `http://localhost:5000/api` by default.

---

## 🔗 API Endpoints

### Auth
| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| POST | `/api/auth/signup` | Register new user | Public |
| POST | `/api/auth/login` | Login & get JWT | Public |
| GET | `/api/auth/me` | Get current user | 🔒 Private |

### Countries
| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| GET | `/api/countries` | Get all countries (search, filter, sort, paginate) | Public |
| GET | `/api/countries/:name` | Get country by name/cca2/cca3 | Public |
| GET | `/api/countries/region/:region` | Get countries by region | Public |

**Query Parameters for `GET /api/countries`:**
- `search` — filter by name, code, or capital
- `region` — filter by region (africa, asia, europe, americas, oceania)
- `sort` — `name` | `population` | `area`
- `page` — page number (default: 1)
- `limit` — items per page (default: 50, max: 250)

### Favorites
| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| GET | `/api/favorites` | Get all user favorites | 🔒 Private |
| POST | `/api/favorites` | Add country to favorites | 🔒 Private |
| DELETE | `/api/favorites/:id` | Remove a specific favorite | 🔒 Private |
| DELETE | `/api/favorites/clear` | Clear all favorites | 🔒 Private |

---

## ✨ Features

### Frontend
- 🌍 **Country Cards** — flag, name, capital, region, population
- 🔍 **Real-time Search** — by name, code (cca2/cca3), capital (debounced 400ms)
- 🗂 **Region Filter** — Africa, Americas, Asia, Europe, Oceania, Antarctic
- ↕️ **Sort** — A–Z name, Population ↓, Area ↓
- 📄 **Pagination** — 20 countries per page
- 🔎 **Detail Modal** — full country info with Google Maps link
- ❤️ **Favorites** — save/remove countries (requires login)
- 🌙 **Dark / Light Mode** — persisted in localStorage
- 🔔 **Toast Notifications** — success, error, info, warning
- 📱 **Fully Responsive** — mobile to desktop

### Backend
- 🔐 **JWT Authentication** — secure signup/login
- 🔒 **Protected Routes** — favorites require valid JWT
- ⚡ **In-memory Cache** — countries cached for 10 min (reduces API calls)
- 🛡 **Rate Limiting** — 100 req/15 min globally, 15 req/15 min for auth
- ✅ **Input Validation** — express-validator on all auth routes
- 🌐 **CORS** — configured for localhost dev + Live Server

---

## 🧪 Test the API (curl examples)

```bash
# Health check
curl http://localhost:5000/api/health

# Get all countries (page 1)
curl "http://localhost:5000/api/countries?page=1&limit=20"

# Search by name
curl "http://localhost:5000/api/countries?search=india"

# Filter by region + sort
curl "http://localhost:5000/api/countries?region=asia&sort=population"

# Signup
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com","password":"secret123"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"secret123"}'

# Add favorite (replace TOKEN)
curl -X POST http://localhost:5000/api/favorites \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"countryName":"India","cca3":"IND","region":"Asia","capital":"New Delhi","flag":"..."}'
```

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JS (ES6+) |
| Backend | Node.js v18+, Express.js v4 |
| Database | MongoDB + Mongoose v8 |
| Auth | JWT + bcryptjs |
| HTTP Client | Axios (server-side) |
| Dev Tools | Nodemon, Morgan, express-rate-limit |
