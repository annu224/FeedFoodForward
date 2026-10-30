/* ==========================================================================
   FeedFoodForward — animations.js  (UNIVERSAL · v3)
   Complete motion system for EVERY page:

   LAYER 1 — Global
     • Page fade-in
     • Scroll progress bar
     • Sticky header shadow
     • Smooth anchor scrolling
     • Lucide icon boot

   LAYER 2 — Scroll reveals
     • Auto reveal-on-scroll for 40+ selector types
     • Directional variants (left/right/zoom)
     • Stagger-in grids
     • Table row slide-in

   LAYER 3 — Numbers & data
     • Animated counters (1,420+ → 3,570+ → 12 → 86 → 1.2M → 4.1)
     • Number flip-in for stats
     • Live activity pulse dots
     • Status badge pulse

   LAYER 4 — Interactive
     • Button ripple effect
     • Card tilt on hover
     • Hover lift everywhere
     • Input field focus glow

   LAYER 5 — Flows & transitions
     • Wizard step slide-in
     • Modal pop-in
     • Toast bounce
     • Page transition fade-out

   LAYER 6 — TRANSACTIONS  ★ NEW
     • Donation created → success popup + confetti
     • Delivery status → progress bar animation
     • Driver assigned → route drawing animation
     • Login success → checkmark draw + welcome pop
     • Logout → fade-and-shrink transition
     • QR scanned → scan-line sweep + confirm check
     • AI analysis → sequential pipeline light-up
     • Match accepted → card flip + pulse
     • Form submit → button morph to loader

   ========================================================================== */

