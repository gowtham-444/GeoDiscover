/* ============================================================
   GeoDiscover — client/script.js
   Full-stack REST Countries Explorer
   Backend: Express + MongoDB @ http://localhost:5000
   ============================================================ */

'use strict';

// ─── Configuration ────────────────────────────────────────────
const API_BASE = 'http://localhost:5000/api';
const ITEMS_PER_PAGE = 20;

// ─── App State ────────────────────────────────────────────────
const state = {
  allCountries: [],
  filtered: [],
  favorites: [],             // from MongoDB via backend
  favoriteIds: new Set(),    // cca3 set for quick O(1) lookup
  currentPage: 1,
  totalPages: 1,
  totalCount: 0,
  searchQuery: '',
  selectedRegion: 'all',
  sortBy: 'name',
  currentView: 'countries',  // 'countries' | 'favorites'
  currentCountry: null,      // country in modal
  user: null,                // logged-in user object
  token: null,               // JWT
  darkMode: true,
  loading: false,
};

// ─── DOM References ───────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const countriesGrid   = $('countries-grid');
const favoritesGrid   = $('favorites-grid');
const searchInput     = $('search-input');
const searchClear     = $('search-clear');
const regionSelect    = $('region-select');
const resultsInfo     = $('results-info');
const countBadge      = $('country-count');
const themeToggle     = $('theme-toggle');
const pagination      = $('pagination');
const favBadge        = $('fav-badge');

// Tabs
const tabCountries    = $('tab-countries');
const tabFavorites    = $('tab-favorites');
const viewCountries   = $('view-countries');
const viewFavorites   = $('view-favorites');

// Auth
const authSection     = $('auth-section');
const userMenu        = $('user-menu');
const btnLogin        = $('btn-login');
const btnSignup       = $('btn-signup');
const btnLogout       = $('btn-logout');
const userAvatar      = $('user-avatar');
const userNameDisplay = $('user-name-display');

// Auth Modal
const authModal       = $('auth-modal');
const authModalTitle  = $('auth-modal-title');
const authModalClose  = $('auth-modal-close');
const loginForm       = $('login-form');
const signupForm      = $('signup-form');
const loginError      = $('login-error');
const signupError     = $('signup-error');

// Country Detail Modal
const modalOverlay    = $('modal-overlay');
const modalClose      = $('modal-close');
const modalFavBtn     = $('modal-fav-btn');

// Sort
const sortBtns = document.querySelectorAll('.sort-btn');

// ─── Utilities ────────────────────────────────────────────────

const fmt = (n) => (n == null ? 'N/A' : Number(n).toLocaleString());

const debounce = (fn, delay = 300) => {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), delay); };
};

const authHeaders = () => ({
  'Content-Type': 'application/json',
  ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
});

// ─── Toast Notifications ──────────────────────────────────────

