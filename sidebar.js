/* ==========================================================================
   FeedFoodForward — sidebar.js
   Single source of truth for the slide-in sidebar used by every page
   (except admin-portal.html which uses its own .dash-sidebar).
   - Auto-injects the sidebar markup if it isn't already in the DOM
   - Reads the logged-in user from window.ffAuth
   - Renders role-aware menu items (donor / driver / ashram / admin)
   - Wires hamburger, close, overlay, ESC, logout
   ========================================================================== */
(function () {
  'use strict';

   var MENUS = {

    /* ============================================================
       GUEST — nobody logged in
       ============================================================ */
      guest: [
      { label: 'Leaderboard',            icon: '🏆', link: 'leaderboard.html' },
      { label: 'Food Safety Guidelines', icon: '🛡️', link: 'food-safety.html' },
      { label: 'Help & FAQ',             icon: '❓', link: 'faq.html' },
      { label: 'About FeedFoodForward',  icon: 'ℹ️', link: 'about.html' },
      { label: 'Contact Us',             icon: '📞', link: 'contact.html' },
      { label: 'Privacy Policy',         icon: '🔒', link: 'privacy-policy.html' },
       { label: 'Terms & Conditions',     icon: '📄', link: 'terms.html' },
    ],
    /* ============================================================
       DONOR — logged in as a food donor (hotel / restaurant / etc.)
       ============================================================ */
    donor: [
      { label: 'Profile',          icon: '👤', link: 'profile.html' },
      { label: 'Dashboard',        icon: '📊', link: 'donor-dashboard.html' },
      { label: 'Donate Food',      icon: '🍱', link: 'donate-food.html' },
      { label: 'My Donations',     icon: '📦', link: 'my-donations.html' },
      { label: 'My Impact',        icon: '🌍', link: 'impact-csr.html' },
      { label: 'Leaderboard',      icon: '🏆', link: 'leaderboard.html' },
      { label: 'Settings',         icon: '⚙️', link: 'settings.html' },
      { label: 'Feedback',         icon: '💬', link: 'feedback.html' },
      { label: 'Help & Support',   icon: '❓', link: 'help.html' }
    ],

    /* ============================================================
       ASHRAM / NGO — logged in as receiver
       ============================================================ */
    ashram: [
      { label: 'Organization Profile', icon: '🏛️', link: 'profile.html' },
      { label: 'Dashboard',            icon: '🏠', link: 'ngo-dashboard.html' },
      { label: 'Find Donations',       icon: '🔍', link: 'find-donations.html' },
      { label: 'My Requests',          icon: '📝', link: 'my-requests.html' },
      { label: 'Track Deliveries',     icon: '🚚', link: 'rescue-track.html' },
      { label: 'Settings',             icon: '⚙️', link: 'settings.html' },
      { label: 'Help & Support',       icon: '❓', link: 'help.html' }
    ],

    /* ============================================================
       DRIVER — logged in as delivery partner
       ============================================================ */
    driver: [
      { label: 'Profile',          icon: '👤', link: 'profile.html' },
      { label: 'Dashboard',        icon: '📊', link: 'driver-dashboard.html' },
      { label: 'Home',             icon: '🏠', link: 'driver-home.html' },
      { label: 'Active Delivery',  icon: '🚚', link: 'driver-active.html' },
      { label: 'Verify Handover',  icon: '🔐', link: 'driver-verify.html' },
      { label: 'Delivery History', icon: '📜', link: 'driver-history.html' },
      { label: 'Settings',         icon: '⚙️', link: 'settings.html' },
      { label: 'Feedback',         icon: '💬', link: 'feedback.html' },
      { label: 'Help & Support',   icon: '❓', link: 'help.html' }
    ],

    /* ============================================================
       ADMIN — platform administrator
       ============================================================ */
     admin: [
      { label: 'Dashboard',        icon: '📊', link: 'admin-portal.html' },
      { label: 'Manage Users',     icon: '👥', link: 'admin-users.html' },
      { label: 'Manage Donations', icon: '📦', link: 'admin-donations.html' },
      { label: 'Manage Drivers',   icon: '🚚', link: 'admin-drivers.html' },
      { label: 'All Deliveries',   icon: '🛣️', link: 'admin-deliveries.html' },
      { label: 'Reports & Impact', icon: '📄', link: 'admin-reports.html' },
      { label: 'Settings',         icon: '⚙️', link: 'settings.html' }
    ]
  };

  /* ---------------------------------------------------------------------
     2. AUTO-INJECT SIDEBAR MARKUP if not already in the page
     --------------------------------------------------------------------- */
  function ensureMarkup() {
    if (document.getElementById('profileSidebar')) return; // already there

    var overlay = document.createElement('div');
    overlay.id = 'sidebarOverlay';
    overlay.className = 'sidebar-overlay';

    var aside = document.createElement('aside');
    aside.id = 'profileSidebar';
    aside.className = 'profile-sidebar';
    aside.innerHTML =
      '<div class="sidebar-header">' +
        '<button id="closeSidebar" class="close-btn" aria-label="Close">✕</button>' +
        '<div class="user-info">' +
          '<div class="user-avatar" id="userAvatar">👤</div>' +
          '<div class="user-text">' +
            '<h3 id="userName">Guest</h3>' +
            '<p id="userRole" class="role-badge">Not logged in</p>' +
            '<p class="verified" id="userVerified"></p>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<nav class="sidebar-menu" id="sidebarMenu"></nav>' +
      '<div class="sidebar-footer">' +
        '<button id="logoutBtn" class="logout-btn">' +
          '<span class="icon">↩</span> Logout' +
        '</button>' +
      '</div>';

    document.body.appendChild(overlay);
    document.body.appendChild(aside);
  }

  /* ---------------------------------------------------------------------
     3. READ LOGGED-IN USER
     --------------------------------------------------------------------- */
  function currentUser() {
    var u = (window.ffAuth && window.ffAuth.getUser) ? window.ffAuth.getUser() : null;
    if (!u) {
      return {
        name: 'Guest',
        role: 'guest',          // ← changed from 'donor' to 'guest'
        avatar: '👤',
        roleLabel: 'Not logged in',
        verified: ''
      };
    }
    return {
      name:      u.name      || 'User',
      role:      u.role      || 'donor',
      avatar:    u.avatar    || '👤',
      roleLabel: u.roleLabel || 'User',
      verified:  u.verified  || 'Verified'
    };
  }

  /* ---------------------------------------------------------------------
     4. RENDER
     --------------------------------------------------------------------- */
  function renderSidebar(user) {
    var sidebar = document.getElementById('profileSidebar');
    if (!sidebar) return;

    /* Reset the Logout/Login button so it re-renders with the new role */
    var lb = document.getElementById('logoutBtn');
    if (lb) delete lb.dataset._wired;

    var userNameEl     = document.getElementById('userName');
    var userRoleEl     = document.getElementById('userRole');
    var userAvatarEl   = document.getElementById('userAvatar');
    var userVerifiedEl = document.getElementById('userVerified');
    var menuContainer  = document.getElementById('sidebarMenu');

    if (userNameEl)     userNameEl.textContent   = user.name;
    if (userRoleEl)     userRoleEl.textContent   = user.roleLabel;
    if (userAvatarEl)   userAvatarEl.textContent = user.avatar;
    if (userVerifiedEl) userVerifiedEl.textContent = user.verified ? '✔ ' + user.verified : '';

    if (!menuContainer) return;
    menuContainer.innerHTML = '';

    var currentPage = (location.pathname.split('/').pop() || 'index.html')
                        .split('?')[0].split('#')[0];

      (MENUS[user.role] || MENUS.guest).forEach(function (item) {
      var a = document.createElement('a');
      a.className = 'menu-item';
      a.href = item.link;

      /* Special: guest "Login" always goes to index.html?login=1 */
      if (item.link === '#login') {
        a.addEventListener('click', function (e) {
          e.preventDefault();
          window.location.assign('index.html?login=1');
        });
      } else {
        if (item.link.split('#')[0] === currentPage) a.classList.add('is-active');
      }

      a.innerHTML =
        '<span class="icon">' + item.icon + '</span>' +
        '<span>' + item.label + '</span>' +
        '<span class="arrow">›</span>';
      menuContainer.appendChild(a);
    });

    /* Re-wire the Logout/Login button after menu re-render */
    wireEvents();
  }
  /* ---------------------------------------------------------------------
     5. OPEN / CLOSE
     --------------------------------------------------------------------- */
  function openSidebar() {
    var sidebar = document.getElementById('profileSidebar');
    var overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.add('active');
    if (overlay) overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    var sidebar = document.getElementById('profileSidebar');
    var overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  /* ---------------------------------------------------------------------
     6. WIRE EVENTS
     --------------------------------------------------------------------- */
  function wireEvents() {
    var hamburgerBtn = document.getElementById('hamburgerBtn');
    if (hamburgerBtn) hamburgerBtn.addEventListener('click', openSidebar);

    var chipBtn = document.getElementById('user-chip');
    if (chipBtn) chipBtn.addEventListener('click', openSidebar);

    var closeBtn = document.getElementById('closeSidebar');
    if (closeBtn) closeBtn.addEventListener('click', closeSidebar);

    var overlay = document.getElementById('sidebarOverlay');
    if (overlay) overlay.addEventListener('click', closeSidebar);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeSidebar();
    });

    /* Logout / Login button — bind ONLY ONCE across re-inits */
    var logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn && !logoutBtn.dataset._wired) {
      logoutBtn.dataset._wired = '1';

      var u = (window.ffAuth && window.ffAuth.getUser) ? window.ffAuth.getUser() : null;

      if (u) {
        /* Logged in → Logout */
        logoutBtn.innerHTML = '<span class="icon">↩</span> Logout';
        logoutBtn.style.color       = '';
        logoutBtn.style.borderColor = '';
        logoutBtn.style.background  = '';

        logoutBtn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
            if (window.ffAuth) window.ffAuth.clear();
          if (window.ffToast) window.ffToast('You have been logged out.');
                setTimeout(function () { window.location.assign('guest-home.html'); }, 600);
        });
      } else {
        /* Guest → Login */
        logoutBtn.innerHTML = '<span class="icon">→</span> Login';
        logoutBtn.style.color       = '#047857';
        logoutBtn.style.borderColor = '#bbf7d0';
        logoutBtn.style.background  = '#ecfdf5';

        logoutBtn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          window.location.assign('index.html?login=1');
        });
      }
    }
  }

  /* ---------------------------------------------------------------------
     7. INIT — run at load + on DOMContentLoaded + re-wire hamburger
     --------------------------------------------------------------------- */
  function init() {
    ensureMarkup();
    renderSidebar(currentUser());
    wireEvents();
    console.log('✅ sidebar.js initialised — hamburger wired');
  }

  /* Run now */
  init();

  /* Run again when DOM is ready (safety net) */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  }

  /* Extra safety net: re-run after window.load in case app.js
     bound the hamburger AFTER us and stole the click */
  document.addEventListener('click', function (e) {
    var ham = e.target.closest('#hamburgerBtn');
    if (ham) {
      e.preventDefault();
      e.stopPropagation();
      openSidebar();
    }
  }, true);

  /* Expose a manual refresh for other scripts */
  window.ffRefreshSidebar = function () {
    renderSidebar(currentUser());
  };

})();