(function () {
  'use strict';

  /* ==========================================================
     0. UTILITIES
     ========================================================== */
  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const raf = window.requestAnimationFrame.bind(window);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ==========================================================
     1. MARK PAGE + LUCIDE
     ========================================================== */
  document.documentElement.classList.add('js-anim');
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    try { lucide.createIcons(); } catch (e) {}
  }

  /* ==========================================================
     2. PAGE ENTRANCE
     ========================================================== */
  document.body.classList.add('ff-page-enter');

  let pageReadyFired = false;
  function pageReady() {
    if (pageReadyFired) return;
    pageReadyFired = true;
    raf(() => document.body.classList.add('ff-page-ready'));
  }
  if (document.readyState === 'complete') pageReady();
  else window.addEventListener('load', pageReady, { once: true });

  /* Failsafes — never let the page stay invisible */
  setTimeout(pageReady, 1500);
  window.addEventListener('error', pageReady, { once: true });
  window.addEventListener('unhandledrejection', pageReady, { once: true });

  /* ==========================================================
     3. SCROLL PROGRESS + HEADER
     ========================================================== */
  const progress = document.getElementById('scroll-progress');
  const header   = $('.site-header');

  function updateScrollUI() {
    if (progress) {
      const h = document.documentElement;
      const scrolled = h.scrollTop || document.body.scrollTop;
      const height = (h.scrollHeight || document.body.scrollHeight) - h.clientHeight;
      progress.style.transform = 'scaleX(' + (height > 0 ? scrolled / height : 0) + ')';
    }
    if (header) header.classList.toggle('scrolled', window.scrollY > 12);
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    raf(() => { updateScrollUI(); ticking = false; });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  updateScrollUI();

  /* ==========================================================
     4. AUTO-TAG EVERYTHING THAT SHOULD REVEAL
     ========================================================== */
  const AUTO_TARGETS = [
    /* Homepage */
    '.hp-hero-left', '.hp-hero-right', '.hp-marquee', '.hp-sec-title',
    '.hp-step2', '.ai-visual', '.ai-text', '.hp-live-card',
    '.hp-who-card', '.hp-faq-item', '.hp-cta-box',

    /* Donate Food */
    '.wizard-container', '.section-title', '.form-group',
    '.image-upload-box', '.preset-selector',

    /* AI Inspection */
    '.ai-header', '.ai-pipeline', '.ai-grid > *',
    '.analysis-card', '.image-panel', '.ai-result-card',
    '.freshness-score-display',

    /* Find Ashrams */
    '.ashram-tile', '.search-filter-bar', '.filter-buttons',

    /* Driver Hub */
    '.driver-card', '.match-card', '.ashram-card', '.mission-controls',

    /* Rescue & Track */
    '.map-wrapper', '.driver-telemetry-card', '.impact-box',
    '.zt-card', '.zt-driver-card', '.zt-top', '.zt-bottom',
    '.timeline-step', '.rt-tabs', '.zt-summary-row',

    /* Leaderboard */
    '.leaderboard-table-wrapper', '.preset-chips',

    /* Impact & CSR */
    '.impact-grid > *', '.monthly-chart', '.summary-box',
    '.action-buttons',

    /* Admin */
    '.admin-box',

    /* Profile */
    '.profile-sidebar .sidebar-menu',

    /* Dashboard */
    '.dash-stat-card', '.dash-welcome'
  ];

  AUTO_TARGETS.forEach(sel => {
    $$(sel).forEach((el, i) => {
      if (el.classList.contains('rv')) return;
      el.classList.add('rv');
      if (!el.style.getPropertyValue('--d')) {
        el.style.setProperty('--d', String(Math.min(i, 6)));
      }
    });
  });

  /* Directional */
  $$('.hp-hero-left, .ai-text').forEach(el => el.classList.add('rv-left'));
  $$('.hp-hero-right, .ai-visual').forEach(el => el.classList.add('rv-right'));
  $$('.leaderboard-table tbody tr').forEach(row => row.classList.add('rv', 'rv-left'));

  /* ==========================================================
     5. INTERSECTION OBSERVER — REVEALS
     ========================================================== */
  const revealTargets = $$('.rv');
  if ('IntersectionObserver' in window && !reducedMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });
    revealTargets.forEach(el => io.observe(el));
  } else {
    revealTargets.forEach(el => el.classList.add('in'));
  }

  /* ==========================================================
     6. HERO PARALLAX
     ========================================================== */
  const preview = $('.hp-preview');
  if (preview && !reducedMotion && window.matchMedia('(hover: hover) and (min-width: 1024px)').matches) {
    const hero = $('.hp-hero');
    if (hero) {
      hero.addEventListener('mousemove', (e) => {
        const rect = hero.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        preview.style.transform =
          'perspective(1000px) rotateY(' + (x * 6) + 'deg) rotateX(' +
          (-y * 6) + 'deg) translateZ(0)';
      });
      hero.addEventListener('mouseleave', () => { preview.style.transform = ''; });
    }
  }

  /* ==========================================================
     7. PAUSE MARQUEE WHEN TAB HIDDEN
     ========================================================== */
  const marqueeTrack = $('.hp-marquee-track');
  document.addEventListener('visibilitychange', () => {
    if (!marqueeTrack) return;
    marqueeTrack.style.animationPlayState = document.hidden ? 'paused' : 'running';
  });

  /* ==========================================================
     8. ANIMATED COUNTERS (fraction/decimal aware)
     ========================================================== */
  const counters = $$(
    '.hp-hero-impact strong, .impact-box h3, .dash-stat-body strong'
  );

  if ('IntersectionObserver' in window && !reducedMotion) {
    const counterIO = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        counterIO.unobserve(el);

        const raw = el.textContent.trim();
        const match = raw.match(/^([~]?)([\d,]*\.?\d+)(.*)$/);
        if (!match) return;

        const prefix = match[1];
        const numStr = match[2].replace(/,/g, '');
        const target = parseFloat(numStr);
        if (isNaN(target) || target === 0) return;

        const suffix = match[3] || '';
        const hasDecimal = numStr.indexOf('.') !== -1;
        const dur = 1400;
        const start = performance.now();

        function step(now) {
          const t = Math.min((now - start) / dur, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          const val = target * eased;
          const display = hasDecimal
            ? val.toFixed(1)
            : Math.round(val).toLocaleString('en-IN');
          el.textContent = prefix + display + suffix;
          if (t < 1) raf(step);
        }
        raf(step);
      });
    }, { threshold: 0.35 });
    counters.forEach(el => counterIO.observe(el));
  }

  /* ==========================================================
     9. SMOOTH ANCHOR LINKS
     ========================================================== */
  $$('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const target = $(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  /* ==========================================================
     10. BUTTON RIPPLE
     ========================================================== */
  if (!reducedMotion) {
    $$('.btn, .hp-btn, .filter-btn, .rt-tab, .step-indicator, ' +
       '.dash-link, .zt-icon-btn, .zt-secondary-btn, .user-chip, ' +
       '.sidebar-menu .menu-item').forEach(el => {
      el.addEventListener('click', function (e) {
        const rect = el.getBoundingClientRect();
        const ripple = document.createElement('span');
        ripple.className = 'ff-ripple';
        const size = Math.max(rect.width, rect.height);
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
        ripple.style.top  = (e.clientY - rect.top  - size / 2) + 'px';
        el.appendChild(ripple);
        setTimeout(() => ripple.remove(), 650);
      });
    });
  }

  /* ==========================================================
     11. CARD TILT ON HOVER
     ========================================================== */
  if (!reducedMotion && window.matchMedia('(hover: hover)').matches) {
    const tiltCards = $$(
      '.hp-step2, .hp-who-card, .ashram-tile, .impact-box, ' +
      '.dash-stat-card, .analysis-card, .match-card, .zt-card, ' +
      '.driver-card, .hp-live-card'
    );
    tiltCards.forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width  - 0.5;
        const y = (e.clientY - rect.top)  / rect.height - 0.5;
        card.style.transform =
          'perspective(800px) rotateY(' + (x * 4) + 'deg) rotateX(' +
          (-y * 4) + 'deg) translateY(-3px)';
      });
      card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    });
  }

  /* ==========================================================
     12. STAGGER-IN STAT GRIDS
     ========================================================== */
  $$('.impact-grid, .dash-stats-grid').forEach(grid => {
    Array.from(grid.children).forEach((child, i) => {
      child.style.animationDelay = (i * 80) + 'ms';
      child.classList.add('ff-stagger-in');
    });
  });

  /* ==========================================================
     13. WIZARD STEP SLIDE-IN
     ========================================================== */
  const stepObserver = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      const el = m.target;
      if (el.hasAttribute('hidden')) return;
      el.classList.remove('ff-slide-in');
      void el.offsetWidth;
      el.classList.add('ff-slide-in');
      /* Also animate the child form groups */
      $$('.form-group, .form-row', el).forEach((g, i) => {
        g.style.animationDelay = (i * 60) + 'ms';
        g.classList.remove('ff-stagger-in');
        void g.offsetWidth;
        g.classList.add('ff-stagger-in');
      });
    });
  });
  $$('.wizard-step-body').forEach(el => {
    stepObserver.observe(el, { attributes: true, attributeFilter: ['hidden'] });
  });

  /* ==========================================================
     14. MODAL POP-IN
     ========================================================== */
  const modalObserver = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      const el = m.target;
      if (el.hidden) return;
      const card = el.querySelector('.modal-card');
      if (!card) return;
      card.classList.remove('ff-modal-pop');
      void card.offsetWidth;
      card.classList.add('ff-modal-pop');
    });
  });
  $$('.modal-overlay').forEach(el => {
    modalObserver.observe(el, { attributes: true, attributeFilter: ['hidden'] });
  });

  /* ==========================================================
     15. TOAST BOUNCE
     ========================================================== */
  const toastEl = document.getElementById('ff-toast');
  if (toastEl) {
    const toastObs = new MutationObserver(() => {
      if (toastEl.textContent && toastEl.textContent.trim()) {
        toastEl.classList.remove('ff-toast-bounce');
        void toastEl.offsetWidth;
        toastEl.classList.add('ff-toast-bounce');
      }
    });
    toastObs.observe(toastEl, { childList: true, characterData: true, subtree: true });
  }

  /* ==========================================================
     ★ NEW LAYER 6 — TRANSACTION & FLOW ANIMATIONS
     ========================================================== */

  /* ----------------------------------------------------------
     16. SUCCESS POPUP + CONFETTI (Transactions)
     Usage:
       window.ffSuccess('Donation created!', 'FF-DON-98241');
     --------------------------------------------------------- */
  window.ffSuccess = function (title, subtitle, opts) {
    opts = opts || {};
    const wantConfetti = opts.confetti !== false && !reducedMotion;

    /* Build overlay */
    const overlay = document.createElement('div');
    overlay.className = 'ff-success-overlay';
    overlay.innerHTML =
      '<div class="ff-success-card">' +
        '<div class="ff-success-check">' +
          '<svg viewBox="0 0 52 52" aria-hidden="true">' +
            '<circle cx="26" cy="26" r="24" fill="none" stroke="currentColor" stroke-width="3"/>' +
            '<path d="M14 27 L23 36 L39 18" fill="none" stroke="currentColor" stroke-width="4" ' +
              'stroke-linecap="round" stroke-linejoin="round"/>' +
          '</svg>' +
        '</div>' +
        '<h3 class="ff-success-title">' + (title || 'Success!') + '</h3>' +
        (subtitle ? '<p class="ff-success-sub">' + subtitle + '</p>' : '') +
      '</div>';
    document.body.appendChild(overlay);

    /* Auto-dismiss */
    const dismiss = () => {
      overlay.classList.add('ff-success-out');
      setTimeout(() => overlay.remove(), 400);
    };
    overlay.addEventListener('click', dismiss);
    setTimeout(dismiss, opts.duration || 2200);

    /* Confetti burst */
    if (wantConfetti) spawnConfetti(28);
  };

  function spawnConfetti(count) {
    const colors = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899'];
    const layer = document.createElement('div');
    layer.className = 'ff-confetti-layer';
    document.body.appendChild(layer);

    for (let i = 0; i < count; i++) {
      const piece = document.createElement('span');
      piece.className = 'ff-confetti';
      piece.style.left = (Math.random() * 100) + '%';
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDelay = (Math.random() * 0.3) + 's';
      piece.style.animationDuration = (1.2 + Math.random() * 0.9) + 's';
      piece.style.transform = 'rotate(' + (Math.random() * 360) + 'deg)';
      layer.appendChild(piece);
    }
    setTimeout(() => layer.remove(), 2800);
  }

  /* ----------------------------------------------------------
     17. DELIVERY PROGRESS ANIMATION
     Animates the .zt-steps timeline gradually
     ---------------------------------------------------------- */
  window.ffProgressFlow = function (stepIndex) {
    const steps = $$('#zt-steps .zt-step');
    if (!steps.length) return;
    steps.forEach((el, i) => {
      el.classList.remove('done', 'active');
      if (i < stepIndex) el.classList.add('done');
      else if (i === stepIndex) el.classList.add('active');
    });
  };

  /* Auto-run progress if steps exist on page load */
  const ztStepsEl = $('#zt-steps');
  if (ztStepsEl) {
    setTimeout(() => window.ffProgressFlow(2), 900);
  }

  /* ----------------------------------------------------------
     18. DRIVER ROUTE DRAWING (SVG path animation)
     Adds a stroke-dash animation to any inline SVG path
     inside a map preview
     ---------------------------------------------------------- */
  $$('.hp-map-svg path').forEach(p => {
    if (reducedMotion) return;
    try {
      const len = p.getTotalLength ? p.getTotalLength() : 0;
      if (len > 0) {
        p.style.strokeDasharray = len;
        p.style.strokeDashoffset = len;
        p.style.animation = 'ff-drawRoute 1.6s ease-out forwards';
      }
    } catch (e) {}
  });

  /* ----------------------------------------------------------
     19. LIVE ACTIVITY PULSE — force animate dots
     ---------------------------------------------------------- */
  $$('.hp-live-dot, .hp-preview-dot, .status-dot, .zt-eta-dot, .zt-driver-halo')
    .forEach((dot, i) => {
      dot.style.animationDelay = (i * 0.2) + 's';
    });

  /* ----------------------------------------------------------
     20. STATUS BADGE PULSE-IN
     ---------------------------------------------------------- */
  $$('.badge, .hp-live-tag, .hp-info-tag, .zt-priority, .la-badge').forEach((b, i) => {
    b.classList.add('ff-badge-in');
    b.style.animationDelay = (i * 40) + 'ms';
  });

  /* ----------------------------------------------------------
     21. FORM SUBMIT → BUTTON MORPH TO LOADER
     Listens on any form submission that starts a fetch; you can
     also call window.ffButtonLoading(btn, true/false)
     ---------------------------------------------------------- */
  window.ffButtonLoading = function (btn, on) {
    if (!btn) return;
    if (on) {
      if (!btn.dataset._orig) btn.dataset._orig = btn.innerHTML;
      btn.classList.add('ff-btn-loading');
      btn.disabled = true;
      btn.innerHTML = '<span class="ff-btn-spinner"></span> Processing…';
    } else {
      btn.classList.remove('ff-btn-loading');
      btn.disabled = false;
      if (btn.dataset._orig) btn.innerHTML = btn.dataset._orig;
    }
  };

  /* Auto-hook common submit buttons (donation create, ai run, signup) */
  ['#create-donation-btn', '#run-ai-btn', '#signup-submit-btn',
   '#login-submit-btn', '#save-profile-btn', '#save-notif-btn']
    .forEach(sel => {
      const btn = $(sel);
      if (!btn) return;
      btn.addEventListener('click', function () {
        /* Turn on loading, auto-off after 3.5s in case the handler forgot */
        setTimeout(() => window.ffButtonLoading(btn, true), 0);
        setTimeout(() => window.ffButtonLoading(btn, false), 3500);
      });
    });

  /* ----------------------------------------------------------
     22. AI PIPELINE SEQUENTIAL LIGHT-UP
     Shows the "AI Processing Pipeline" steps lighting one by one
     ---------------------------------------------------------- */
  const aiPipeline = $$('.ai-card-top, #ai-loading-state, .ai-pipeline');
  if (aiPipeline.length) {
    const pipelineNodes = $$('.analysis-card, .ai-lower-grid > *, .ai-summary-grid > *');
    pipelineNodes.forEach((node, i) => {
      node.style.animationDelay = (i * 120) + 'ms';
      node.classList.add('ff-pipeline-in');
    });
  }

  /* ----------------------------------------------------------
     23. NUMBER FLIP-IN for stat cards
     ---------------------------------------------------------- */
  $$('.dash-stat-body strong, .impact-box h3, .result-details strong')
    .forEach((el, i) => {
      el.style.animationDelay = (i * 70) + 'ms';
      el.classList.add('ff-num-flip');
    });

  /* ----------------------------------------------------------
     24. QR SCANNER SWEEP (Driver Hub)
     ---------------------------------------------------------- */
  const qrBox = document.getElementById('qr-scanner-box');
  if (qrBox) {
    const scanLine = document.createElement('div');
    scanLine.className = 'ff-qr-scanline';
    qrBox.style.position = 'relative';
    qrBox.appendChild(scanLine);
  }

  /* ----------------------------------------------------------
     25. PAGE TRANSITION — fade out before navigating away
     Hooks internal .html links; adds 200ms fade-out
     ---------------------------------------------------------- */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('http') ||
        href.startsWith('mailto:') || href.startsWith('tel:') ||
        a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey) return;
    if (!/\.html($|#|\?)/.test(href)) return;
    e.preventDefault();
    document.body.classList.add('ff-page-leaving');
    setTimeout(() => { window.location.href = href; }, 220);
  });

  /* ----------------------------------------------------------
     26. LOGIN SUCCESS — welcome pop
     Hook the login button. When completeLogin runs, we also play
     a soft welcome pulse on the user chip
     ---------------------------------------------------------- */
  const userChip = document.getElementById('user-chip');
  if (userChip) {
    const chipObs = new MutationObserver(() => {
      if (!userChip.closest('#header-user').hidden) {
        userChip.classList.remove('ff-chip-welcome');
        void userChip.offsetWidth;
        userChip.classList.add('ff-chip-welcome');
      }
    });
    chipObs.observe(userChip.closest('#header-user'), {
      attributes: true, attributeFilter: ['hidden']
    });
  }

  /* ----------------------------------------------------------
     27. LOGOUT ANIMATION — fade + shrink sidebar & page
     ---------------------------------------------------------- */
  const logoutBtns = $$('#user-logout-btn, #profile-logout-btn, #dash-logout-btn, #logoutBtn');
  logoutBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (reducedMotion) return;
      document.body.classList.add('ff-page-leaving');
    });
  });

  /* ----------------------------------------------------------
     28. MATCH CARD ACCEPT — card flip + pulse
     ---------------------------------------------------------- */
  $$('[data-accept-delivery], [data-approve]').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.match-card') || btn.closest('li') || btn.closest('.admin-box');
      if (!card || reducedMotion) return;
      card.classList.add('ff-card-accepted');
      setTimeout(() => card.classList.remove('ff-card-accepted'), 1200);
    });
  });

  /* ----------------------------------------------------------
     29. REJECT ANIMATION — slide-out + fade
     ---------------------------------------------------------- */
  $$('[data-reject], [data-decline-delivery]').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.match-card') || btn.closest('li');
      if (!card || reducedMotion) return;
      card.classList.add('ff-card-rejected');
    });
  });

  /* ----------------------------------------------------------
     30. LIVE COUNT-UP FOR NOTIFICATIONS / BADGES
     ---------------------------------------------------------- */
  $$('.hp-live-head strong, .la-header strong').forEach((el, i) => {
    el.style.animationDelay = (i * 50) + 'ms';
    el.classList.add('ff-slide-in-left');
  });

  /* ----------------------------------------------------------
     31. MAP PINS DROP-IN ANIMATION
     ---------------------------------------------------------- */
  $$('.hp-mk, .zt-driver-marker').forEach((pin, i) => {
    pin.style.animationDelay = (i * 150) + 'ms';
    pin.classList.add('ff-pin-drop');
  });

  /* ----------------------------------------------------------
     32. SIDEBAR SLIDE-IN — animate menu items one by one
     ---------------------------------------------------------- */
  const sidebarMenu = document.getElementById('sidebarMenu');
  if (sidebarMenu) {
    const menuObs = new MutationObserver(() => {
      $$('.menu-item', sidebarMenu).forEach((item, i) => {
        item.style.animationDelay = (i * 40) + 'ms';
        item.classList.remove('ff-menu-slide');
        void item.offsetWidth;
        item.classList.add('ff-menu-slide');
      });
    });
    menuObs.observe(sidebarMenu, { childList: true });
  }

  /* ----------------------------------------------------------
     33. FORM VALIDATION SHAKE — for error feedback
     Usage: window.ffShake(element)
     ---------------------------------------------------------- */
  window.ffShake = function (el) {
    if (!el || reducedMotion) return;
    el.classList.remove('ff-shake');
    void el.offsetWidth;
    el.classList.add('ff-shake');
  };

  /* Auto-shake field-error elements when they become visible */
  $$('.field-error').forEach(err => {
    const obs = new MutationObserver(() => {
      if (err.style.display !== 'none' && err.textContent.trim()) {
        window.ffShake(err);
      }
    });
    obs.observe(err, { attributes: true, attributeFilter: ['style'], childList: true, subtree: true });
  });

 /* ----------------------------------------------------------
   34. IMAGE LOAD FADE-IN (opt-in + reactive to src changes)
   ---------------------------------------------------------- */
