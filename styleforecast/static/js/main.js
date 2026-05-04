/* StyleForecast — main.js */

// ============================================================
// Profile (localStorage)
// ============================================================

const PROFILE_KEY = 'sf_profile';

function getProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || null; }
  catch { return null; }
}

function saveProfile(data) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(data));
}

function applyProfile() {
  const p = getProfile();
  const avatarEl  = document.getElementById('profileAvatar');
  const profileBtn = document.getElementById('profileBtn');
  const greetingEl = document.getElementById('greetingLine');

  if (!p) return;

  // Avatar initials
  if (avatarEl && p.name) {
    avatarEl.textContent = p.name.trim().charAt(0).toUpperCase();
  }
  if (profileBtn) profileBtn.style.display = 'block';

  // Greeting
  if (greetingEl && p.name) {
    const hour = new Date().getHours();
    const salutation = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    greetingEl.textContent = `${salutation}, ${p.name.split(' ')[0]}.`;
  }

  // Pre-fill city input if no weather yet
  const cityInput = document.querySelector('.city-input');
  if (cityInput && p.defaultCity && !cityInput.value) {
    cityInput.value = p.defaultCity;
  }
}

// ============================================================
// Onboarding Modal
// ============================================================

const overlay    = document.getElementById('onboardingOverlay');
let selectedStyle = '';

function showOnboarding() {
  if (overlay) overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function hideOnboarding() {
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

function goToStep(n) {
  document.querySelectorAll('.ob-step').forEach(s => s.classList.remove('active'));
  const step = document.getElementById(`obStep${n}`);
  if (step) step.classList.add('active');
}

// Next / back buttons
document.querySelectorAll('.ob-next').forEach(btn => {
  btn.addEventListener('click', () => goToStep(parseInt(btn.dataset.next)));
});
document.querySelectorAll('.ob-back').forEach(btn => {
  btn.addEventListener('click', () => goToStep(parseInt(btn.dataset.back)));
});

// Style cards
document.querySelectorAll('.style-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.style-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    selectedStyle = card.dataset.style;
  });
});

// Finish onboarding
const obFinish = document.getElementById('obFinish');
if (obFinish) {
  obFinish.addEventListener('click', () => {
    const name = (document.getElementById('obName')?.value || '').trim();
    const city = (document.getElementById('obCity')?.value || '').trim();

    saveProfile({
      name,
      defaultCity: city,
      style: selectedStyle || 'casual',
      onboardingDone: true,
    });

    hideOnboarding();
    applyProfile();

    // Auto-search the city
    if (city) {
      const cityInput = document.querySelector('.city-input');
      if (cityInput) {
        cityInput.value = city;
        cityInput.closest('form')?.submit();
        return; // page will reload
      }
    }

    // Start tour after a short delay
    setTimeout(() => startTour(), 400);
  });
}

// ============================================================
// Profile edit modal
// ============================================================

const profileModalOverlay = document.getElementById('profileModalOverlay');
const profileBtn          = document.getElementById('profileBtn');

profileBtn?.addEventListener('click', openProfileModal);
document.getElementById('closeProfileModal')?.addEventListener('click', closeProfileModal);
document.getElementById('cancelProfileEdit')?.addEventListener('click', closeProfileModal);

profileModalOverlay?.addEventListener('click', (e) => {
  if (e.target === profileModalOverlay) closeProfileModal();
});