function showToast(type = 'info', title, message, duration = 4000) {
  const container = $('toast-container');
  const id = `toast-${Date.now()}`;

  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.id = id;
  el.innerHTML = `
    <span class="toast-icon"></span>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-msg">${message}</div>` : ''}
    </div>
    <button class="toast-close" aria-label="Dismiss">✕</button>`;

  el.querySelector('.toast-close').onclick = () => dismissToast(id);
  container.appendChild(el);

  setTimeout(() => dismissToast(id), duration);
}

function dismissToast(id) {
  const el = $(id);
  if (!el) return;
  el.classList.add('out');
  setTimeout(() => el.remove(), 320);
}

const toast = {
  success: (t, m) => showToast('success', t, m),
  error:   (t, m) => showToast('error', t, m, 5000),
  info:    (t, m) => showToast('info', t, m),
  warning: (t, m) => showToast('warning', t, m),
};

// ─── Authentication ───────────────────────────────────────────

function saveAuth(token, user) {
  state.token = token;
  state.user  = user;
  localStorage.setItem('we_token', token);
  localStorage.setItem('we_user',  JSON.stringify(user));
  updateAuthUI();
}

function clearAuth() {
  state.token = null;
  state.user  = null;
  state.favorites  = [];
  state.favoriteIds = new Set();
  localStorage.removeItem('we_token');
  localStorage.removeItem('we_user');
  updateAuthUI();
  updateFavBadge();
  if (state.currentView === 'favorites') switchView('countries');
}

function loadSavedAuth() {
  const token = localStorage.getItem('we_token');
  const user  = localStorage.getItem('we_user');
  if (token && user) {
    state.token = token;
    state.user  = JSON.parse(user);
    updateAuthUI();
    loadFavorites();
  }
}

function updateAuthUI() {
  if (state.user) {
    authSection.style.display      = 'none';
    userMenu.style.display         = 'flex';
    userAvatar.src                 = state.user.avatar || '';
    userAvatar.alt                 = state.user.name;
    userNameDisplay.textContent    = state.user.name.split(' ')[0];

    const planBadge = $('user-plan-badge');
    if (state.user.role === 'premium' && state.user.subscriptionStatus === 'active') {
      planBadge.textContent = 'PRO';
      planBadge.classList.add('premium');
      $('favorites-lock').style.display = 'none';
    } else {
      planBadge.textContent = 'FREE';
      planBadge.classList.remove('premium');
      $('favorites-lock').style.display = 'inline-flex';
    }
  } else {
    authSection.style.display      = 'flex';
    userMenu.style.display         = 'none';
    $('favorites-lock').style.display = 'inline-flex';
  }
}

// Open Auth Modal
function openAuthModal(mode = 'login') {
  authModalTitle.textContent = mode === 'login' ? 'Login' : 'Create Account';
  loginForm.style.display    = mode === 'login'   ? 'flex' : 'none';
  signupForm.style.display   = mode === 'signup'  ? 'flex' : 'none';
  loginError.textContent     = '';
  signupError.textContent    = '';
  loginError.classList.remove('visible');
  signupError.classList.remove('visible');
  authModal.classList.add('active');
  authModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  // Focus first input
  setTimeout(() => {
    const first = authModal.querySelector('input:not([type=hidden])');
    if (first) first.focus();
  }, 300);
}

function closeAuthModal() {
  authModal.classList.remove('active');
  authModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

// Signup
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email    = $('login-email').value.trim();
  const password = $('login-password').value;

  $('login-submit').disabled = true;
  $('login-submit').textContent = 'Logging in…';

  try {
    const res  = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.message || 'Login failed.');

    saveAuth(data.token, data.user);
    await loadFavorites();
    closeAuthModal();
    toast.success('Welcome back!', `Logged in as ${data.user.name}`);
    refreshCardFavButtons();
  } catch (err) {
    loginError.textContent = err.message;
    loginError.classList.add('visible');
  } finally {
    $('login-submit').disabled = false;
    $('login-submit').textContent = 'Login';
  }
});

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name     = $('signup-name').value.trim();
  const email    = $('signup-email').value.trim();
  const password = $('signup-password').value;

  $('signup-submit').disabled = true;
  $('signup-submit').textContent = 'Creating account…';

  try {
    const res  = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(
      data.errors ? data.errors.map(e => e.msg).join(', ') : (data.message || 'Signup failed.')
    );

    saveAuth(data.token, data.user);
    closeAuthModal();
    toast.success('Account created!', `Welcome, ${data.user.name} 🎉`);
    refreshCardFavButtons();
  } catch (err) {
    signupError.textContent = err.message;
    signupError.classList.add('visible');
  } finally {
    $('signup-submit').disabled = false;
    $('signup-submit').textContent = 'Create Account';
  }
});

// ─── Favorites ────────────────────────────────────────────────

async function loadFavorites() {
  if (!state.token) return;
  try {
    const res  = await fetch(`${API_BASE}/favorites`, { headers: authHeaders() });
    const data = await res.json();
    if (data.success) {
      state.favorites  = data.data;
      state.favoriteIds = new Set(data.data.map(f => f.cca3));
      updateFavBadge();
    }
  } catch (_) { /* silent */ }
}

function updateFavBadge() {
  const count = state.favorites.length;
  favBadge.textContent    = count;
  favBadge.style.display  = count > 0 ? 'flex' : 'none';
}

async function addFavorite(country) {
  if (!state.user) {
    openAuthModal('login');
    toast.info('Login required', 'Please login to save favorites.');
    return;
  }

  const isPremium = state.user.role === 'premium' && state.user.subscriptionStatus === 'active';
  if (!isPremium) {
    switchView('pricing');
    toast.warning('Pro Feature', 'GeoDiscover Pro is required to save favorites.');
    return;
  }

  const payload = {
    countryName:  country.name?.common || '',
    officialName: country.name?.official || '',
    flag:         country.flags?.svg || country.flags?.png || '',
    capital:      (country.capital || ['N/A'])[0],
    region:       country.region || 'N/A',
    subregion:    country.subregion || 'N/A',
    population:   country.population || 0,
    area:         country.area || 0,
    cca2:         country.cca2 || '',
    cca3:         country.cca3 || '',
    currencies:   country.currencies
      ? Object.values(country.currencies).map(c => `${c.name} (${c.symbol || ''})`).join(', ')
      : '',
    languages: country.languages ? Object.values(country.languages).join(', ') : '',
    mapLink:   country.maps?.googleMaps || '',
  };

  try {
    const res  = await fetch(`${API_BASE}/favorites`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.message || 'Failed to add favorite.');

    state.favorites.push(data.data);
    state.favoriteIds.add(country.cca3);
    updateFavBadge();
    refreshCardFavButtons();
    updateModalFavBtn();
    toast.success('Added to Favorites!', payload.countryName);
  } catch (err) {
    toast.error('Error', err.message);
  }
}

async function removeFavorite(cca3) {
  const fav = state.favorites.find(f => f.cca3 === cca3);
  if (!fav) return;

  try {
    const res  = await fetch(`${API_BASE}/favorites/${fav._id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to remove.');

    state.favorites   = state.favorites.filter(f => f.cca3 !== cca3);
    state.favoriteIds.delete(cca3);
    updateFavBadge();
    refreshCardFavButtons();
    updateModalFavBtn();
    toast.info('Removed', data.message);

    if (state.currentView === 'favorites') renderFavorites();
  } catch (err) {
    toast.error('Error', err.message);
  }
}

