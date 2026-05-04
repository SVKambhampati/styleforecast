/* StyleForecast — wardrobe preset picker */

const state = { gender: null, categoryKey: null, type: null, color: null };

const steps = {
  gender:   document.getElementById('pStepGender'),
  category: document.getElementById('pStepCategory'),
  type:     document.getElementById('pStepType'),
  color:    document.getElementById('pStepColor'),
};
const backBtn    = document.getElementById('pickerBack');
const breadcrumb = document.getElementById('pickerBreadcrumb');
const stepOrder  = ['gender', 'category', 'type', 'color'];

function showStep(name) {
  Object.values(steps).forEach(s => s?.classList.remove('active'));
  steps[name]?.classList.add('active');
  backBtn.style.display = name === 'gender' ? 'none' : 'block';
  updateBreadcrumb();
}

function updateBreadcrumb() {
  const parts = [];
  if (state.gender)      parts.push(state.gender === 'mens' ? "Men's" : "Women's");
  if (state.categoryKey) parts.push(PRESETS[state.gender]?.[state.categoryKey]?.label || '');
  if (state.type)        parts.push(state.type.label);
  breadcrumb.textContent = parts.join(' › ');
}

// ── Back button ──────────────────────────────────────────────
backBtn?.addEventListener('click', () => {
  const active = stepOrder.find(s => steps[s]?.classList.contains('active'));
  const idx    = stepOrder.indexOf(active);
  if (idx > 0) {
    // Clear state for current and forward steps
    if (active === 'color')    { state.color = null; resetColorStep(); }
    if (active === 'type')     { state.type  = null; }
    if (active === 'category') { state.categoryKey = null; }
    showStep(stepOrder[idx - 1]);
  }
});

// ── Step 1: Gender ───────────────────────────────────────────
document.querySelectorAll('.gender-card').forEach(card => {
  card.addEventListener('click', () => {
    state.gender = card.dataset.gender;
    buildCategoryGrid();
    showStep('category');
  });
});

// ── Step 2: Category ─────────────────────────────────────────
function buildCategoryGrid() {
  const grid = document.getElementById('categoryGrid');
  grid.innerHTML = '';
  const cats = PRESETS[state.gender] || {};
  Object.entries(cats).forEach(([key, cat]) => {
    const btn = document.createElement('button');
    btn.className = 'category-tile';
    btn.dataset.key = key;
    btn.innerHTML = `<span class="cat-icon">${cat.icon}</span><span class="cat-label">${cat.label}</span>`;
    btn.addEventListener('click', () => {
      state.categoryKey = key;
      buildTypeList();
      document.getElementById('typeStepTitle').innerHTML =
        `Choose a <em>${cat.label.toLowerCase().replace(' & dresses','').trim()}</em>`;
      showStep('type');
    });
    grid.appendChild(btn);
  });
}

// ── Step 3: Clothing type ────────────────────────────────────
function buildTypeList() {
  const list  = document.getElementById('typeList');
  list.innerHTML = '';
  const types = PRESETS[state.gender]?.[state.categoryKey]?.types || [];
  types.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'type-item';
    btn.innerHTML = `
      <span class="type-item-name">${t.label}</span>
      <div class="type-item-meta">
        <span class="tile-tag tile-tag--warmth">${t.warmth}</span>
        <span class="tile-tag tile-tag--formal">${t.formality}</span>
        <span class="tile-tag tile-tag--season">${t.season}</span>
      </div>`;
    btn.addEventListener('click', () => {
      state.type = t;
      buildColorGrid();
      showStep('color');
    });
    list.appendChild(btn);
  });
}

// ── Step 4: Color ────────────────────────────────────────────
function buildColorGrid() {
  const grid = document.getElementById('colorGrid');
  grid.innerHTML = '';
  state.color = null;
  document.getElementById('pickerConfirm').style.display = 'none';

  COLORS.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'color-swatch';
    btn.title = c.name;
    btn.dataset.name = c.name;
    btn.dataset.hex  = c.hex;

    // Determine if we need a dark ring (light colors)
    const isLight = isLightColor(c.hex);
    btn.style.cssText = `background:${c.hex};${isLight ? 'border-color:#D4CFC6;' : ''}`;

    btn.innerHTML = `<span class="swatch-label">${c.name}</span>`;
    btn.addEventListener('click', () => selectColor(c, btn));
    grid.appendChild(btn);
  });
}

function selectColor(color, btn) {
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
  btn.classList.add('selected');
  state.color = color;

  const confirm = document.getElementById('pickerConfirm');
  const preview = document.getElementById('confirmPreview');
  confirm.style.display = 'flex';

  const name = `${color.name} ${state.type.label}`;
  preview.innerHTML = `
    <span class="chip-dot" style="background:${color.hex}; width:14px; height:14px; border:1px solid rgba(0,0,0,.12);"></span>
    <span style="font-weight:600; font-size:14px;">${name}</span>
    <span class="tile-tag tile-tag--warmth" style="margin-left:4px">${state.type.warmth}</span>
  `;
}

function resetColorStep() {
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
  document.getElementById('pickerConfirm').style.display = 'none';
}

// ── Submit ───────────────────────────────────────────────────
document.getElementById('pickerSubmit')?.addEventListener('click', () => {
  if (!state.color || !state.type || !state.categoryKey) return;

  const name = `${state.color.name} ${state.type.label}`;
  document.getElementById('pName').value     = name;
  document.getElementById('pCategory').value = state.categoryKey;
  document.getElementById('pColor').value    = state.color.name.toLowerCase();
  document.getElementById('pWarmth').value   = state.type.warmth;
  document.getElementById('pFormality').value= state.type.formality;
  document.getElementById('pSeason').value   = state.type.season;
  document.getElementById('pTags').value     = state.type.tags;

  document.getElementById('pickerForm').submit();
});

// ── Helpers ──────────────────────────────────────────────────
function isLightColor(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 200;
}
