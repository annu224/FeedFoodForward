/* ==========================================================================
   FeedFoodForward — app.js (v23 · strict RBAC · universal-header · fixes)
   Changes vs v22:
     • Carto tile killer no longer patches L.tileLayer globally
       (was breaking OSM attribution + violating tile usage policy)
     • Signup now AWAITS the server response before saving locally
       (previously users could "register" while the server was down)
     • Duplicate guest-guard block removed (guest-guard.js is authoritative)
     • ffRefreshSidebar no longer does a full page reload
   ========================================================================== */

/* ============================================================
   Carto watermark killer — DOM-level only (no L.tileLayer patch)
   ============================================================ */
(function killCartoWatermark(){
  const CARTO = 'cartocdn.com';

  function rewrite(url){
    if (typeof url !== 'string' || url.indexOf(CARTO) === -1) return url;
    const m = url.match(/\/(\d+)\/(\d+)\/(\d+)(?:\.png)?(?:\?|$)/);
    if (!m) return 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    return 'https://tile.openstreetmap.org/' + m[1] + '/' + m[2] + '/' + m[3] + '.png';
  }

  const fix = (el) => {
    if (el && el.tagName === 'IMG' && el.src && el.src.indexOf(CARTO) !== -1) {
      el.src = rewrite(el.src);
    }
  };
  const obs = new MutationObserver((muts) => {
    muts.forEach(m => {
      if (m.type === 'attributes' && m.target) fix(m.target);
      m.addedNodes && m.addedNodes.forEach(n => {
        fix(n);
        if (n.querySelectorAll) n.querySelectorAll('img').forEach(fix);
      });
    });
  });
  obs.observe(document.documentElement, {
    childList: true, subtree: true,
    attributes: true, attributeFilter: ['src']
  });

  document.querySelectorAll('img').forEach(fix);
})();

console.log('✅ app.js loaded on', location.pathname);

/* Global error boundary — prevents blank pages */
window.addEventListener('error', (e) => {
  console.error('🔥 Uncaught error:', e.error || e.message);
  if (document.body) document.body.style.opacity = '1';
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('🔥 Unhandled rejection:', e.reason);
  if (document.body) document.body.style.opacity = '1';
});

/* ==========================================================================
   PROTECTED-PAGE GUARD
   ========================================================================== */
(function guardProtectedPages() {
  const PROTECTED = {
    'admin-portal.html':     ['admin'],
    'donor-dashboard.html':  ['donor', 'admin'],
    'my-donations.html':     ['donor', 'admin'],
    'pickup-track.html':     ['donor', 'admin'],
    'donate-food.html':      ['donor', 'admin'],
    'ai-inspection.html':    ['donor', 'admin'],
    'driver-home.html':      ['driver', 'admin'],
    'driver-available.html': ['driver', 'admin'],
    'driver-active.html':    ['driver', 'admin'],
    'driver-verify.html':    ['driver', 'admin'],
    'driver-history.html':   ['driver', 'admin'],
    'driver-hub.html':       ['driver', 'admin'],
    'ashram-home.html':      ['ashram', 'admin'],
    'ngo-dashboard.html':    ['ashram', 'admin'],
    'my-requests.html':      ['ashram', 'admin'],
    'find-donations.html':   ['ashram', 'admin']
  };

  /* Let login / signup modal flow through without guarding */
  try {
    const params = new URLSearchParams(location.search);
    if (params.get('login') === '1' || params.get('signup') === '1') return;
  } catch (e) {}

  const page = (location.pathname.split('/').pop() || 'index.html')
                 .split('?')[0].split('#')[0];
  const allowed = PROTECTED[page];
  if (!allowed) return;

  let user = null;
  try {
    var _tabId = sessionStorage.getItem('ff_tab_id') || 'tab_fallback';
    var raw = localStorage.getItem('fff_current_user_' + _tabId);
    user = raw ? JSON.parse(raw) : null;
  } catch (e) {}

  if (user && user.role === 'receiver') user.role = 'ashram';

  if (!user || !allowed.includes(user.role)) {
    sessionStorage.setItem('ff_redirect_after_login', page);
    location.replace('index.html?login=1');
  }
})();

/* ==========================================================================
   GLOBAL AUTH SYSTEM  (v24 · per-tab sessions via tab-ID scoped keys)
   ========================================================================== */
window.ffTabId = (function () {
  try {
    var existing = sessionStorage.getItem('ff_tab_id');
    if (existing) return existing;
    var id = 'tab_' + Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem('ff_tab_id', id);
    return id;
  } catch (e) {
    return 'tab_fallback';
  }
})();

window.ffAuth = {
  KEY_PREFIX: 'fff_current_user_',
  LEGACY_KEY: 'fff_current_user',

  get key() {
    return this.KEY_PREFIX + window.ffTabId;
  },

  getUser() {
    try {
      var raw = localStorage.getItem(this.key);
      if (!raw) {
        /* One-time migration: if a legacy unscoped session exists
           in this tab and we have no scoped session yet, adopt it. */
        var legacy = localStorage.getItem(this.LEGACY_KEY);
        if (legacy) {
          localStorage.setItem(this.key, legacy);
          raw = legacy;
        }
      }
      if (!raw) return null;
      var u = JSON.parse(raw);
      if (u && u.role === 'receiver') {
        u.role = 'ashram';
        if (!u.roleLabel) u.roleLabel = 'Ashram';
      }
      return u;
    } catch (e) { return null; }
  },

  setUser(user) {
    if (!user) return;
    if (user.role === 'receiver') {
      user = Object.assign({}, user, {
        role: 'ashram',
        roleLabel: user.roleLabel || 'Ashram'
      });
    }
    try { localStorage.setItem(this.key, JSON.stringify(user)); } catch (e) {}
    if (user.role) {
      try { sessionStorage.setItem('ff_persona', user.role); } catch (e) {}
    }
  },

  clear() {
    try { localStorage.removeItem(this.key); } catch (e) {}
    ['ff_persona','ff_redirect_after_login','ff_uploadedImage',
     'ff_donationDetails','ff_aiResult','ff_matchedNGO','ff_lastDonationId',
     'ff_donationRef','ff_aiComplete','ff_imageSource','ff_activeDonation',
     'ff_deliveryPayload'].forEach(k => {
      try { sessionStorage.removeItem(k); } catch (e) {}
    });
  },

  isLoggedIn() { return !!this.getUser(); },

  getRole() {
    var u = this.getUser();
    return (u && u.role) || sessionStorage.getItem('ff_persona') || 'guest';
  }
};