async function clearAllFavorites() {
  if (!confirm('Remove all favorites? This cannot be undone.')) return;
  try {
    const res  = await fetch(`${API_BASE}/favorites/clear`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    state.favorites   = [];
    state.favoriteIds = new Set();
    updateFavBadge();
    refreshCardFavButtons();
    updateModalFavBtn();
    renderFavorites();
    toast.info('Cleared', data.message);
  } catch (err) {
    toast.error('Error', err.message);
  }
}

function isFavorite(cca3) {
  return state.favoriteIds.has(cca3);
}

function refreshCardFavButtons() {
  // Update all visible card fav buttons
  document.querySelectorAll('.card-fav-btn').forEach(btn => {
    const cca3 = btn.dataset.cca3;
    const fav  = isFavorite(cca3);
    btn.classList.toggle('active', fav);
    btn.title = fav ? 'Remove from Favorites' : 'Add to Favorites';
    btn.textContent = fav ? '❤️' : '🤍';
  });
}

function updateModalFavBtn() {
  const c    = state.currentCountry;
  if (!c) return;
  const fav  = isFavorite(c.cca3);
  const isPremium = state.user && state.user.role === 'premium' && state.user.subscriptionStatus === 'active';
  
  modalFavBtn.textContent = fav ? '❤️ Remove Favorite' : '❤️ Add to Favorites';
  modalFavBtn.classList.toggle('added', fav);
  
  if (!isPremium) {
    modalFavBtn.title = 'Premium Feature';
    modalFavBtn.style.opacity = '0.7';
  } else {
    modalFavBtn.title = '';
    modalFavBtn.style.opacity = '1';
  }
}

// ─── Subscription Logic ───────────────────────────────────────

async function startSubscription(plan) {
  if (!state.user) {
    openAuthModal('login');
    toast.info('Login Required', 'Please login to subscribe.');
    return;
  }

  try {
    toast.info('Processing...', 'Creating secure checkout session.');
    const res = await fetch(`${API_BASE}/subscribe/create-checkout-session`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ plan })
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.message);

    // Redirect to "Stripe" (simulated in our controller)
    window.location.href = data.url;

  } catch (err) {
    toast.error('Subscription Error', err.message);
  }
}

