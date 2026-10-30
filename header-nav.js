/* ==========================================================================
   FeedFoodForward — header-nav.js (v2 · strict RBAC)
   Role-aware primary nav. Renders ONLY the items allowed for the
   currently authenticated role. Rebuilds when the role changes.
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------
     Single source of truth for role → nav items
     ------------------------------------------------------------ */
  const NAV_BY_ROLE = {
    guest: [
      { label: 'Home',                href: 'guest-home.html',      match: ['guest-home.html'] },
      { label: 'How It Works',        href: 'how-it-works.html',    match: ['how-it-works.html'] },
      { label: 'Find Ashrams',        href: 'find-ashrams.html',    match: ['find-ashrams.html'] },
      { label: 'Success Stories',     href: 'success-stories.html', match: ['success-stories.html'] },
      { label: 'Impact & CSR',        href: 'impact-csr.html',      match: ['impact-csr.html'] },
      { label: 'About',               href: 'about.html',           match: ['about.html'] }
    ],
    donor: [
      { label: 'Home',           href: 'index.html',           match: ['index.html'] },
      { label: 'Dashboard',      href: 'donor-dashboard.html', match: ['donor-dashboard.html'] },
      { label: 'Donate Food',    href: 'donate-food.html',     match: ['donate-food.html'] },
      { label: 'My Donations',   href: 'my-donations.html',    match: ['my-donations.html'] },
      { label: 'AI Inspection',  href: 'ai-inspection.html',   match: ['ai-inspection.html'] },
      { label: 'Find Ashrams',   href: 'find-ashrams.html',    match: ['find-ashrams.html'] },
      { label: 'Pickup',         href: 'pickup-track.html',    match: ['pickup-track.html'] }
    ],
    ashram: [
      { label: 'Home',             href: 'ashram-home.html',    match: ['ashram-home.html'] },
      { label: 'Dashboard',        href: 'ngo-dashboard.html',  match: ['ngo-dashboard.html'] },
      { label: 'Find Donations',   href: 'find-donations.html', match: ['find-donations.html'] },
      { label: 'My Requests',      href: 'my-requests.html',    match: ['my-requests.html'] },
      { label: 'Track Deliveries', href: 'rescue-track.html',   match: ['rescue-track.html'] }
    ],
    driver: [
      { label: 'Home',      href: 'driver-home.html',       match: ['driver-home.html'] },
      { label: 'Dashboard', href: 'driver-dashboard.html',  match: ['driver-dashboard.html'] },
      { label: 'Active',    href: 'driver-active.html',     match: ['driver-active.html'] },
      { label: 'Verify',    href: 'driver-verify.html',     match: ['driver-verify.html'] },
      { label: 'History',   href: 'driver-history.html',    match: ['driver-history.html'] }
    ],
    admin: [
      { label: 'Admin Portal', href: 'admin-portal.html',     match: ['admin-portal.html'] },
      { label: 'Donations',    href: 'admin-donations.html',  match: ['admin-donations.html'] },
      { label: 'Users',        href: 'admin-users.html',      match: ['admin-users.html'] },
      { label: 'Deliveries',   href: 'admin-deliveries.html', match: ['admin-deliveries.html'] },
      { label: 'Drivers',      href: 'admin-drivers.html',    match: ['admin-drivers.html'] },
      { label: 'Reports',      href: 'admin-reports.html',    match: ['admin-reports.html'] }
    ]
  };

  function getCurrentPage() {
    const p = (location.pathname.split('/').pop() || 'index.html')
                .split('?')[0].split('#')[0];
    return p || 'index.html';
  }

  let lastRole = null;

  function buildNav(nav, role) {
    const items = NAV_BY_ROLE[role] || NAV_BY_ROLE.guest;
    const page  = getCurrentPage();

    nav.innerHTML = '';
    items.forEach(item => {
      const a = document.createElement('a');
      a.className = 'nav-link';
      a.href = item.href;
      a.textContent = item.label;
      if (item.match && item.match.indexOf(page) !== -1) {
        a.classList.add('active');
        a.setAttribute('aria-current', 'page');
      }
      nav.appendChild(a);
    });
  }

  function decorateNav() {
    const nav = document.getElementById('site-nav');
    if (!nav) return;

    let user = null;
    if (window.ffAuth && window.ffAuth.getUser) {
      try { user = window.ffAuth.getUser(); } catch (e) { user = null; }
    }
    /* Guest pages are recognised by URL too */
    const page = getCurrentPage();
    const isGuestPage = page === 'guest-home.html' ||
                        page === 'index.html' && !user;

    let role = (user && user.role) ? user.role : 'guest';

    /* Force guest nav on the guest-home page even if someone is logged in */
    if (page === 'guest-home.html') role = 'guest';

    if (role !== lastRole || nav.dataset._built !== '1' || isGuestPage) {
      buildNav(nav, role);
      nav.dataset._built = '1';
      lastRole = role;
      return;
    }

    /* Refresh active state only */
    const pg = getCurrentPage();
    nav.querySelectorAll('.nav-link').forEach(a => {
      const href = (a.getAttribute('href') || '').split('?')[0].split('#')[0];
      a.classList.toggle('active', href === pg);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', decorateNav);
  } else {
    decorateNav();
  }

  /* React to login/logout in other tabs */
  window.addEventListener('storage', decorateNav);
  window.ffRenderNav = decorateNav;

})();