/* ==========================================================================
   FeedFoodForward — guest-guard.js
   Blocks guests (not logged-in users) from protected pages.
   Include this script FIRST in <head> on any page that requires login.
   ========================================================================== */
(function () {
  'use strict';

  /* Which pages require a login, and which role(s) can access them */
  var PROTECTED = {
    /* Donor-only (Ashram cannot access) */

    'index.html':           ['donor', 'admin'],
    'donate-food.html':     ['donor', 'admin'],
    'ai-inspection.html':   ['donor', 'admin'],
    'donor-dashboard.html': ['donor', 'admin'],
    'my-donations.html':    ['donor', 'admin'],
    'pickup-track.html':    ['donor', 'admin'],

    /* Driver-only */
    'driver-home.html':      ['driver', 'admin'],
    'driver-available.html': ['driver', 'admin'],
    'driver-active.html':    ['driver', 'admin'],
    'driver-verify.html':    ['driver', 'admin'],
    'driver-history.html':   ['driver', 'admin'],
    'driver-hub.html':       ['driver', 'admin'],

    /* Ashram-only */
    'ashram-home.html':     ['ashram', 'admin'],
    'ngo-dashboard.html':   ['ashram', 'admin'],
    'find-donations.html':  ['ashram', 'admin'],
    'my-requests.html':     ['ashram', 'admin'],

    /* Shared — profile / settings / tracking across roles */
    'profile.html':         ['donor', 'driver', 'ashram', 'admin'],
    'settings.html':        ['donor', 'driver', 'ashram', 'admin'],
    'rescue-track.html':    ['donor', 'driver', 'ashram', 'admin'],

    /* Admin-only */
    'admin-portal.html':    ['admin']
  };

  /* Map each role to its home page (for wrong-role redirects) */
  var ROLE_HOME = {
    donor:  'donor-dashboard.html',
    driver: 'driver-hub.html',
    ashram: 'ngo-dashboard.html',
    admin:  'admin-portal.html'
  };

  /* Current page name */
  var page = (location.pathname.split('/').pop() || 'index.html')
              .split('?')[0].split('#')[0];
  if (!page) page = 'index.html';

  var allowed = PROTECTED[page];
  if (!allowed) return;   /* Not a protected page — let it load normally */

  /* Let the auth flow through — if the URL has ?login=1 or ?signup=1,
     do NOT guard. The page will open the login/signup modal instead. */
  try {
    var params = new URLSearchParams(location.search);
    if (params.get('login') === '1' || params.get('signup') === '1') return;
  } catch (e) {}
  /* Read the logged-in user from localStorage (per-tab scoped key) */
  var user = null;
  try {
    var _tabId = sessionStorage.getItem('ff_tab_id') || 'tab_fallback';
    var raw = localStorage.getItem('fff_current_user_' + _tabId);
    user = raw ? JSON.parse(raw) : null;
    if (user && user.role === 'receiver') user.role = 'ashram';
  } catch (e) { user = null; }

  /* -------- NOT LOGGED IN → redirect to login modal on home -------- */
  if (!user) {
    try { sessionStorage.setItem('ff_redirect_after_login', page); } catch (e) {}
    var msg = document.createElement('div');
    msg.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;background:#fff;z-index:99999;font-family:Inter,sans-serif;color:#0f172a;text-align:center;padding:2rem;';
    msg.innerHTML =
      '<div>' +
        '<div style="font-size:3rem;margin-bottom:1rem;">🔒</div>' +
        '<h2 style="font-family:Outfit,sans-serif;font-weight:800;font-size:1.4rem;margin:0 0 0.5rem;">Login required</h2>' +
        '<p style="color:#64748b;font-size:0.92rem;margin:0 0 1.25rem;">Please log in to access this page.</p>' +
        '<p style="color:#94a3b8;font-size:0.8rem;margin:0;">Redirecting you to the home page…</p>' +
      '</div>';
    document.body.appendChild(msg);
    setTimeout(function () {
      window.location.replace('index.html?login=1');
    }, 700);
    return;
  }

  /* -------- LOGGED IN BUT WRONG ROLE → redirect to their home -------- */
  if (allowed.indexOf(user.role) === -1) {
    var home = ROLE_HOME[user.role] || 'index.html';
    if (page === home) return; /* avoid loop */
    window.location.replace(home);
  }
})();