async function verifySubscriptionParams() {
  const params = new URLSearchParams(window.location.search);
  const success = params.get('success');
  const sessionId = params.get('session_id');
  const plan = params.get('plan');

  if (success === 'true' && sessionId && plan) {
    // Clear URL params without refreshing
    window.history.replaceState({}, document.title, window.location.pathname);
    
    try {
      toast.info('Verifying Payment...', 'Finalizing your Pro subscription.');
      const res = await fetch(`${API_BASE}/subscribe/verify`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ session_id: sessionId, plan })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message);

      // Update local state with new user data
      state.user = data.user;
      localStorage.setItem('we_user', JSON.stringify(data.user));
      
      updateAuthUI();
      toast.success('Subscription Active!', `Welcome to GeoDiscover Pro (${plan})! 💎`);
      
      if (state.currentView === 'pricing') switchView('countries');

    } catch (err) {
      toast.error('Verification Failed', err.message);
    }
  }
}

// ─── Country Data ─────────────────────────────────────────────

async function fetchCountries() {
  if (state.loading) return;
  state.loading = true;
  renderLoading(countriesGrid);

  try {
    const params = new URLSearchParams({
      page:   state.currentPage,
      limit:  ITEMS_PER_PAGE,
      sort:   state.sortBy,
    });
    if (state.searchQuery)     params.set('search', state.searchQuery);
    if (state.selectedRegion !== 'all') params.set('region', state.selectedRegion);

    const res  = await fetch(`${API_BASE}/countries?${params}`);
    const data = await res.json();

    if (!res.ok) throw new Error(data.message || 'Failed to fetch.');

    state.allCountries = data.data;
    state.totalCount   = data.total;
    state.totalPages   = data.totalPages;
    countBadge.textContent = `${data.total} Countries`;

    displayCountries(data);
  } catch (err) {
    renderError(countriesGrid, err.message);
    toast.error('API Error', err.message);
  } finally {
    state.loading = false;
  }
}

function displayCountries(data) {
  const { data: countries, total, page, totalPages } = data;

  resultsInfo.innerHTML = `Showing <strong>${(page - 1) * ITEMS_PER_PAGE + 1}–${Math.min(page * ITEMS_PER_PAGE, total)}</strong> of <strong>${total}</strong> countries`;

  if (!countries.length) {
    renderEmpty(countriesGrid, '🔍', 'No countries found', 'Try a different search term or region.');
    pagination.innerHTML = '';
    return;
  }

  countriesGrid.innerHTML = countries
    .map((c, i) => createCardHTML(c, i, false))
    .join('');

  // Event delegation for cards
  countriesGrid.querySelectorAll('.country-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-fav-btn')) return; // handled separately
      const cca3 = card.dataset.cca3;
      const country = state.allCountries.find(c => c.cca3 === cca3);
      if (country) openModal(country);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
    });
  });

  // Fav button clicks
  countriesGrid.querySelectorAll('.card-fav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cca3 = btn.dataset.cca3;
      const country = state.allCountries.find(c => c.cca3 === cca3);
      if (!country) return;
      isFavorite(cca3) ? removeFavorite(cca3) : addFavorite(country);
    });
  });

  refreshCardFavButtons();
  renderPagination(page, totalPages);
}

function renderFavorites() {
  const isPremium = state.user && state.user.role === 'premium' && state.user.subscriptionStatus === 'active';
  
  // Show lock message if not premium
  const lockMsg = $('premium-locked-message');
  if (lockMsg) lockMsg.style.display = isPremium ? 'none' : 'flex';
  
  if (!isPremium) {
    favoritesGrid.innerHTML = '';
    $('btn-clear-favs').style.display = 'none';
    return;
  }

  $('btn-clear-favs').style.display = state.favorites.length ? 'block' : 'none';

  if (!state.favorites.length) {
    renderEmpty(
      favoritesGrid, '❤️',
      'No favorites yet',
      'Click ❤️ on any country card to save it here.'
    );
    return;
  }

  // Convert favorite schema shape → card-compatible shape
  const asCountries = state.favorites.map(f => ({
    name:       { common: f.countryName, official: f.officialName },
    flags:      { svg: f.flag, png: f.flag },
    capital:    [f.capital],
    region:     f.region,
    subregion:  f.subregion,
    population: f.population,
    area:       f.area,
    cca2:       f.cca2,
    cca3:       f.cca3,
    currencies: f.currencies,
    languages:  { lang: f.languages },
    maps:       { googleMaps: f.mapLink },
    _favId:     f._id,
  }));

  favoritesGrid.innerHTML = asCountries
    .map((c, i) => createCardHTML(c, i, true))
    .join('');

  // Open modal on click
  favoritesGrid.querySelectorAll('.country-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-fav-btn')) return;
      const cca3 = card.dataset.cca3;
      // Try to find full data; fallback to fav data
      const full = state.allCountries.find(c => c.cca3 === cca3);
      const fav  = state.favorites.find(f => f.cca3 === cca3);
      if (full) openModal(full);
      else if (fav) openModal(asCountries.find(c => c.cca3 === cca3));
    });
  });

  // Remove buttons
  favoritesGrid.querySelectorAll('.card-fav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeFavorite(btn.dataset.cca3);
    });
  });
}

