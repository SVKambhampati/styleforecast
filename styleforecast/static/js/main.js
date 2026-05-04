/* StyleForecast — main.js */

// ── Mobile nav ──────────────────────────────────────────────
const menuToggle = document.getElementById('menuToggle');
const siteNav    = document.querySelector('.site-nav');

if (menuToggle && siteNav) {
  menuToggle.addEventListener('click', () => {
    siteNav.classList.toggle('open');
  });
}

// ── Wardrobe drawer ─────────────────────────────────────────
const addItemBtn  = document.getElementById('addItemBtn');
const addDrawer   = document.getElementById('addDrawer');
const closeDrawer = document.getElementById('closeDrawer');
const cancelAdd   = document.getElementById('cancelAdd');

function openDrawer()  { addDrawer && addDrawer.classList.add('open'); }
function closeDrawerFn() { addDrawer && addDrawer.classList.remove('open'); }

if (addItemBtn)  addItemBtn.addEventListener('click', openDrawer);
if (closeDrawer) closeDrawer.addEventListener('click', closeDrawerFn);
if (cancelAdd)   cancelAdd.addEventListener('click', closeDrawerFn);

if (addDrawer) {
  addDrawer.addEventListener('click', (e) => {
    if (e.target === addDrawer) closeDrawerFn();
  });
}

// ── Tile menus ───────────────────────────────────────────────
function toggleTileMenu(id) {
  const menu = document.getElementById(`menu-${id}`);
  if (!menu) return;
  const isOpen = menu.classList.contains('open');
  // close all first
  document.querySelectorAll('.tile-menu-dropdown.open').forEach(m => m.classList.remove('open'));
  if (!isOpen) menu.classList.add('open');
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.tile-menu')) {
    document.querySelectorAll('.tile-menu-dropdown.open').forEach(m => m.classList.remove('open'));
  }
});

// ── Wardrobe item edit panels ────────────────────────────────
function openEdit(id) {
  // Close any open dropdowns
  document.querySelectorAll('.tile-menu-dropdown.open').forEach(m => m.classList.remove('open'));
  const panel = document.getElementById(`edit-${id}`);
  if (panel) panel.style.display = 'block';
}

function closeEdit(id) {
  const panel = document.getElementById(`edit-${id}`);
  if (panel) panel.style.display = 'none';
}

// ── Star ratings ─────────────────────────────────────────────
document.querySelectorAll('.star-rating').forEach(ratingEl => {
  const stars = ratingEl.querySelectorAll('.star');
  const ids   = ratingEl.dataset.ids;

  stars.forEach((star, idx) => {
    star.addEventListener('mouseenter', () => {
      stars.forEach((s, i) => s.classList.toggle('active', i <= idx));
    });
    star.addEventListener('mouseleave', () => {
      stars.forEach(s => s.classList.remove('active'));
      // re-highlight filled stars
      stars.forEach(s => {
        if (s.classList.contains('filled')) s.classList.add('active');
      });
    });
    star.addEventListener('click', async () => {
      const rating = idx + 1;
      const itemIds = ids.split(',').map(Number);
      try {
        const res = await fetch('/rate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_ids: itemIds, rating }),
        });
        if (res.ok) {
          stars.forEach((s, i) => {
            s.classList.toggle('filled', i <= idx);
            s.classList.toggle('active', i <= idx);
          });
          showToast(`Rated ${rating} star${rating > 1 ? 's' : ''}`);
        }
      } catch (err) {
        console.error(err);
      }
    });
  });
});

// ── Save to favorites ────────────────────────────────────────
document.querySelectorAll('.save-fav').forEach(btn => {
  btn.addEventListener('click', async () => {
    const ids    = btn.dataset.ids.split(',').map(Number);
    const label  = btn.dataset.label  || 'Saved Outfit';
    const score  = parseFloat(btn.dataset.score) || 0;
    const reason = btn.dataset.reason || '';

    try {
      const res = await fetch('/favorite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_ids: ids, label, score, reason }),
      });
      const data = await res.json();
      if (res.ok) {
        btn.textContent = '♥ Saved';
        btn.disabled = true;
        showToast('Outfit saved to favorites');
      } else {
        showToast(data.error || 'Could not save', 'error');
      }
    } catch (err) {
      console.error(err);
    }
  });
});