$$('img').forEach(img => {
  /* Skip the donate-food preview — it must appear instantly */
  if (img.id === 'upload-preview') return;

  img.classList.add('ff-img-fade');

  const markReady = () => img.classList.add('ff-img-ready');
  if (img.complete && img.naturalWidth > 0) markReady();
  else img.addEventListener('load', markReady);

  /* Re-attach on src change so any swapped image also fades in */
  const srcObs = new MutationObserver(() => {
    img.classList.remove('ff-img-ready');
    if (img.complete && img.naturalWidth > 0) markReady();
    else img.addEventListener('load', markReady, { once: true });
  });
  srcObs.observe(img, { attributes: true, attributeFilter: ['src'] });
});

  /* ----------------------------------------------------------
     35. COUNTER UP ON DONATION COMPLETE
     Call: window.ffCounterBump(selector, newValue)
     ---------------------------------------------------------- */
  window.ffCounterBump = function (selector, newValue) {
    const el = $(selector);
    if (!el) return;
    el.classList.remove('ff-bump');
    void el.offsetWidth;
    el.classList.add('ff-bump');
    if (typeof newValue !== 'undefined') {
      setTimeout(() => { el.textContent = newValue; }, 200);
    }
  };

  console.log('✨ Universal animations initialised');

  /* ==========================================================
     36. FEEDBACK PAGE ANIMATIONS
     ========================================================== */

  /* ---------- 36.1 Hero icon — float + ring pulse ---------- */
  const fbHeroEmoji = document.querySelector('.feedback-hero-emoji');
  const fbHeroRings = document.querySelectorAll('.feedback-hero-ring');
  if (fbHeroEmoji && !reducedMotion) {
    fbHeroEmoji.style.animation = 'feedbackHeroFloat 3s ease-in-out infinite';
  }
  fbHeroRings.forEach((ring, i) => {
    if (reducedMotion) return;
    ring.style.animation = 'feedbackHeroRing 2.4s ease-out infinite';
    ring.style.animationDelay = (i * 1.2) + 's';
  });

  /* ---------- 36.2 Form card + staggered group entrance ---------- */
  const fbCard = document.querySelector('.feedback-form-card');
  const fbGroups = document.querySelectorAll('.feedback-animate');

  if (fbCard && !reducedMotion) {
    setTimeout(() => fbCard.classList.add('feedback-card-ready'), 100);
  } else if (fbCard) {
    fbCard.classList.add('feedback-card-ready');
  }

  fbGroups.forEach(group => {
    const delay = parseInt(group.dataset.animDelay || 0, 10);
    if (reducedMotion) {
      group.classList.add('feedback-group-in');
      return;
    }
    setTimeout(() => group.classList.add('feedback-group-in'), 250 + delay * 120);
  });

  /* ---------- 36.3 Star rating ---------- */
  const fbStars = document.querySelectorAll('.rating-star');
  const fbRatingInput = document.getElementById('feedback-rating-value');
  const fbRatingLabel = document.getElementById('rating-label');

  const FB_RATING_LABELS = {
    1: { text: '😞 Very Dissatisfied', color: '#dc2626' },
    2: { text: '😕 Dissatisfied',      color: '#f59e0b' },
    3: { text: '😐 Neutral',            color: '#64748b' },
    4: { text: '😊 Satisfied',          color: '#10b981' },
    5: { text: '😍 Very Satisfied',     color: '#059669' }
  };

  let fbCurrentRating = 0;

  function fbUpdateStars(rating, animate) {
    fbStars.forEach((star, index) => {
      star.classList.toggle('active', index < rating);
      if (animate && index < rating && !reducedMotion) {
        star.style.animation = 'none';
        void star.offsetWidth;
        star.style.animation =
          'feedbackStarPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) ' + (index * 0.06) + 's both';
      }
    });
    if (fbRatingLabel && rating > 0) {
      fbRatingLabel.textContent = FB_RATING_LABELS[rating].text;
      fbRatingLabel.style.color = FB_RATING_LABELS[rating].color;
      fbRatingLabel.classList.add('rating-label-active');
    } else if (fbRatingLabel) {
      fbRatingLabel.textContent = '';
      fbRatingLabel.classList.remove('rating-label-active');
    }
    if (fbRatingInput) fbRatingInput.value = rating;
  }

  fbStars.forEach(star => {
    star.addEventListener('click', () => {
      fbCurrentRating = parseInt(star.dataset.rating, 10);
      fbUpdateStars(fbCurrentRating, true);
      if (window.ffToast && fbCurrentRating === 5) window.ffToast('🌟 Wow, thank you!');
    });
    star.addEventListener('mouseenter', () => {
      if (reducedMotion) return;
      const h = parseInt(star.dataset.rating, 10);
      fbStars.forEach((s, i) => {
        s.classList.toggle('hover', i < h);
        if (i < h) s.style.transform = 'translateY(-4px) scale(1.15)';
      });
    });
    star.addEventListener('mouseleave', () => {
      fbStars.forEach(s => { s.classList.remove('hover'); s.style.transform = ''; });
    });
  });

  /* ---------- 36.4 Radio option bounce ---------- */
  document.querySelectorAll('.feedback-type-option input').forEach(radio => {
    radio.addEventListener('change', () => {
      const parent = radio.closest('.feedback-type-option');
      if (!parent || reducedMotion) return;
      parent.classList.remove('feedback-option-pop');
      void parent.offsetWidth;
      parent.classList.add('feedback-option-pop');
    });
  });

  /* ---------- 36.5 Character counter ---------- */
  const fbMessage   = document.getElementById('feedback-message');
  const fbCharCount = document.getElementById('char-count');
  const FB_MAX_CHARS = 500;

  if (fbMessage && fbCharCount) {
    fbMessage.addEventListener('input', () => {
      let len = fbMessage.value.length;
      if (len > FB_MAX_CHARS) { fbMessage.value = fbMessage.value.slice(0, FB_MAX_CHARS); len = FB_MAX_CHARS; }
      fbCharCount.textContent = len;

      const counter = fbCharCount.parentElement;
      counter.classList.remove('warn', 'danger');
      if (len > FB_MAX_CHARS * 0.9)      counter.classList.add('danger');
      else if (len > FB_MAX_CHARS * 0.7) counter.classList.add('warn');

      if (reducedMotion) return;
      fbCharCount.style.transform = 'scale(1.2)';
      setTimeout(() => fbCharCount.style.transform = 'scale(1)', 150);
    });
  }

  /* ---------- 36.6 Input focus glow ---------- */
  document.querySelectorAll('.feedback-input, .feedback-textarea').forEach(input => {
    input.addEventListener('focus', () => input.closest('.form-group')?.classList.add('feedback-focused'));
    input.addEventListener('blur',  () => input.closest('.form-group')?.classList.remove('feedback-focused'));
  });

  /* ---------- 36.7 Submit ---------- */
  const fbForm       = document.getElementById('feedback-form');
  const fbSuccessDiv = document.getElementById('feedback-success');
  const fbError      = document.getElementById('feedback-error');
  const fbSubmitBtn  = fbForm ? fbForm.querySelector('button[type="submit"]') : null;
  const fbSuccessStars = document.getElementById('success-stars');

  function fbShowError(msg, field) {
    if (fbError) {
      fbError.textContent = msg;
      fbError.style.display = 'block';
      fbError.classList.remove('feedback-error-in');
      void fbError.offsetWidth;
      fbError.classList.add('feedback-error-in');
      fbError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (field && window.ffShake) window.ffShake(field);
  }

  if (fbForm) {
    fbForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const subject = document.getElementById('feedback-subject').value.trim();
      const message = document.getElementById('feedback-message').value.trim();

      if (!subject) { fbShowError('Please enter a subject.', document.getElementById('feedback-subject')); return; }
      if (!message || message.length < 10) { fbShowError('Please enter your feedback (at least 10 characters).', fbMessage); return; }
      if (fbError) fbError.style.display = 'none';

      if (fbSubmitBtn) {
        fbSubmitBtn.disabled = true;
        fbSubmitBtn.classList.add('feedback-btn-loading');
        const textEl  = fbSubmitBtn.querySelector('.feedback-submit-text');
        const emojiEl = fbSubmitBtn.querySelector('.feedback-submit-emoji');
        if (textEl)  textEl.textContent = 'Submitting…';
        if (emojiEl) emojiEl.textContent = '';
      }

      try {
        await new Promise(resolve => setTimeout(resolve, 1400));

        if (!reducedMotion) fbForm.classList.add('feedback-form-exit');

        setTimeout(() => {
          fbForm.style.display = 'none';

          if (fbSuccessDiv) {
            fbSuccessDiv.style.display = 'block';
            fbSuccessDiv.classList.add('feedback-success-in');

            if (fbSuccessStars && fbCurrentRating > 0) {
              fbSuccessStars.innerHTML = '';
              for (let i = 0; i < 5; i++) {
                const s = document.createElement('span');
                s.textContent = '★';
                s.className = 'success-star' + (i < fbCurrentRating ? ' active' : '');
                s.style.animationDelay = (i * 0.08) + 's';
                fbSuccessStars.appendChild(s);
              }
            }

            if (typeof window.ffSuccess === 'function') {
              const ratingText = fbCurrentRating > 0 ? ' · ' + fbCurrentRating + '★' : '';
              window.ffSuccess(
                '🎉 Feedback Submitted!',
                'Thank you for helping us improve' + ratingText,
                { duration: 2400, confetti: true }
              );
            }
            if (window.ffToast) window.ffToast('✅ Feedback submitted successfully!');
            fbSuccessDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, reducedMotion ? 0 : 380);

      } catch (err) {
        fbShowError('⚠️ ' + (err.message || 'Could not submit feedback. Please try again.'));
        if (fbSubmitBtn) {
          fbSubmitBtn.disabled = false;
          fbSubmitBtn.classList.remove('feedback-btn-loading');
          const textEl  = fbSubmitBtn.querySelector('.feedback-submit-text');
          const emojiEl = fbSubmitBtn.querySelector('.feedback-submit-emoji');
          if (textEl)  textEl.textContent = 'Submit Feedback';
          if (emojiEl) emojiEl.textContent = '📨';
        }
      }
    });
  }

  /* ---------- 36.8 Typewriter pre-fill ---------- */
  const fbUser = (window.ffAuth && window.ffAuth.getUser) ? window.ffAuth.getUser() : null;
  if (fbUser) {
    const nameInput  = document.getElementById('feedback-name');
    const emailInput = document.getElementById('feedback-email');
    if (nameInput  && fbUser.name  && !nameInput.value)  fbTypewriter(nameInput,  fbUser.name);
    if (emailInput && fbUser.email && !emailInput.value) fbTypewriter(emailInput, fbUser.email);
  }

  function fbTypewriter(el, text) {
    if (!el || !text || reducedMotion) { if (el) el.value = text || ''; return; }
    let i = 0;
    el.value = '';
    el.classList.add('feedback-typing');
    const timer = setInterval(() => {
      el.value += text[i++];
      if (i >= text.length) { clearInterval(timer); el.classList.remove('feedback-typing'); }
    }, 40);
  }

  /* ---------- 36.9 Guest guard ---------- */
  (function feedbackGuestGuard() {
    const guard = document.getElementById('feedback-guest-guard');
    const form  = document.getElementById('feedback-form');
    if (!guard || !form) return;

    const user = (window.ffAuth && window.ffAuth.getUser) ? window.ffAuth.getUser() : null;

    if (user) {
      guard.style.display = 'none';
      form.style.display   = '';
      return;
    }

    form.style.display  = 'none';
    guard.style.display = 'block';
    if (!reducedMotion) {
      guard.animate(
        [
          { opacity: 0, transform: 'translateY(16px) scale(0.97)' },
          { opacity: 1, transform: 'none' }
        ],
        { duration: 550, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fill: 'both' }
      );
    }

    const loginBtn  = document.getElementById('feedback-login-btn');
    const signupBtn = document.getElementById('feedback-signup-btn');

    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        if (typeof window.ffOpenLoginModal === 'function') {
          window.ffOpenLoginModal();
        } else {
          sessionStorage.setItem('ff_redirect_after_login', 'feedback.html');
          window.location.href = 'index.html?login=1';
        }
      });
    }

    if (signupBtn) {
      signupBtn.addEventListener('click', () => {
        if (typeof window.ffOpenSignupModal === 'function') {
          window.ffOpenSignupModal();
        } else {
          sessionStorage.setItem('ff_redirect_after_login', 'feedback.html');
          window.location.href = 'index.html?signup=1';
        }
      });
    }
  })();

})();