function openProfileModal() {
  const p = getProfile() || {};
  const editName  = document.getElementById('editName');
  const editCity  = document.getElementById('editCity');
  const editStyle = document.getElementById('editStyle');
  if (editName)  editName.value  = p.name        || '';
  if (editCity)  editCity.value  = p.defaultCity || '';
  if (editStyle) editStyle.value = p.style       || 'casual';
  profileModalOverlay?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeProfileModal() {
  profileModalOverlay?.classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('saveProfileEdit')?.addEventListener('click', () => {
  const p = getProfile() || {};
  p.name        = document.getElementById('editName')?.value.trim()  || p.name;
  p.defaultCity = document.getElementById('editCity')?.value.trim()  || p.defaultCity;
  p.style       = document.getElementById('editStyle')?.value        || p.style;
  saveProfile(p);
  applyProfile();
  closeProfileModal();
  showToast('Profile updated');
});

document.getElementById('resetOnboarding')?.addEventListener('click', () => {
  localStorage.removeItem(PROFILE_KEY);
  closeProfileModal();
  goToStep(1);
  showOnboarding();
});

// ============================================================
// Tour
// ============================================================

const TOUR_STEPS = [
  {
    target:  '.city-input',
    title:   'Search your city',
    text:    'Enter any city name or ZIP code. We\'ll pull live weather — temperature, rain chance, wind, and UV index.',
    position: 'below',
  },
  {
    target:  '.outfit-grid, .empty-state',
    title:   'Your outfit recommendations',
    text:    'We score every possible outfit combination from your wardrobe against today\'s weather and surface the top 3.',
    position: 'below',
  },
  {
    target:  '#navWardrobe',
    title:   'Build your wardrobe',
    text:    'Add your clothing items here — tops, bottoms, outerwear, shoes, and accessories. The more you add, the better the recommendations.',
    position: 'below',
  },
  {
    target:  '.outfit-grid article:first-child, .empty-state',
    title:   'Rate and save outfits',
    text:    'Give outfits a star rating and save your favourites. Ratings nudge future recommendations in your direction.',
    position: 'above',
  },
];

let tourStep = 0;
const tourOverlay   = document.getElementById('tourOverlay');
const tourSpotlight = document.getElementById('tourSpotlight');
const tourCard      = document.getElementById('tourCard');

function startTour() {
  tourStep = 0;
  renderTourStep();
  tourOverlay?.classList.add('active');
}

function endTour() {
  tourOverlay?.classList.remove('active');
  // Remove any tour highlight classes
  document.querySelectorAll('.tour-highlighted').forEach(el => el.classList.remove('tour-highlighted'));
}

function renderTourStep() {
  const step   = TOUR_STEPS[tourStep];
  const target = document.querySelector(step.target);

  document.getElementById('tourStepLabel').textContent = `Step ${tourStep + 1} of ${TOUR_STEPS.length}`;
  document.getElementById('tourCardTitle').textContent = step.title;
  document.getElementById('tourCardText').textContent  = step.text;
  document.getElementById('tourNext').textContent      = tourStep < TOUR_STEPS.length - 1 ? 'Next →' : 'Done ✓';

  if (!target) { positionCardCenter(); return; }

  const rect   = target.getBoundingClientRect();
  const pad    = 10;

  // Position spotlight
  Object.assign(tourSpotlight.style, {
    top:    `${rect.top    - pad + window.scrollY}px`,
    left:   `${rect.left   - pad}px`,
    width:  `${rect.width  + pad * 2}px`,
    height: `${rect.height + pad * 2}px`,
  });

  // Position card
  const cardW = 300;
  let cardTop, cardLeft;

  if (step.position === 'below') {
    cardTop  = rect.bottom + pad + 16 + window.scrollY;
    cardLeft = Math.min(rect.left, window.innerWidth - cardW - 16);
  } else {
    cardTop  = rect.top - pad - 180 + window.scrollY;
    cardLeft = Math.min(rect.left, window.innerWidth - cardW - 16);
  }

  cardLeft = Math.max(16, cardLeft);

  Object.assign(tourCard.style, {
    top:  `${cardTop}px`,
    left: `${cardLeft}px`,
  });

  // Scroll target into view
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function positionCardCenter() {
  Object.assign(tourSpotlight.style, { width: '0', height: '0', top: '50%', left: '50%' });
  Object.assign(tourCard.style, {
    top:       '50%',
    left:      '50%',
    transform: 'translate(-50%, -50%)',
  });
}

document.getElementById('tourNext')?.addEventListener('click', () => {
  if (tourStep < TOUR_STEPS.length - 1) {
    tourStep++;
    tourCard.style.transform = '';
    renderTourStep();
  } else {
    endTour();
  }
});

document.getElementById('tourSkip')?.addEventListener('click', endTour);

// ============================================================
// Mobile nav
// ============================================================

const menuToggle = document.getElementById('menuToggle');
const siteNav    = document.getElementById('siteNav');

if (menuToggle && siteNav) {
  menuToggle.addEventListener('click', () => siteNav.classList.toggle('open'));
}

// ============================================================
// Wardrobe drawer
// ============================================================

const addItemBtn  = document.getElementById('addItemBtn');
const addDrawer   = document.getElementById('addDrawer');
const closeDrawer = document.getElementById('closeDrawer');
const cancelAdd   = document.getElementById('cancelAdd');

function openDrawer()   { addDrawer?.classList.add('open'); }
function closeDrawerFn(){ addDrawer?.classList.remove('open'); }

addItemBtn?.addEventListener('click',  openDrawer);
closeDrawer?.addEventListener('click', closeDrawerFn);
cancelAdd?.addEventListener('click',   closeDrawerFn);

addDrawer?.addEventListener('click', (e) => { if (e.target === addDrawer) closeDrawerFn(); });

// ============================================================
// Tile menus
// ============================================================

function toggleTileMenu(id) {
  const menu = document.getElementById(`menu-${id}`);
  if (!menu) return;
  const isOpen = menu.classList.contains('open');
  document.querySelectorAll('.tile-menu-dropdown.open').forEach(m => m.classList.remove('open'));
  if (!isOpen) menu.classList.add('open');
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.tile-menu')) {
    document.querySelectorAll('.tile-menu-dropdown.open').forEach(m => m.classList.remove('open'));
  }
});

function openEdit(id)  {
  document.querySelectorAll('.tile-menu-dropdown.open').forEach(m => m.classList.remove('open'));
  const panel = document.getElementById(`edit-${id}`);
  if (panel) panel.style.display = 'block';
}
function closeEdit(id) {
  const panel = document.getElementById(`edit-${id}`);
  if (panel) panel.style.display = 'none';
}

// ============================================================
// Star ratings
// ============================================================

function bindStarRatings(container) {
  container.querySelectorAll('.star-rating').forEach(ratingEl => {
    const stars = ratingEl.querySelectorAll('.star');
    const ids   = ratingEl.dataset.ids;
    stars.forEach((star, idx) => {
      star.addEventListener('mouseenter', () => stars.forEach((s, i) => s.classList.toggle('active', i <= idx)));
      star.addEventListener('mouseleave', () => {
        stars.forEach(s => { s.classList.remove('active'); if (s.classList.contains('filled')) s.classList.add('active'); });
      });
      star.addEventListener('click', async () => {
        const rating  = idx + 1;
        const itemIds = ids.split(',').map(Number);
        const res = await fetch('/rate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_ids: itemIds, rating }),
        });
        if (res.ok) {
          stars.forEach((s, i) => { s.classList.toggle('filled', i <= idx); s.classList.toggle('active', i <= idx); });
          showToast(`Rated ${rating}★`);
        }
      });
    });
  });
}