// ─── Card HTML ────────────────────────────────────────────────

function createCardHTML(country, index, isFav) {
  const name    = country.name?.common || 'Unknown';
  const flag    = country.flags?.svg || country.flags?.png || '';
  const capital = (country.capital || ['N/A'])[0];
  const region  = country.region || 'N/A';
  const pop     = fmt(country.population);
  const cca2    = country.cca2 || '';
  const cca3    = country.cca3 || '';
  const faved   = isFavorite(cca3);
  const delay   = Math.min(index * 35, 500);

  return `
    <article class="country-card" data-cca3="${cca3}"
             role="button" tabindex="0" aria-label="View details for ${name}"
             style="animation-delay:${delay}ms">
      <div class="card-flag-wrapper">
        <img class="card-flag" src="${flag}" alt="Flag of ${name}" loading="lazy"
             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 4 3%22><rect width=%224%22 height=%223%22 fill=%22%23334155%22/></svg>'"/>
        <div class="flag-overlay"></div>
        <button class="card-fav-btn ${faved ? 'active' : ''}"
                data-cca3="${cca3}"
                title="${faved ? 'Remove from Favorites' : 'Add to Favorites'}"
                aria-label="${faved ? 'Remove from favorites' : 'Add to favorites'}">
          ${faved ? '❤️' : '🤍'}
        </button>
      </div>
      <div class="card-body">
        <h3 class="card-country-name" title="${name}">${name}</h3>
        <div class="card-details">
          <div class="card-detail-row">
            <span class="detail-icon">🏛️</span>
            <span class="detail-label">Capital:</span>
            <span class="detail-value" title="${capital}">${capital}</span>
          </div>
          <div class="card-detail-row">
            <span class="detail-icon">🌍</span>
            <span class="detail-label">Region:</span>
            <span class="detail-value">${region}</span>
          </div>
          <div class="card-detail-row">
            <span class="detail-icon">👥</span>
            <span class="detail-label">Pop:</span>
            <span class="detail-value">${pop}</span>
          </div>
        </div>
        <div class="card-tags">
          <span class="tag tag-region">${region}</span>
          ${cca2 ? `<span class="tag tag-code">${cca2}</span>` : ''}
          ${cca3 ? `<span class="tag tag-code">${cca3}</span>` : ''}
        </div>
      </div>
    </article>`;
}

// ─── Render Helpers ───────────────────────────────────────────

function renderLoading(container) {
  container.innerHTML = `
    <div class="loading-container">
      <div class="spinner-ring"></div>
      <p class="loading-text">Loading countries…</p>
    </div>`;
}

function renderError(container, msg) {
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">⚠️</div>
      <h3 class="empty-title">Failed to Load</h3>
      <p class="empty-sub">${msg || 'Something went wrong.'}</p>
      <button class="retry-btn" onclick="fetchCountries()">↻ Retry</button>
    </div>`;
  resultsInfo.innerHTML = 'Error loading data';
}

function renderEmpty(container, icon, title, sub) {
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">${icon}</div>
      <h3 class="empty-title">${title}</h3>
      <p class="empty-sub">${sub}</p>
    </div>`;
}

// ─── Pagination ───────────────────────────────────────────────