/* Remove stale legacy key on unload so it can't leak across tabs */
window.addEventListener('pagehide', function () {
  try { localStorage.removeItem(window.ffAuth.LEGACY_KEY); } catch (e) {}
});

/* ==========================================================================
   UNIVERSAL HEADER RESTORE
   ========================================================================== */
document.addEventListener('DOMContentLoaded', function restoreHeaderUser() {
  const user = (window.ffAuth && window.ffAuth.getUser) ? window.ffAuth.getUser() : null;

  const guestGroup   = document.getElementById('header-guest');
  const userGroup    = document.getElementById('header-user');
  const userAvatarEl = document.getElementById('user-avatar');
  const userNameEl   = document.getElementById('user-name');

  if (!guestGroup || !userGroup) return;

  if (user) {
    guestGroup.hidden = true;
    userGroup.hidden  = false;
    if (userAvatarEl) userAvatarEl.textContent = user.avatar || '👤';
    if (userNameEl)   userNameEl.textContent   = user.name   || 'User';
    document.querySelectorAll('.user-menu-item[data-role-link]').forEach(el => {
      el.classList.toggle('is-active', el.dataset.roleLink === user.role);
    });
  } else {
    guestGroup.hidden = false;
    userGroup.hidden  = true;
  }
});

/* ffRefreshSidebar — re-renders sidebar without full page reload */
window.ffRefreshSidebar = function () {
  if (typeof window.ffRenderSidebar === 'function') {
    try { window.ffRenderSidebar(); return; } catch (e) {}
  }
  if (typeof window.ffRefreshSidebar === 'function' &&
      typeof window.ffRenderNav === 'function') {
    try { window.ffRenderNav(); } catch (e) {}
  }
};