// ── Refresh recommendations ──────────────────────────────────
const refreshBtn  = document.getElementById('refreshBtn');
const outfitGrid  = document.getElementById('outfitGrid');

if (refreshBtn) {
  refreshBtn.addEventListener('click', async () => {
    refreshBtn.textContent = '…';
    refreshBtn.disabled = true;
    try {
      const res  = await fetch('/recommend', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'Could not refresh', 'error'); return; }
      if (outfitGrid) renderOutfits(data);
    } catch (err) {
      showToast('Network error', 'error');
    } finally {
      refreshBtn.textContent = 'Refresh';
      refreshBtn.disabled = false;
    }
  });
}

function renderOutfits(outfits) {
  if (!outfitGrid) return;
  outfitGrid.innerHTML = '';
  outfits.forEach((rec, i) => {
    const card = document.createElement('article');
    card.className = 'outfit-card';
    card.dataset.score = rec.score;

    const stars = Array.from({ length: 5 }, (_, n) =>
      `<button class="star" data-val="${n+1}" title="${n+1} star">★</button>`
    ).join('');

    const chips = rec.pieces.map(it => `
      <div class="outfit-item-chip">
        <span class="chip-dot" style="background:${it.color.toLowerCase()};"></span>
        <span class="chip-cat">${it.category}</span>
        <span class="chip-name">${it.name}</span>
      </div>
    `).join('');

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
      </div>
    `;
    if (i === 0) card.style.borderTop = '3px solid var(--c-accent)';
    outfitGrid.appendChild(card);
  });
  // Re-bind events on new cards
  bindStarRatings(outfitGrid);
  bindSaveFav(outfitGrid);
}

function bindStarRatings(container) {
  container.querySelectorAll('.star-rating').forEach(ratingEl => {
    const stars = ratingEl.querySelectorAll('.star');
    const ids   = ratingEl.dataset.ids;
    stars.forEach((star, idx) => {
      star.addEventListener('mouseenter', () => stars.forEach((s, i) => s.classList.toggle('active', i <= idx)));
      star.addEventListener('mouseleave', () => stars.forEach(s => { s.classList.remove('active'); if (s.classList.contains('filled')) s.classList.add('active'); }));
      star.addEventListener('click', async () => {
        const rating = idx + 1;
        const itemIds = ids.split(',').map(Number);
        const res = await fetch('/rate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_ids: itemIds, rating }) });
        if (res.ok) { stars.forEach((s, i) => { s.classList.toggle('filled', i <= idx); s.classList.toggle('active', i <= idx); }); showToast(`Rated ${rating}★`); }
      });
    });
  });
}

function bindSaveFav(container) {
  container.querySelectorAll('.save-fav').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ids = btn.dataset.ids.split(',').map(Number);
      const res = await fetch('/favorite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_ids: ids, label: btn.dataset.label, score: parseFloat(btn.dataset.score), reason: btn.dataset.reason }) });
      if (res.ok) { btn.textContent = '♥ Saved'; btn.disabled = true; showToast('Saved to favorites'); }
    });
  });
}

// ── Toast notifications ──────────────────────────────────────
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `flash flash--${type}`;
  toast.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:999;max-width:320px;animation:fadeUp 200ms ease;';
  toast.innerHTML = `<span>${message}</span><button class="flash-close" onclick="this.parentElement.remove()">×</button>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// Add CSS for fadeUp animation
const style = document.createElement('style');
style.textContent = '@keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }';
document.head.appendChild(style);

// ── Flash auto-dismiss ───────────────────────────────────────
document.querySelectorAll('.flash').forEach(el => {
  setTimeout(() => el.style.opacity === '' && el.remove(), 5000);
});