bindStarRatings(document);

// ============================================================
// Save to favorites
// ============================================================

function bindSaveFav(container) {
  container.querySelectorAll('.save-fav').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ids    = btn.dataset.ids.split(',').map(Number);
      const label  = btn.dataset.label  || 'Saved Outfit';
      const score  = parseFloat(btn.dataset.score) || 0;
      const reason = btn.dataset.reason || '';
      const res = await fetch('/favorite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_ids: ids, label, score, reason }),
      });
      if (res.ok) {
        btn.textContent = '♥ Saved';
        btn.disabled = true;
        showToast('Saved to favorites');
      }
    });
  });
}

bindSaveFav(document);

// ============================================================
// Refresh recommendations
// ============================================================

const refreshBtn = document.getElementById('refreshBtn');
const outfitGrid = document.getElementById('outfitGrid');

refreshBtn?.addEventListener('click', async () => {
  refreshBtn.textContent = '…';
  refreshBtn.disabled = true;
  try {
    const res  = await fetch('/recommend', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || 'Could not refresh', 'error'); return; }
    if (outfitGrid) renderOutfits(data);
  } catch { showToast('Network error', 'error'); }
  finally   { refreshBtn.textContent = 'Refresh'; refreshBtn.disabled = false; }
});

function renderOutfits(outfits) {
  if (!outfitGrid) return;
  outfitGrid.innerHTML = '';
  outfits.forEach((rec, i) => {
    const card = document.createElement('article');
    card.className = 'outfit-card';

    const chips = (rec.pieces || []).map(it => `
      <div class="outfit-item-chip">
        <span class="chip-dot" style="background:${it.color.toLowerCase()};"></span>
        <span class="chip-cat">${it.category}</span>
        <span class="chip-name">${it.name}</span>
      </div>`).join('');

    const stars = Array.from({ length: 5 }, (_, n) =>
      `<button class="star" data-val="${n+1}">★</button>`).join('');

    card.innerHTML = `
      <div class="outfit-card-header">
        <span class="outfit-label">${rec.label}</span>
        <span class="outfit-score">
          <span class="score-bar" style="--score:${rec.score}"></span>
          ${rec.score}
        </span>
      </div>
      <div class="outfit-items">${chips}</div>
      <p class="outfit-reason">${rec.reason}</p>
      <div class="outfit-actions">
        <div class="star-rating" data-ids="${rec.item_ids.join(',')}">${stars}</div>
        <button class="btn btn--ghost btn--sm save-fav"
          data-ids="${rec.item_ids.join(',')}"
          data-label="${rec.label}"
          data-score="${rec.score}"
          data-reason="${rec.reason}">♡ Save</button>
      </div>`;

    if (i === 0) card.style.borderTop = '3px solid var(--c-accent)';
    outfitGrid.appendChild(card);
  });
  bindStarRatings(outfitGrid);
  bindSaveFav(outfitGrid);
}

// ============================================================
// Toast notifications
// ============================================================

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `flash flash--${type}`;
  toast.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:999;max-width:320px;animation:fadeUp 200ms ease;';
  toast.innerHTML = `<span>${message}</span><button class="flash-close" onclick="this.parentElement.remove()">×</button>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

const style = document.createElement('style');
style.textContent = '@keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }';
document.head.appendChild(style);

document.querySelectorAll('.flash').forEach(el => {
  setTimeout(() => el.style.opacity === '' && el.remove(), 5000);
});

// ============================================================
// Init — runs on every page load
// ============================================================

(function init() {
  const profile = getProfile();

  if (!profile || !profile.onboardingDone) {
    // First visit — show onboarding
    showOnboarding();
  } else {
    applyProfile();

    // If on dashboard with no weather yet, auto-search default city
    const cityInput = document.querySelector('.city-input');
    const hasWeather = document.querySelector('.weather-panel');
    if (cityInput && profile.defaultCity && !hasWeather) {
      cityInput.value = profile.defaultCity;
      cityInput.closest('form')?.submit();
    }
  }
})();