/* ==========================================================================
   MAIN
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {

  /* ==================================================================
     0. GLOBAL TOAST
     ================================================================== */
  const ffToastEl = document.getElementById('ff-toast');
  window.ffToast = function (msg) {
    if (!ffToastEl) { console.log('[toast]', msg); return; }
    ffToastEl.textContent = msg;
    ffToastEl.style.transform = 'translateX(-50%) translateY(0)';
    ffToastEl.style.opacity = '1';
    clearTimeout(window.ffToast._t);
    window.ffToast._t = setTimeout(() => {
      ffToastEl.style.transform = 'translateX(-50%) translateY(120%)';
      ffToastEl.style.opacity = '0';
    }, 2400);
  };

  /* ==================================================================
     0.1 NAV ACTIVE-STATE
     ================================================================== */
  (function fixNavActive() {
    const nav = document.getElementById('site-nav');
    if (!nav) return;

    let page = location.pathname.split('/').pop() || 'index.html';
    page = page.split('?')[0].split('#')[0];
    if (page === '' || page === '/') page = 'index.html';

    nav.querySelectorAll('.nav-link').forEach(a => {
      a.classList.remove('active');
      a.removeAttribute('aria-current');
    });

    let matched = false;
    nav.querySelectorAll('.nav-link').forEach(a => {
      const href = (a.getAttribute('href') || '').split('?')[0].split('#')[0];
      if (href === page) {
        a.classList.add('active');
        a.setAttribute('aria-current', 'page');
        matched = true;
      }
    });

    if (!matched && page === 'index.html') {
      const home = nav.querySelector('a[href="index.html"]');
      if (home) {
        home.classList.add('active');
        home.setAttribute('aria-current', 'page');
      }
    }
  })();

  /* ==================================================================
     0.5 SESSION STORAGE HELPERS
     ================================================================== */
  window.ffStore = {
    save(key, value) {
      try {
        if (typeof value === 'string') {
          sessionStorage.setItem('ff_' + key, value);
        } else {
          sessionStorage.setItem('ff_' + key, JSON.stringify(value));
        }
      } catch (e) { console.warn('Storage full or unavailable', e); }
    },
    load(key) {
      try {
        const raw = sessionStorage.getItem('ff_' + key);
        if (raw == null) return null;
        try { return JSON.parse(raw); }
        catch (e) { return raw; }
      } catch (e) { return null; }
    },
    clear(key) { try { sessionStorage.removeItem('ff_' + key); } catch (e) {} }
  };

  /* ==================================================================
     1. MOBILE NAV TOGGLE
     ================================================================== */
  const navToggle = document.getElementById('nav-toggle');
  const siteNav   = document.getElementById('site-nav');
  if (navToggle && siteNav) {
    navToggle.addEventListener('click', () => {
      const isOpen = siteNav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });
    siteNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        siteNav.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ==================================================================
     2. WIZARD STEPS
     ================================================================== */
  const stepBodies = document.querySelectorAll('.wizard-step-body[data-step]');
  const stepPills  = document.querySelectorAll('.step-indicator[data-step-jump]');
  let currentStep = 1;

  function goToStep(n) {
    if (!stepBodies.length) return;
    currentStep = Math.max(1, Math.min(5, n));
    stepBodies.forEach(body => { body.hidden = Number(body.dataset.step) !== currentStep; });
    stepPills.forEach((pill, i) => {
      pill.classList.toggle('active', i === currentStep - 1);
      pill.classList.toggle('done', i < currentStep - 1);
    });
    const wizard = document.querySelector('.wizard-container');
    if (wizard) {
      window.scrollTo({
        top: wizard.getBoundingClientRect().top + window.scrollY - 120,
        behavior: 'smooth'
      });
    }
  }

  if (stepBodies.length) {
    const params = new URLSearchParams(location.search);
    const _goto = params.get('step') || sessionStorage.getItem('ff_gotoStep');
    const cameFromAi = sessionStorage.getItem('ff_aiComplete') === 'true';

    if (cameFromAi) {
      sessionStorage.removeItem('ff_aiComplete');
      sessionStorage.removeItem('ff_gotoStep');
      goToStep(3);
    } else if (_goto) {
      sessionStorage.removeItem('ff_gotoStep');
      goToStep(Number(_goto));
    } else {
      goToStep(1);
    }

    document.querySelectorAll('[data-next]').forEach(btn =>
      btn.addEventListener('click', () => goToStep(currentStep + 1)));
    document.querySelectorAll('[data-back]').forEach(btn =>
      btn.addEventListener('click', () => goToStep(currentStep - 1)));
    stepPills.forEach((pill, i) =>
      pill.addEventListener('click', () => goToStep(i + 1)));
  }

  /* ==================================================================
     3. IMAGE UPLOAD PREVIEW
     ================================================================== */
  const fileInput = document.getElementById('food-photo-input');
  const preview   = document.getElementById('upload-preview');
  const uploadBox = document.getElementById('upload-box');

  function handleImageFile(file) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      window.ffToast('⚠️ Please choose a JPG, PNG, or WEBP image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      if (preview) preview.src = dataUrl;
      try { sessionStorage.setItem('ff_uploadedImage', dataUrl); } catch (e) {}
      try { sessionStorage.setItem('ff_imageSource', 'upload'); } catch (e) {}
      window.ffToast('📷 Image saved. Ready for AI analysis.');
    };
    reader.readAsDataURL(file);
  }

  if (fileInput) fileInput.addEventListener('change', (e) => handleImageFile(e.target.files && e.target.files[0]));

  if (uploadBox) {
    ['dragover', 'dragenter'].forEach(evt =>
      uploadBox.addEventListener(evt, (e) => {
        e.preventDefault();
        uploadBox.style.borderColor = 'var(--primary-green)';
        uploadBox.style.background  = 'var(--light-green)';
      }));
    ['dragleave', 'drop'].forEach(evt =>
      uploadBox.addEventListener(evt, (e) => {
        e.preventDefault();
        uploadBox.style.borderColor = '';
        uploadBox.style.background  = '';
      }));
    uploadBox.addEventListener('drop', (e) => {
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      handleImageFile(file);
    });
  }

  /* ==================================================================
     4. PRESET CHIPS
     ================================================================== */
  document.querySelectorAll('.chip[data-src]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip[data-src]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const src = chip.dataset.src;
      if (preview) preview.src = src;
      try { sessionStorage.setItem('ff_uploadedImage', src); } catch (e) {}
      try { sessionStorage.setItem('ff_imageSource', 'preset'); } catch (e) {}
      window.ffToast('📷 Preset image selected.');
    });
  });

  /* ==================================================================
     5. RUN AI DETECTION
     ================================================================== */
  const runAiBtn = document.getElementById('run-ai-btn');
  if (runAiBtn) {
    runAiBtn.addEventListener('click', () => {
      const nameEl     = document.getElementById('food-name');
      const categoryEl = document.getElementById('food-category');
      const quantityEl = document.getElementById('food-quantity');
      const servingsEl = document.getElementById('food-servings');
      const preparedEl = document.getElementById('food-prepared-at');
      const deadlineEl = document.getElementById('food-deadline');
      const addressEl  = document.getElementById('food-address');
      const storageEl  = document.querySelector('input[name="food-storage"]:checked');
      const detailsErr = document.getElementById('details-error');

      const name       = (nameEl     && nameEl.value.trim())     || '';
      const category   = (categoryEl && categoryEl.value.trim()) || '';
      const quantity   = (quantityEl && quantityEl.value.trim()) || '';
      const servings   = (servingsEl && servingsEl.value.trim()) || '';
      const preparedAt = (preparedEl && preparedEl.value.trim()) || '';
      const deadline   = (deadlineEl && deadlineEl.value.trim()) || '';
      const address    = (addressEl  && addressEl.value.trim())  || '';
      const storage    = storageEl ? storageEl.value : '';

      const missing = [];
      if (!name)       missing.push('Food Name / Description');
      if (!quantity)   missing.push('Quantity (kg)');
      if (!servings)   missing.push('Number of Servings');
      if (!preparedAt) missing.push('Prepared At time');
      if (!deadline)   missing.push('Pickup Deadline');
      if (!storage)    missing.push('Storage Condition');
      if (!address)    missing.push('Pickup Address');

      if (missing.length) {
        if (detailsErr) {
          detailsErr.style.display = 'block';
          detailsErr.textContent   = '⚠️ Please fill in: ' + missing.join(', ');
        }
        if (window.ffToast) window.ffToast('⚠️ Please complete the required fields');
        return;
      }

      const details = { name, category, quantity, servings, preparedAt, deadline, storage, address };
      window.ffStore.save('donationDetails', details);

      const image = window.ffStore.load('uploadedImage');
      if (!image) {
        if (window.ffToast) window.ffToast('⚠️ Please upload a food image first.');
        return;
      }

      if (window.ffToast) window.ffToast('🤖 Redirecting to AI inspection…');
      setTimeout(() => {
        window.location.href = 'ai-inspection.html';
      }, 700);
    });
  }

  /* ==================================================================
     6. MATCH CARD SELECTION
     ================================================================== */
  (function initMatchCards() {
    const container = document.getElementById('match-results');
    if (!container) return;

    function esc(s) {
      return String(s || '').replace(/[&<>"']/g, c => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
      }[c]));
    }

    function scoreAshram(a) {
      let score = 60;
      if (a.food_needed === 'Yes') score += 25;
      if (a.verified === 'Yes')    score += 10;
      if (a.location && a.location.coordinates &&
          Array.isArray(a.location.coordinates) &&
          a.location.coordinates.length === 2) score += 5;
      return Math.min(99, score);
    }

    function selectCard(card) {
      container.querySelectorAll('.match-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      const dest = document.getElementById('summary-destination');
      const heading = card.querySelector('h4');
      if (dest && heading) dest.textContent = heading.textContent;
      window.ffStore.save('matchedNGO', heading ? heading.textContent : '');
    }

    async function loadMatches() {
      container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:1rem;">⏳ Finding the best receivers…</p>';
      try {
        const r = await fetch('/api/ashrams/all');
        const data = await r.json();
        if (!data.ok) throw new Error(data.error || 'Failed to load');

        const scored = (data.ashrams || [])
          .filter(a => a && a.name)
          .map(a => Object.assign({}, a, { _score: scoreAshram(a) }))
          .sort((a, b) => b._score - a._score)
          .slice(0, 3);

        if (!scored.length) {
          container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:1rem;">No receivers available right now.</p>';
          return;
        }

        container.innerHTML = scored.map((a, i) => {
          const loc = [a.address, a.city, a.state].filter(Boolean).join(', ');
          const need = a.food_needed === 'Yes'
            ? 'Currently accepting food donations'
            : 'Contact for current needs';
          return `
            <div class="match-card${i === 0 ? ' selected' : ''}" data-match="${esc(a._id || a.name)}" role="button" tabindex="0">
              <div class="ashram-info">
                <h4>${esc(a.name)}</h4>
                <p>${esc(a.type || 'Receiver')}${loc ? ' • ' + esc(loc) : ''}</p>
                <p>Current Need: ${esc(need)}</p>
              </div>
              <div class="match-score">
                <span>${a._score}% MATCH</span>
                <small>${a._score >= 90 ? 'High Suitability' : a._score >= 80 ? 'Good Suitability' : 'Fair Suitability'}</small>
              </div>
            </div>`;
        }).join('');

        const first = container.querySelector('.match-card.selected');
        if (first) {
          const dest = document.getElementById('summary-destination');
          const heading = first.querySelector('h4');
          if (dest && heading) dest.textContent = heading.textContent;
          window.ffStore.save('matchedNGO', heading ? heading.textContent : '');
        }

        container.querySelectorAll('.match-card').forEach(card => {
          card.addEventListener('click', () => selectCard(card));
          card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectCard(card); }
          });
        });
      } catch (err) {
        console.error('Match load failed:', err);
        container.innerHTML = '<p style="text-align:center;color:#dc2626;padding:1rem;">⚠️ Could not load receivers. Please try again.</p>';
      }
    }

    const stepBodiesLocal = document.querySelectorAll('.wizard-step-body[data-step]');
    if (!stepBodiesLocal.length) { loadMatches(); return; }

    const observer = new MutationObserver(() => {
      const step4 = document.querySelector('.wizard-step-body[data-step="4"]');
      if (step4 && !step4.hidden && !container.dataset.loaded) {
        container.dataset.loaded = '1';
        loadMatches();
      }
    });
    stepBodiesLocal.forEach(el => observer.observe(el, { attributes: true, attributeFilter: ['hidden'] }));
  })();

  /* ==================================================================
     7. AI INSPECTION PAGE
     ================================================================== */
  const aiLoadingState = document.getElementById('ai-loading-state');
  const aiResultView   = document.getElementById('ai-result-view');
  const aiNoFoodView   = document.getElementById('ai-no-food-view');
  const aiEmptyState   = document.getElementById('ai-empty-state');
  const aiPreviewImg   = document.getElementById('ai-inspection-image');
  const aiRerunBtn     = document.getElementById('rerun-ai-btn');

  function renderAIResult(result, imageDataUrl) {
    if (aiPreviewImg && imageDataUrl) aiPreviewImg.src = imageDataUrl;
    const set = (key, val) => {
      document.querySelectorAll(`[data-ai="${key}"]`).forEach(el => { el.textContent = val; });
    };
    set('foodName',            result.foodName);
    set('confidence',          Math.round(result.confidence) + '%');
    set('freshness',           result.freshness);
    set('condition',           result.conditionColor + ' ' + result.condition);
    set('spoilage',            result.spoilage ? '⚠️ Possible damage detected' : '🟢 Not detected');
    set('category',            result.category);
    set('quantity',            result.quantity);
    set('servings',            result.servings);
    set('suitability',         result.conditionColor + ' ' + result.suitability);
    set('suitabilityText',     result.suitabilityText);
    set('recommendation',      'Priority: ' + result.recommendation);
    set('confidenceDetection', Math.round(result.confidence) + '%');
    set('confidenceFreshness', Math.round(result.freshness) + '%');
    set('confidenceQuantity',  '84%');

    const bar = document.querySelector('.freshness-bar-fill');
    if (bar) bar.style.width = result.freshness + '%';

    const it = result.items;
    set('item1-label', it[0] ? `${it[0].name} ${it[0].confidence}%` : 'Item 1');
    set('item2-label', it[1] ? `${it[1].name} ${it[1].confidence}%` : 'Item 2');
    set('item3-label', it[2] ? `${it[2].name} ${it[2].confidence}%` : 'Item 3');

    const itemsContainer = document.querySelector('[data-ai="items-list"]');
    if (itemsContainer) {
      itemsContainer.innerHTML = result.items.map(it => `
        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; font-size:0.9rem;">
          <span>${it.name}</span><strong>${it.confidence}%</strong>
        </div>`).join('');
    }
  }

  function revealAiSections() {
    const map = {
      'ai-lower-grid':   'grid',
      'ai-summary-grid': 'grid',
      'ai-action-bar':   'flex'
    };
    Object.entries(map).forEach(([id, d]) => {
      const el = document.getElementById(id);
      if (el) el.style.display = d;
    });
  }

  function hideAiSections() {
    ['ai-lower-grid', 'ai-summary-grid', 'ai-action-bar'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  }

  if (aiLoadingState && aiResultView) {
    const runAiInspection = async (delay = 1600) => {
      aiResultView.style.display = 'none';
      if (aiNoFoodView) aiNoFoodView.style.display = 'none';
      if (aiEmptyState) aiEmptyState.style.display = 'none';
      aiLoadingState.style.display = 'grid';
      aiLoadingState.scrollIntoView({ behavior: 'smooth', block: 'start' });

      const image = window.ffStore.load('uploadedImage');
      const details = window.ffStore.load('donationDetails') || {};

      if (!image) {
        aiLoadingState.style.display = 'none';
        if (aiEmptyState) aiEmptyState.style.display = 'block';
        return;
      }

      try {
        const response = await fetch('/api/analyze-food', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image })
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody.error || `Server error ${response.status}`);
        }

        const data = await response.json();
        await new Promise(r => setTimeout(r, delay));
        aiLoadingState.style.display = 'none';

        if (!data.isFood) {
          if (aiNoFoodView) {
            aiNoFoodView.style.display = 'grid';
            const confEl = aiNoFoodView.querySelector('[data-nf="confidence"]');
            if (confEl) confEl.textContent = (data.confidence || 0) + '%';
            const nfImg = document.getElementById('ai-no-food-image');
            if (nfImg && image) nfImg.src = image;
          }
          hideAiSections();
          window.ffToast('❌ No food detected in this image.');
          return;
        }

        const result = {
          foodName:        data.foodName || '—',
          category:        data.foodCategory || '—',
          confidence:      data.confidence || 0,
          freshness:       data.freshnessScore || 0,
          condition:       data.freshnessLabel || 'Needs Review',
          conditionColor:
            (data.freshnessScore >= 85) ? '🟢' :
            (data.freshnessScore >= 70) ? '🟡' : '🔴',
          spoilage:        data.visibleSpoilageDetected === true,
          items:           (data.detectedItems || []).map(it => ({
                             name: it.name,
                             confidence: it.confidence
                           })),
          suitability:     data.donationSuitability || 'MANUAL_REVIEW_REQUIRED',
          suitabilityText: data.reasoning || '',
          recommendation:  data.pickupUrgency || 'MEDIUM',
          quantity:        details.quantity ? `${details.quantity} kg` : '—',
          servings:        details.servings || '—'
        };

        window.ffStore.save('aiResult', { result });

        renderAIResult(result, image);
        aiResultView.style.display = 'grid';
        revealAiSections();
        window.ffToast('✅ AI analysis complete');
      } catch (err) {
        console.error('AI call failed:', err);
        aiLoadingState.style.display = 'none';
        if (aiEmptyState) aiEmptyState.style.display = 'block';
        window.ffToast('⚠️ ' + (err.message || 'AI analysis failed. Please try again.'));
      }
    };

    const savedImage = window.ffStore.load('uploadedImage');
    if (savedImage) {
      runAiInspection(1200);
    } else {
      aiResultView.style.display = 'none';
      hideAiSections();
      if (aiLoadingState) aiLoadingState.style.display = 'none';
      if (aiEmptyState) aiEmptyState.style.display = 'block';
    }

    if (aiRerunBtn) {
      aiRerunBtn.addEventListener('click', () => {
        aiRerunBtn.disabled = true;
        aiRerunBtn.textContent = '🔄 Analyzing…';
        runAiInspection(1800);
        setTimeout(() => {
          aiRerunBtn.disabled = false;
          aiRerunBtn.textContent = '🔄 Analyze Image Again';
        }, 2200);
      });
    }
  }

  /* ==================================================================
     8. ASHRAM SEARCH & FILTER
     ================================================================== */
  const searchInput = document.getElementById('ashram-search');
  const filterBtns  = document.querySelectorAll('.filter-btn[data-filter]');
  const ashramCards = document.querySelectorAll('#ashram-grid .ashram-card');
  let activeFilter = 'all';
  function applyAshramFilter() {
    const q = (searchInput ? searchInput.value : '').toLowerCase().trim();
    ashramCards.forEach(card => {
      const type = card.dataset.type || '';
      const name = (card.dataset.name || '').toLowerCase();
      const matchesType = activeFilter === 'all' || type === activeFilter;
      const matchesSearch = !q || name.includes(q);
      card.style.display = (matchesType && matchesSearch) ? '' : 'none';
    });
  }
  if (filterBtns.length) {
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.filter;
        applyAshramFilter();
      });
    });
  }
  if (searchInput) searchInput.addEventListener('input', applyAshramFilter);

  /* ==================================================================
     9. ADMIN PORTAL
     ================================================================== */
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (window.ffAuth) window.ffAuth.clear();
      window.ffToast('You have been logged out.');
      setTimeout(() => { window.location.href = 'guest-home.html'; }, 900);
    });
  }

  /* ==================================================================
     10. DONATE FOOD — progress bar
     ================================================================== */
  const wizardFill  = document.getElementById('wizard-progress-fill');
  const wizardLabel = document.getElementById('wizard-progress-label');
  if (wizardFill && wizardLabel) {
    const getCurrentStep = () => {
      const activeBody = document.querySelector('.wizard-step-body:not([hidden])');
      return activeBody ? Number(activeBody.dataset.step) : 1;
    };
    const updateProgress = () => {
      const step = getCurrentStep();
      wizardFill.style.width = (step * 20) + '%';
      wizardLabel.textContent = `Step ${step} of 5`;
    };
    const progressObserver = new MutationObserver(updateProgress);
    document.querySelectorAll('.wizard-step-body').forEach(el => {
      progressObserver.observe(el, { attributes: true, attributeFilter: ['hidden'] });
    });
    updateProgress();
  }

  /* ==================================================================
     11. GLOBAL AUTH MODALS
     ================================================================== */
  function ffInjectAuthModals() {
    if (document.getElementById('login-modal') &&
        document.getElementById('signup-modal')) return;

    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <!-- ==================== LOGIN MODAL ==================== -->
      <div class="modal-overlay" id="login-modal" hidden>
        <div class="modal-card modal-card-sm" role="dialog" aria-modal="true">
          <div class="auth-brand">
            <div class="auth-brand-mark">
              <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="2" width="44" height="44" rx="11" fill="#0B9F6E"/>
              </svg>
            </div>
            <h2 class="auth-brand-title">FeedFoodForward</h2>
            <p class="auth-brand-sub">Turning surplus food into shared hope.</p>
          </div>

          <div class="modal-body">
            <h3 class="auth-welcome">Welcome back!</h3>
            <p class="modal-subtitle" style="margin-bottom:1rem;">Login to your account to continue.</p>

            <form class="food-form" id="login-form" onsubmit="return false;" novalidate>
              <div class="form-group">
                <label for="login-email">Email address</label>
                <input type="email" id="login-email" placeholder="Enter your registered email" required>
              </div>
              <div class="form-group">
                <label for="login-password">Password</label>
                <input type="password" id="login-password" minlength="4" placeholder="Enter your password" required>
              </div>
              <div class="auth-row">
                <label class="auth-checkbox">
                  <input type="checkbox" id="login-remember">
                  <span>Remember me</span>
                </label>
                <button type="button" class="link-btn" id="forgot-pw-btn">Forgot password?</button>
              </div>
              <p class="field-error" id="login-error" style="display:none;">Please enter a valid email and password.</p>
              <button type="button" class="btn btn-primary auth-submit" id="login-submit-btn">Login</button>
            </form>

            <p class="modal-footer-hint">
              Don't have an account?
              <button type="button" class="link-btn" data-open-signup>Sign Up</button>
            </p>

            <p class="modal-footer-hint" style="font-size:0.78rem;color:#94a3b8;margin-top:0.75rem;">
              Platform owner? <a href="admin-login.html" style="color:#64748b;font-weight:600;text-decoration:none;">Admin Login →</a>
            </p>
          </div>
        </div>
      </div>

      <!-- ==================== SIGNUP MODAL ==================== -->
      <div class="modal-overlay" id="signup-modal" hidden>
        <div class="modal-card modal-card-lg" role="dialog" aria-modal="true">
          <div class="auth-brand">
            <div class="auth-brand-mark">
              <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="2" width="44" height="44" rx="11" fill="#0B9F6E"/>
              </svg>
            </div>
            <h2 class="auth-brand-title">Create your account</h2>
            <p class="auth-brand-sub">Join the rescue network — Donor, Receiver or Driver.</p>
          </div>

          <div class="modal-body">
            <form class="food-form" id="signup-form" onsubmit="return false;" novalidate>
              <div class="form-group">
                <label>Account type</label>
                <div class="role-select-grid" role="radiogroup">
                  <label class="role-select-option">
                    <input type="radio" name="signup-role" value="donor" checked>
                    <span>🏨 Donor</span>
                  </label>
                  <label class="role-select-option">
                    <input type="radio" name="signup-role" value="ashram">
                    <span>👵 Ashram</span>
                  </label>
                  <label class="role-select-option">
                    <input type="radio" name="signup-role" value="driver">
                    <span>🚚 Driver</span>
                  </label>
                </div>
                <p class="modal-footnote" style="margin-top:0.5rem;">
                  Admin accounts are created only by the platform owner.
                </p>
              </div>

              <div class="form-group">
                <label for="signup-name">Full name</label>
                <input type="text" id="signup-name" placeholder="Your name or contact person" required>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="signup-email">Email</label>
                  <input type="email" id="signup-email" placeholder="you@example.com" required>
                </div>
                <div class="form-group">
                  <label for="signup-phone">Phone number</label>
                  <input type="tel" id="signup-phone" placeholder="+91 98xxx xxxxx" required>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="signup-password">Password</label>
                  <input type="password" id="signup-password" minlength="8" placeholder="At least 8 characters" required>
                </div>
                <div class="form-group">
                  <label for="signup-confirm">Confirm password</label>
                  <input type="password" id="signup-confirm" minlength="8" placeholder="Re-enter password" required>
                </div>
              </div>

              <div id="signup-role-fields">
                <div class="role-fields" data-role="donor">
                  <div class="form-group">
                    <label for="donor-org">Organization / Hotel / Restaurant name</label>
                    <input type="text" id="donor-org" placeholder="e.g. Hotel Green Leaf">
                  </div>
                  <div class="form-row">
                    <div class="form-group">
                      <label for="donor-type">Donor type</label>
                      <select id="donor-type">
                        <option value="">Select type</option>
                        <option value="hotel">Hotel</option>
                        <option value="restaurant">Restaurant</option>
                        <option value="bakery">Bakery</option>
                        <option value="cafe">Café</option>
                        <option value="caterer">Caterer</option>
                        <option value="event">Event Organizer</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label for="donor-address">Pickup address</label>
                      <input type="text" id="donor-address" placeholder="Street, Area, City">
                    </div>
                  </div>
                </div>

                <div class="role-fields" data-role="ashram" hidden>
                  <div class="form-group">
                    <label for="receiver-org">Organization name</label>
                    <input type="text" id="receiver-org" placeholder="e.g. Sunshine Ashram / NGO name">
                  </div>
                  <div class="form-row">
                    <div class="form-group">
                      <label for="receiver-type">Receiver type</label>
                      <select id="receiver-type">
                        <option value="">Select type</option>
                        <option value="ashram">Ashram</option>
                        <option value="vruddhashram">Vruddhashram (Old Age Home)</option>
                        <option value="anath-ashram">Anath Ashram (Orphanage)</option>
                        <option value="ngo">NGO</option>
                        <option value="shelter">Shelter</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label for="receiver-residents">Number of residents</label>
                      <input type="number" id="receiver-residents" min="1" placeholder="e.g. 85">
                    </div>
                  </div>
                  <div class="form-group">
                    <label for="receiver-address">Organization address</label>
                    <input type="text" id="receiver-address" placeholder="Street, Area, City">
                  </div>
                  <div class="form-group">
                    <label for="receiver-needs">Food requirements</label>
                    <input type="text" id="receiver-needs" placeholder="e.g. Vegetarian meals, 60 servings daily">
                  </div>
                </div>

                <div class="role-fields" data-role="driver" hidden>
                  <div class="form-row">
                    <div class="form-group">
                      <label for="driver-vehicle">Vehicle type</label>
                      <select id="driver-vehicle">
                        <option value="">Select vehicle</option>
                        <option value="two-wheeler">Two-wheeler</option>
                        <option value="three-wheeler">Three-wheeler (Auto)</option>
                        <option value="ev-van">Electric Cargo Van</option>
                        <option value="four-wheeler">Four-wheeler</option>
                        <option value="truck">Truck</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label for="driver-license">Driving licence number</label>
                      <input type="text" id="driver-license" placeholder="e.g. KA01 2023 XXXX">
                    </div>
                  </div>
                  <div class="form-group">
                    <label for="driver-area">Operating area / city</label>
                    <input type="text" id="driver-area" placeholder="e.g. Indiranagar, Bengaluru">
                  </div>
                </div>
              </div>

              <p class="field-error" id="signup-error" style="display:none;">Please fill in all fields correctly.</p>
              <button type="button" class="btn btn-primary auth-submit" id="signup-submit-btn">Create Account</button>
            </form>

            <p class="modal-footer-hint">
              Already have an account?
              <button type="button" class="link-btn" data-open-login>Login</button>
            </p>
          </div>
        </div>
      </div>
    `;

    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
  }

  window.ffOpenLoginModal = function () {
    ffInjectAuthModals();
    const m = document.getElementById('login-modal');
    if (m) {
      m.hidden = false;
      m.removeAttribute('hidden');
      document.body.style.overflow = 'hidden';
    }
  };

  window.ffOpenSignupModal = function () {
    ffInjectAuthModals();
    const m = document.getElementById('signup-modal');
    if (m) {
      m.hidden = false;
      m.removeAttribute('hidden');
      document.body.style.overflow = 'hidden';
    }
  };

  /* ---- Global click handlers for header auth buttons + modal swaps ---- */
  document.addEventListener('click', function (e) {
    const loginBtn  = e.target.closest('#header-login-btn');
    const signupBtn = e.target.closest('#header-signup-btn');
    const toSignup  = e.target.closest('[data-open-signup]');
    const toLogin   = e.target.closest('[data-open-login]');

    if (loginBtn)  { e.preventDefault(); window.ffOpenLoginModal(); }
    if (signupBtn) { e.preventDefault(); window.ffOpenSignupModal(); }
    if (toSignup) {
      e.preventDefault();
      const lm = document.getElementById('login-modal');
      if (lm) { lm.hidden = true; document.body.style.overflow = ''; }
      window.ffOpenSignupModal();
    }
    if (toLogin) {
      e.preventDefault();
      const sm = document.getElementById('signup-modal');
      if (sm) { sm.hidden = true; document.body.style.overflow = ''; }
      window.ffOpenLoginModal();
    }
  });

  /* ---- Modal close handlers ---- */
  document.addEventListener('click', function (e) {
    const overlay = e.target.closest('.modal-overlay');
    if (overlay && e.target === overlay) {
      overlay.hidden = true;
      document.body.style.overflow = '';
    }
    const closeBtn = e.target.closest('[data-modal-close], .modal-close');
    if (closeBtn) {
      const m = closeBtn.closest('.modal-overlay');
      if (m) { m.hidden = true; document.body.style.overflow = ''; }
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay:not([hidden])').forEach(function (m) {
        m.hidden = true;
        document.body.style.overflow = '';
      });
    }
  });

  /* ---- Auto-open from ?login=1 / ?signup=1 ---- */
  (function autoOpenFromQuery() {
    const params = new URLSearchParams(location.search);
    if (params.get('login') === '1')  window.ffOpenLoginModal();
    if (params.get('signup') === '1') window.ffOpenSignupModal();
    if (params.get('login') === '1' || params.get('signup') === '1') {
      setTimeout(() => {
        if (history.replaceState) history.replaceState(null, '', location.pathname);
      }, 800);
    }
  })();

  /* ==================================================================
     STRICT LOGIN SUBMIT
     ================================================================== */
  document.addEventListener('click', async function (e) {
    const loginSubmit = e.target.closest('#login-submit-btn');
    if (!loginSubmit) return;

    const emailEl = document.getElementById('login-email');
    const pwEl    = document.getElementById('login-password');
    const errEl   = document.getElementById('login-error');
    const email   = (emailEl && emailEl.value || '').trim().toLowerCase();
    const pw      = (pwEl    && pwEl.value) || '';

    function showError(msg) {
      if (!errEl) return;
      errEl.textContent = '⚠️ ' + msg;
      errEl.style.display = 'block';
    }

    if (!email.includes('@') || pw.length < 4) {
      showError('Please enter a valid email and password.');
      return;
    }
    if (errEl) errEl.style.display = 'none';

    loginSubmit.disabled = true;
    loginSubmit.textContent = '⏳ Logging in…';

    try { window.ffAuth.clear(); } catch (err) {}

    let serverUser = null;
    const isAdminEmail = (email === 'admin@feedfoodforward.demo') ||
                         email.indexOf('admin@') === 0;
    const endpoint = isAdminEmail ? '/api/auth/admin-login' : '/api/auth/login';

    try {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pw })
      });

      const ct = r.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        throw new Error('Server did not return JSON (HTTP ' + r.status + ').');
      }

      const data = await r.json();
      if (!data || !data.ok || !data.user) {
        loginSubmit.disabled = false;
        loginSubmit.textContent = 'Login';
        showError(data && data.error ? data.error : 'Invalid credentials.');
        return;
      }
      serverUser = data.user;
    } catch (err) {
      loginSubmit.disabled = false;
      loginSubmit.textContent = 'Login';
      showError('Login failed: ' + err.message);
      return;
    }

    if (serverUser.role === 'receiver') serverUser.role = 'ashram';

    const VALID_ROLES = ['donor', 'ashram', 'driver', 'admin'];
    if (!VALID_ROLES.includes(serverUser.role)) {
      loginSubmit.disabled = false;
      loginSubmit.textContent = 'Login';
      showError('Unknown role from server.');
      return;
    }

    loginSubmit.disabled = false;
    loginSubmit.textContent = 'Login';

    window.ffAuth.setUser(serverUser);
    const lm = document.getElementById('login-modal');
    if (lm) { lm.hidden = true; document.body.style.overflow = ''; }

    window.ffToast('✅ Welcome, ' + (serverUser.name || 'User'));

    const ROLE_HOME = {
      donor:  'donor-dashboard.html',
      ashram: 'ngo-dashboard.html',
      driver: 'driver-home.html',
      admin:  'admin-portal.html'
    };
    const target = ROLE_HOME[serverUser.role];
    setTimeout(function () { window.location.assign(target); }, 500);
  });

  /* ==================================================================
     SIGNUP — role-aware field toggling
     ================================================================== */
  function ffShowRoleFields(role) {
    const form = document.getElementById('signup-form');
    if (!form) return;
    form.querySelectorAll('.role-fields[data-role]').forEach(function (b) {
      b.hidden = b.dataset.role !== role;
    });
  }

  document.addEventListener('change', function (e) {
    const radio = e.target.closest('input[name="signup-role"]');
    if (!radio) return;
    ffShowRoleFields(radio.value);
  });

  document.addEventListener('click', function (e) {
    const trigger = e.target.closest('#header-signup-btn, [data-open-signup]');
    if (!trigger) return;
    setTimeout(function () {
      const checked = document.querySelector('input[name="signup-role"]:checked');
      ffShowRoleFields(checked ? checked.value : 'donor');
    }, 50);
  });

  /* ==================================================================
     SIGNUP SUBMIT
     ================================================================== */
  document.addEventListener('click', async function (e) {
    const signupSubmit = e.target.closest('#signup-submit-btn');
    if (!signupSubmit) return;

    const errEl = document.getElementById('signup-error');
    const fv = function (id) {
      const el = document.getElementById(id);
      return el ? el.value.trim() : '';
    };

    const roleEl = document.querySelector('input[name="signup-role"]:checked');
    const role = roleEl ? roleEl.value : 'donor';

    if (role === 'admin') {
      if (errEl) {
        errEl.textContent = '⚠️ Admin accounts cannot be self-registered.';
        errEl.style.display = 'block';
      }
      return;
    }

    const name  = fv('signup-name');
    const email = fv('signup-email');
    const phone = fv('signup-phone');
    const pwEl  = document.getElementById('signup-password');
    const cfEl  = document.getElementById('signup-confirm');
    const pw    = pwEl ? pwEl.value : '';
    const cfm   = cfEl ? cfEl.value : '';

    let problem = '';
    if (!name)                     problem = 'Please enter your full name.';
    else if (!email.includes('@')) problem = 'Please enter a valid email.';
    else if (phone.length < 8)     problem = 'Please enter a valid phone number.';
    else if (pw.length < 8)        problem = 'Password must be at least 8 characters.';
    else if (pw !== cfm)           problem = 'Passwords do not match.';

    if (!problem && role === 'donor') {
      if (!fv('donor-org'))     problem = 'Please enter your organization name.';
      if (!fv('donor-type'))    problem = 'Please select a donor type.';
      if (!fv('donor-address')) problem = 'Please enter your pickup address.';
    }
    if (!problem && role === 'ashram') {
      if (!fv('receiver-org'))       problem = 'Please enter your Ashram / NGO name.';
      if (!fv('receiver-type'))      problem = 'Please select a receiver type.';
      if (!fv('receiver-residents')) problem = 'Please enter the number of residents.';
      if (!fv('receiver-address'))   problem = 'Please enter your Ashram / NGO address.';
    }
    if (!problem && role === 'driver') {
      if (!fv('driver-vehicle')) problem = 'Please select a vehicle type.';
      if (!fv('driver-license')) problem = 'Please enter your driving licence number.';
      if (!fv('driver-area'))    problem = 'Please enter your operating area.';
    }

    if (problem) {
      if (errEl) { errEl.textContent = '⚠️ ' + problem; errEl.style.display = 'block'; }
      return;
    }
    if (errEl) errEl.style.display = 'none';

    const avatarMap = { donor: '🏨', ashram: '👵', driver: '🚚' };
    const labelMap  = { donor: 'Food Donor', ashram: 'Ashram', driver: 'Driver' };

    const newUser = {
      name, email, phone, role,
      avatar:    avatarMap[role] || '👤',
      roleLabel: labelMap[role]  || 'User',
      verified:  'Pending verification',
      org:       fv('donor-org')      || fv('receiver-org')     || '',
      orgType:   fv('donor-type')     || fv('receiver-type')    || '',
      address:   fv('donor-address')  || fv('receiver-address') || '',
      residents: fv('receiver-residents') || '',
      needs:     fv('receiver-needs') || '',
      vehicle:   fv('driver-vehicle') || '',
      license:   fv('driver-license') || '',
      area:      fv('driver-area')    || ''
    };

    signupSubmit.disabled = true;
    signupSubmit.textContent = '⏳ Creating account…';

    try {
      const r = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.ok) {
        throw new Error(data.error || 'Registration failed. Please try again.');
      }
    } catch (err) {
      signupSubmit.disabled = false;
      signupSubmit.textContent = 'Create Account';
      if (errEl) {
        errEl.textContent = '⚠️ ' + err.message;
        errEl.style.display = 'block';
      }
      return;
    }

    signupSubmit.disabled = false;
    signupSubmit.textContent = 'Create Account';

    window.ffAuth.setUser(newUser);

    const sm = document.getElementById('signup-modal');
    if (sm) { sm.hidden = true; document.body.style.overflow = ''; }

    window.ffToast('✅ Welcome, ' + name);

    const ROLE_HOME = {
      donor:  'donor-dashboard.html',
      ashram: 'ngo-dashboard.html',
      driver: 'driver-home.html'
    };
    const target = ROLE_HOME[role] || 'donor-dashboard.html';
    setTimeout(function () { window.location.assign(target); }, 500);
  });

  /* ==================================================================
     LUCIDE ICON INIT
     ================================================================== */
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

});   // END of DOMContentLoaded