/* ==========================================================================
   PICKUP TRACK — Animations (v1)
   Runs only on pages that have #pickup-map
   ========================================================================== */
(function () {
  'use strict';
  if (!document.getElementById('pickup-map')) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1. Page entrance ---------- */
  document.body.classList.add('pickup-enter');
  window.addEventListener('load', () => {
    requestAnimationFrame(() => document.body.classList.add('pickup-ready'));
  });
  setTimeout(() => document.body.classList.add('pickup-ready'), 1500);

  /* ---------- 2. Scroll progress bar (inject if missing) ---------- */
  let bar = document.querySelector('.pickup-progress');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'pickup-progress';
    document.body.appendChild(bar);
  }
  function updateBar() {
    const h = document.documentElement;
    const scrolled = h.scrollTop || document.body.scrollTop;
    const height = (h.scrollHeight || document.body.scrollHeight) - h.clientHeight;
    bar.style.transform = 'scaleX(' + (height > 0 ? scrolled / height : 0) + ')';
  }
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { updateBar(); ticking = false; });
  }, { passive: true });
  updateBar();

  /* ---------- 3. Auto-tag reveal elements + observe ---------- */
  if (!reduced && 'IntersectionObserver' in window) {
    const rvEls = document.querySelectorAll(
      '.map-card, .side, .bottom-grid .card, .impact-card, .action-row'
    );
    rvEls.forEach((el, i) => {
      if (!el.classList.contains('pickup-rv')) {
        el.classList.add('pickup-rv');
        el.style.setProperty('--d', String(Math.min(i, 4)));
      }
    });

    /* Map on left, sidebar on right */
    const mapCard = document.querySelector('.map-card');
    if (mapCard) mapCard.classList.add('pickup-rv-left');
    const side = document.querySelector('.side');
    if (side) side.classList.add('pickup-rv-right');

    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });

    document.querySelectorAll('.pickup-rv').forEach(el => io.observe(el));
  } else {
    document.querySelectorAll('.pickup-rv').forEach(el => el.classList.add('in'));
  }

  /* ---------- 4. Map-loading shimmer ---------- */
  const mapEl = document.getElementById('pickup-map');
  if (mapEl && !reduced) {
    mapEl.classList.add('pk-loading');
    const stopLoad = () => mapEl.classList.remove('pk-loading');
    /* Leaflet emits 'load' on the map object — but we may not have it yet */
    setTimeout(stopLoad, 1200);
  }

  /* ---------- 5. Map card entrance (after map is ready) ---------- */
  const mapCard = document.querySelector('.map-card');
  if (mapCard && !reduced) {
    setTimeout(() => mapCard.classList.add('pk-in'), 200);
  }

  /* ---------- 6. Ripple on action buttons ---------- */
  if (!reduced) {
    document.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', function (e) {
        const rect = btn.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const r = document.createElement('span');
        r.className = 'pk-ripple';
        r.style.width = r.style.height = size + 'px';
        r.style.left = (e.clientX - rect.left - size / 2) + 'px';
        r.style.top  = (e.clientY - rect.top  - size / 2) + 'px';
        btn.appendChild(r);
        setTimeout(() => r.remove(), 700);
      });
    });
  }

  /* ---------- 7. Impact stat count-up ---------- */
  if (!reduced && 'IntersectionObserver' in window) {
    const stats = document.querySelectorAll('.impact-stat');
    const statIO = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const stat = entry.target;
        const strongEl = stat.querySelector('strong');
        if (!strongEl || strongEl.dataset._counted) return;
        strongEl.dataset._counted = '1';

        const raw = strongEl.textContent.trim();
        const m = raw.match(/^([^\d]*)([\d.]+)(.*)$/);
        if (!m) return;

        const prefix = m[1];
        const target = parseFloat(m[2]);
        const suffix = m[3];
        const hasDecimal = m[2].indexOf('.') !== -1;
        const dur = 1200;
        const start = performance.now();

        (function step(now) {
          const t = Math.min((now - start) / dur, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          const val = target * eased;
          strongEl.textContent = prefix + (hasDecimal ? val.toFixed(1) : Math.round(val)) + suffix;
          if (t < 1) requestAnimationFrame(step);
        })(start);

        stat.classList.add('pk-counted');
        statIO.unobserve(stat);
      });
    }, { threshold: 0.4 });

    stats.forEach(s => statIO.observe(s));
  }

  /* ---------- 8. Toast helper ---------- */
  let toastEl = document.querySelector('.pk-toast');
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'pk-toast';
    document.body.appendChild(toastEl);
  }
  window.pkToast = function (msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.remove('show'), 2400);
  };

  /* ---------- 9. Confetti ---------- */
  function spawnConfetti(count) {
    if (reduced) return;
    count = count || 34;
    const colors = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#0B9F6E'];
    const layer = document.createElement('div');
    layer.className = 'pk-confetti-layer';
    document.body.appendChild(layer);

    for (let i = 0; i < count; i++) {
      const p = document.createElement('span');
      p.className = 'pk-confetti';
      p.style.left = (Math.random() * 100) + '%';
      p.style.background = colors[Math.floor(Math.random() * colors.length)];
      p.style.animationDelay = (Math.random() * 0.4) + 's';
      p.style.animationDuration = (1.4 + Math.random() * 1.1) + 's';
      p.style.transform = 'rotate(' + (Math.random() * 360) + 'deg)';
      layer.appendChild(p);
    }
    setTimeout(() => layer.remove(), 3200);
  }

  /* ---------- 10. Success popup ---------- */
  window.pkSuccess = function (title, subtitle) {
    if (reduced) { window.pkToast(title || 'Done'); return; }
    const overlay = document.createElement('div');
    overlay.className = 'pk-success';
    overlay.innerHTML =
      '<div class="pk-success-card">' +
        '<div class="pk-success-ico">🎉</div>' +
        '<h3>' + (title || 'Pickup Complete!') + '</h3>' +
        '<p>' + (subtitle || 'Driver has collected the food.') + '</p>' +
        '<button type="button">Great!</button>' +
      '</div>';
    document.body.appendChild(overlay);

    const dismiss = () => {
      overlay.classList.add('out');
      setTimeout(() => overlay.remove(), 400);
    };
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) dismiss();
    });
    overlay.querySelector('button').addEventListener('click', dismiss);
    setTimeout(dismiss, 3000);
  };

  /* ---------- 11. Expose pickup-complete animation hook ---------- */
  window.pkOnPickupComplete = function () {
    spawnConfetti(40);
    setTimeout(() => {
      window.pkSuccess(
        '🎉 Pickup Complete!',
        'Food collected — heading to Shanti Vruddhashram.'
      );
    }, 250);
  };

  /* ---------- 12. Animate timeline dot when it changes ---------- */
  const timeline = document.getElementById('timeline');
  if (timeline && !reduced) {
    const tlObserver = new MutationObserver((muts) => {
      muts.forEach(m => {
        if (m.type !== 'attributes' || m.attributeName !== 'class') return;
        const li = m.target;
        if (!li.classList.contains('done') && !li.classList.contains('active')) return;
        const dot = li.querySelector('.t-dot');
        if (!dot) return;
        dot.style.animation = 'none';
        void dot.offsetWidth;
        dot.style.animation = li.classList.contains('done')
          ? 'pkDotPop .5s cubic-bezier(.3,1.6,.5,1)'
          : 'pkDotPulse 1.8s ease-in-out infinite';
      });
    });
    tlObserver.observe(timeline, {
      attributes: true, attributeFilter: ['class'], subtree: true
    });
  }

  /* ---------- 13. Pulse sidebar banner when title changes ---------- */
  const bannerTitle = document.getElementById('status-banner-title');
  if (bannerTitle && !reduced) {
    const bo = new MutationObserver(() => {
      const banner = document.getElementById('status-banner');
      if (!banner) return;
      banner.style.animation = 'none';
      void banner.offsetWidth;
      banner.style.animation = 'pkDotPop .6s cubic-bezier(.3,1.6,.5,1)';
    });
    bo.observe(bannerTitle, { childList: true, characterData: true, subtree: true });
  }

  /* ---------- 14. Auto-fire confetti when pickup completes ---------- */
  const statusTextEl = document.getElementById('map-status-text');
  if (statusTextEl && !reduced) {
    const so = new MutationObserver(() => {
      const t = (statusTextEl.textContent || '').toLowerCase();
      if (t.includes('arrived')) {
        window.pkOnPickupComplete();
        so.disconnect();
      }
    });
    so.observe(statusTextEl, { childList: true, characterData: true, subtree: true });
  }

  console.log('✨ Pickup-track animations initialised');
})();