function renderPagination(current, total) {
  if (total <= 1) { pagination.innerHTML = ''; return; }

  const MAX_VISIBLE = 5;
  let start = Math.max(1, current - Math.floor(MAX_VISIBLE / 2));
  let end   = Math.min(total, start + MAX_VISIBLE - 1);
  if (end - start < MAX_VISIBLE - 1) start = Math.max(1, end - MAX_VISIBLE + 1);

  let html = `
    <button class="page-btn" id="pg-prev" aria-label="Previous page" ${current === 1 ? 'disabled' : ''}>‹</button>`;

  if (start > 1) html += `<button class="page-btn" data-page="1">1</button>${start > 2 ? '<span class="page-info">…</span>' : ''}`;

  for (let i = start; i <= end; i++) {
    html += `<button class="page-btn ${i === current ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }

  if (end < total) {
    html += `${end < total - 1 ? '<span class="page-info">…</span>' : ''}<button class="page-btn" data-page="${total}">${total}</button>`;
  }

  html += `<button class="page-btn" id="pg-next" aria-label="Next page" ${current === total ? 'disabled' : ''}>›</button>`;
  html += `<span class="page-info">Page ${current} of ${total}</span>`;

  pagination.innerHTML = html;

  $('pg-prev')?.addEventListener('click', () => goToPage(current - 1));
  $('pg-next')?.addEventListener('click', () => goToPage(current + 1));
  pagination.querySelectorAll('.page-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => goToPage(Number(btn.dataset.page)));
  });
}

function goToPage(page) {
  if (page < 1 || page > state.totalPages) return;
  state.currentPage = page;
  fetchCountries();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Country Detail Modal ─────────────────────────────────────

function openModal(country) {
  state.currentCountry = country;

  const name       = country.name?.common || 'Unknown';
  const official   = country.name?.official || '';
  const flag       = country.flags?.svg || country.flags?.png || '';
  const capital    = (country.capital || ['N/A'])[0];
  const region     = country.region || 'N/A';
  const subregion  = country.subregion || 'N/A';
  const population = fmt(country.population);
  const area       = country.area ? `${fmt(country.area)} km²` : 'N/A';
  const cca2       = country.cca2 || 'N/A';
  const cca3       = country.cca3 || 'N/A';
  const mapLink    = country.maps?.googleMaps || `https://www.google.com/maps/search/${encodeURIComponent(name)}`;

  const nativeLang = Object.values(country.name?.nativeName || {})[0];
  const nativeName = nativeLang?.common || official;

  const currencies = (() => {
    if (typeof country.currencies === 'string') return country.currencies;
    return country.currencies
      ? Object.values(country.currencies).map(c => `${c.name} (${c.symbol || ''})`).join(', ')
      : 'N/A';
  })();

  const languages = (() => {
    if (typeof country.languages === 'string') return country.languages;
    return country.languages ? Object.values(country.languages).join(', ') : 'N/A';
  })();

  const timezones = (country.timezones || ['N/A']).slice(0, 4).join(' · ');

  // Populate
  $('modal-flag').src           = flag;
  $('modal-flag').alt           = `Flag of ${name}`;
  $('modal-name').textContent   = name;
  $('modal-native').textContent = nativeName !== name ? `(${nativeName})` : '';
  $('modal-capital').textContent  = capital;
  $('modal-region').textContent   = region;
  $('modal-subregion').textContent= subregion;
  $('modal-population').textContent = population;
  $('modal-area').textContent     = area;
  $('modal-codes').textContent    = `${cca2} / ${cca3}`;
  $('modal-currencies').textContent = currencies;
  $('modal-languages').textContent  = languages;
  $('modal-timezones').textContent  = timezones;
  $('modal-map-link').href          = mapLink;
  $('modal-title').textContent      = name;

  updateModalFavBtn();

  modalOverlay.classList.add('active');
  modalOverlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modalOverlay.classList.remove('active');
  modalOverlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  state.currentCountry = null;
}

// ─── Views ────────────────────────────────────────────────────

function switchView(view) {
  state.currentView = view;
  const isCountries = view === 'countries';
  const isFavs = view === 'favorites';
  const isPricing = view === 'pricing';

  tabCountries.classList.toggle('active', isCountries);
  tabFavorites.classList.toggle('active', isFavs);
  $('tab-pricing').classList.toggle('active', isPricing);

  viewCountries.style.display = isCountries ? 'block' : 'none';
  viewFavorites.style.display = isFavs ? 'block' : 'none';
  $('view-pricing').style.display = isPricing ? 'block' : 'none';

  if (isFavs) renderFavorites();
}

// ─── Filter / Search / Sort ───────────────────────────────────

function applyFilters() {
  state.currentPage = 1;
  fetchCountries();
}

const debouncedSearch = debounce((q) => {
  state.searchQuery = q;
  applyFilters();
}, 400);

// ─── Theme ────────────────────────────────────────────────────

function toggleTheme() {
  state.darkMode = !state.darkMode;
  document.body.classList.toggle('light', !state.darkMode);
  themeToggle.textContent = state.darkMode ? '☀️' : '🌙';
  localStorage.setItem('we_theme', state.darkMode ? 'dark' : 'light');
}

function loadTheme() {
  const saved = localStorage.getItem('we_theme');
  if (saved === 'light') {
    state.darkMode = false;
    document.body.classList.add('light');
    themeToggle.textContent = '🌙';
  }
}

// ─── Password visibility toggle ───────────────────────────────

document.querySelectorAll('.toggle-pw').forEach(btn => {
  btn.addEventListener('click', () => {
    const inp = $(btn.dataset.target);
    if (!inp) return;
    inp.type = inp.type === 'password' ? 'text' : 'password';
    btn.textContent = inp.type === 'password' ? '👁' : '🙈';
  });
});

// ─── Event Listeners ──────────────────────────────────────────

// Search
searchInput.addEventListener('input', (e) => {
  const val = e.target.value;
  searchClear.classList.toggle('visible', val.length > 0);
  debouncedSearch(val);
});

searchClear.addEventListener('click', () => {
  searchInput.value = '';
  searchClear.classList.remove('visible');
  state.searchQuery = '';
  searchInput.focus();
  applyFilters();
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    searchInput.value = '';
    searchClear.classList.remove('visible');
    state.searchQuery = '';
    applyFilters();
  }
});

// Region filter
regionSelect.addEventListener('change', (e) => {
  state.selectedRegion = e.target.value;
  applyFilters();
});

// Sort
sortBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    sortBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.sortBy = btn.dataset.sort;
    applyFilters();
  });
});

// View tabs
tabCountries.addEventListener('click', () => switchView('countries'));
tabFavorites.addEventListener('click', () => {
  if (!state.user) { openAuthModal('login'); toast.info('Login required', 'Login to view your favorites.'); return; }
  switchView('favorites');
});
$('tab-pricing').addEventListener('click', () => switchView('pricing'));

// Favorites button (nav)
$('btn-favorites').addEventListener('click', () => {
  if (!state.user) { openAuthModal('login'); return; }
  switchView('favorites');
});

$('btn-clear-favs').addEventListener('click', clearAllFavorites);

// Auth buttons
btnLogin.addEventListener('click',  () => openAuthModal('login'));
btnSignup.addEventListener('click', () => openAuthModal('signup'));
btnLogout.addEventListener('click', () => {
  clearAuth();
  renderFavorites();
  toast.info('Logged out', 'See you next time!');
});

authModalClose.addEventListener('click', closeAuthModal);
$('switch-to-signup').addEventListener('click', (e) => { e.preventDefault(); openAuthModal('signup'); });
$('switch-to-login').addEventListener('click',  (e) => { e.preventDefault(); openAuthModal('login'); });

authModal.addEventListener('click', (e) => { if (e.target === authModal) closeAuthModal(); });

// Country modal
modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

modalFavBtn.addEventListener('click', () => {
  const c = state.currentCountry;
  if (!c) return;
  isFavorite(c.cca3) ? removeFavorite(c.cca3) : addFavorite(c);
});

// Theme
themeToggle.addEventListener('click', toggleTheme);

// Home brand link
$('nav-home').addEventListener('click', (e) => {
  e.preventDefault();
  switchView('countries');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Keyboard: ESC closes any open modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (modalOverlay.classList.contains('active')) closeModal();
    if (authModal.classList.contains('active'))   closeAuthModal();
  }
});

// ─── Init ─────────────────────────────────────────────────────

window.startSubscription = startSubscription; // Make global for onclick
window.switchView = switchView;

loadTheme();
loadSavedAuth();
verifySubscriptionParams(); // Check if we just returned from payment
fetchCountries();
