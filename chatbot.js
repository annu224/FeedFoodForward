/* ==========================================================================
   FeedFoodForward — chatbot.js  (v2 · Project-Aware)
   A self-contained floating chat widget with a deep knowledge base
   about the FeedFoodForward platform. Works online (Gemini) and offline
   (local keyword matcher).
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- 1. Prevent double-injection ---------- */
  if (document.getElementById('ff-chat-widget')) return;

  /* ---------- 2. Build markup ---------- */
  const wrap = document.createElement('div');
  wrap.id = 'ff-chat-widget';
  wrap.innerHTML = `
    <button type="button" id="ff-chat-toggle" aria-label="Open chat">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
           stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <span class="ff-chat-badge" id="ff-chat-badge">1</span>
    </button>

    <div id="ff-chat-panel" hidden>
      <div class="ff-chat-header">
        <div class="ff-chat-header-left">
          <div class="ff-chat-avatar">🤖</div>
          <div>
            <div class="ff-chat-title">FeedFoodForward Assistant</div>
            <div class="ff-chat-status"><span class="ff-chat-dot"></span> Online</div>
          </div>
        </div>
        <button type="button" id="ff-chat-close" aria-label="Close chat">✕</button>
      </div>

      <div class="ff-chat-messages" id="ff-chat-messages"></div>

      <div class="ff-chat-quick" id="ff-chat-quick">
        <button type="button" data-q="How do I donate food?">🍱 How to donate?</button>
        <button type="button" data-q="How does AI inspection work?">🤖 AI inspection</button>
        <button type="button" data-q="How do I track my delivery?">🚚 Track delivery</button>
        <button type="button" data-q="What is FeedFoodForward?">ℹ️ About the platform</button>
      </div>

      <form class="ff-chat-input-row" id="ff-chat-form" onsubmit="return false;">
        <input type="text" id="ff-chat-input" placeholder="Ask me anything about FeedFoodForward…" autocomplete="off">
        <button type="submit" id="ff-chat-send" aria-label="Send">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </form>
    </div>
  `;
  document.body.appendChild(wrap);

  /* ---------- 3. Wire elements ---------- */
  const toggle   = document.getElementById('ff-chat-toggle');
  const panel    = document.getElementById('ff-chat-panel');
  const closeBtn = document.getElementById('ff-chat-close');
  const badge    = document.getElementById('ff-chat-badge');
  const messages = document.getElementById('ff-chat-messages');
  const form     = document.getElementById('ff-chat-form');
  const input    = document.getElementById('ff-chat-input');
  const quickRow = document.getElementById('ff-chat-quick');

  /* ---------- 4. DEEP PROJECT KNOWLEDGE BASE ---------- */
  /* Each entry: { keys: [...], reply: "..." }
     Matches on ANY keyword (case-insensitive). First match wins.
     Order matters — put more specific entries first. */
  const KB = [

    /* ============ GREETINGS ============ */
    {
      keys: ['hi', 'hello', 'hey', 'namaste', 'good morning', 'good evening', 'good afternoon'],
      reply: 'Hello! 👋 I\'m the FeedFoodForward assistant. Ask me about <strong>donating food</strong>, <strong>AI inspection</strong>, <strong>tracking deliveries</strong>, <strong>ashrams</strong>, <strong>your role</strong>, or anything else about the platform.'
    },
    {
      keys: ['thanks', 'thank you', 'thankyou', 'great', 'awesome', 'cool', 'nice'],
      reply: 'You\'re welcome! 💚 Every rescue counts. Ask me anything else about FeedFoodForward.'
    },
    {
      keys: ['bye', 'goodbye', 'see you', 'talk later'],
      reply: 'Bye! 👋 Come back anytime. Every meal rescued makes a difference.'
    },

    /* ============ ABOUT THE PROJECT ============ */
    {
      keys: ['what is feedfoodforward', 'what is this', 'about the platform', 'about this site', 'about feedfoodforward', 'who made this'],
      reply: 'FeedFoodForward is an <strong>AI-powered food redistribution platform</strong> that connects food donors (hotels, restaurants, cafés, bakeries, event kitchens) with verified receivers (ashrams, NGOs, old-age homes, orphanages) through trained delivery drivers. It combines <strong>photo-based AI inspection</strong>, <strong>smart receiver matching</strong>, <strong>live GPS tracking</strong>, and <strong>QR-verified handover</strong> — all in one place.'
    },
    {
      keys: ['mission', 'purpose', 'why', 'goal', 'vision'],
      reply: 'Our mission is simple: <strong>"Rescue Food. Reduce Waste. Feed Communities."</strong> We exist to stop good food from being thrown away while people nearby go hungry. Every donation you make is tracked, verified, and delivered to a real receiver.'
    },
    {
      keys: ['free', 'cost', 'price', 'charge', 'fee', 'paid'],
      reply: 'FeedFoodForward is <strong>completely free</strong> — both for donors and for receivers. There are no commissions, no subscriptions, no hidden charges. We only ask partners to keep pickup windows accurate so drivers aren\'t kept waiting.'
    },

    /* ============ USER ROLES ============ */
    {
      keys: ['what roles', 'user roles', 'types of users', 'account types', 'who can use'],
      reply: 'There are 4 roles on FeedFoodForward:<br>• 🏨 <strong>Donor</strong> — hotels, restaurants, cafés, bakeries, event organizers<br>• 👵 <strong>Ashram/NGO</strong> — receivers like old-age homes, orphanages, shelters<br>• 🚚 <strong>Driver</strong> — trained delivery partners with GPS + QR scanning<br>• ⚡ <strong>Admin</strong> — platform oversight (created only by the platform owner)'
    },
    {
      keys: ['who can donate', 'can i donate', 'donor type', 'donor types', 'who is a donor'],
      reply: 'Any surplus-food business can donate: <strong>hotels, restaurants, cafés, bakeries, cloud kitchens, banquet halls, corporate kitchens, event organizers</strong>. You can register as a donor on the homepage by clicking <strong>Sign Up → Donor</strong>.'
    },
    {
      keys: ['become driver', 'register as driver', 'how to be driver', 'driver signup'],
      reply: 'To become a delivery partner, sign up as a <strong>Driver</strong> on the homepage. You\'ll need a vehicle type (two-wheeler, auto, EV cargo van, etc.), a driving licence number, and your operating city. Once approved, you\'ll get access to the <strong>Driver Hub</strong>.'
    },
    {
      keys: ['become ashram', 'register as ngo', 'register as ashram', 'receiver signup', 'register receiver'],
      reply: 'To register as a receiver, sign up as an <strong>Ashram/NGO</strong>. You\'ll provide your organization name, type (Vruddhashram, Anath Ashram, NGO, Shelter, etc.), number of residents, address, and food requirements. Once verified, you can receive matched donations.'
    },
    {
      keys: ['admin account', 'become admin', 'register as admin'],
      reply: 'Admin accounts <strong>cannot be self-registered</strong>. They are created only by the platform owner. If you think you need admin access, email <strong>support@feedfoodforward.demo</strong>.'
    },
    {
      keys: ['what can donor do', 'donor dashboard', 'donor features'],
      reply: 'Donors can:<br>• 🍱 Create a new donation (5-step wizard)<br>• 📊 View their dashboard (<a href="donor-dashboard.html">donor-dashboard.html</a>)<br>• 📦 See all past and active donations (<a href="my-donations.html">my-donations.html</a>)<br>• 🚚 Track pickups live<br>• 🏆 Appear on the leaderboard<br>• 📄 Download donation receipts<br>• 🌍 See their CO₂ / water impact'
    },
    {
      keys: ['what can driver do', 'driver hub', 'driver features', 'mission control'],
      reply: 'Drivers use the <strong>Driver Hub</strong> (<a href="driver-hub.html">driver-hub.html</a>) to:<br>• Accept or decline missions<br>• Navigate to pickup (opens Google Maps)<br>• Physically verify food and accept/reject it<br>• Scan the donor\'s <strong>Pickup QR</strong><br>• Drive to the receiver and scan the <strong>Delivery QR</strong><br>• See live GPS remaining distance and ETA'
    },
    {
      keys: ['what can ashram do', 'ngo dashboard', 'ashram features', 'receiver features'],
      reply: 'Ashrams/NGOs use the <strong>NGO Dashboard</strong> (<a href="ngo-dashboard.html">ngo-dashboard.html</a>) to:<br>• See incoming donations in real time<br>• View donor, driver, and ETA details<br>• Show their <strong>Delivery QR</strong> when the driver arrives<br>• Confirm receipt and see their impact stats'
    },

    /* ============ DONATION FLOW ============ */
    {
      keys: ['how do i donate', 'how to donate', 'donate food', 'start donation', 'create donation', 'make donation'],
      reply: 'To donate: open the <strong>Donate Food</strong> page (<a href="donate-food.html">donate-food.html</a>). Then follow the 5-step wizard:<br>1️⃣ Upload a food photo<br>2️⃣ Add details (name, quantity, servings, pickup address, etc.)<br>3️⃣ Run AI pre-screening<br>4️⃣ Match with a receiver ashram/NGO<br>5️⃣ Confirm and get your <strong>Pickup QR</strong> — show it to the driver at pickup.'
    },
    {
      keys: ['5 step', 'five step', 'wizard step', 'donation wizard', 'steps to donate'],
      reply: 'The donation wizard has 5 steps:<br>1️⃣ <strong>Photo</strong> — upload or capture an image<br>2️⃣ <strong>Details</strong> — quantity, servings, prep time, storage, address<br>3️⃣ <strong>AI Pre-Screening</strong> — Gemini estimates freshness and urgency<br>4️⃣ <strong>Matching</strong> — smart receiver recommendation<br>5️⃣ <strong>Pickup Verification</strong> — QR generation and final summary.'
    },
    {
      keys: ['what info needed', 'what details', 'donation details', 'fields to fill'],
      reply: 'To create a donation you\'ll fill in:<br>• Food name / description<br>• Category (Prepared Meal, Bakery, Fruit, Snacks, etc.)<br>• Quantity (kg)<br>• Number of servings<br>• Prepared-at time<br>• Pickup deadline<br>• Storage condition (Room temp / Refrigerated / Frozen)<br>• Pickup address<br>The AI can\'t guess most of these from a photo, so please enter them honestly.'
    },
    {
      keys: ['what image', 'photo format', 'image format', 'jpg', 'png', 'webp', 'upload photo'],
      reply: 'Use a <strong>JPG, PNG, or WEBP</strong> image under 5 MB. Clear, well-lit photos work best — centre the food in the frame, avoid heavy filters, and don\'t use blurry or dark shots. There are also demo presets (Prepared Veg Meal, Bakery Breads, Fruit Baskets) if you want to try quickly.'
    },

    /* ============ AI INSPECTION ============ */
    {
      keys: ['ai inspection', 'how does ai work', 'how does ai inspection', 'ai work', 'ai check'],
      reply: 'The AI (powered by Google Gemini) does a <strong>visual pre-screening</strong> of your photo. It estimates:<br>• Is it actually food? (rejects non-food)<br>• Food category<br>• Freshness score (0–100)<br>• Visible spoilage<br>• Pickup urgency: HIGH / MEDIUM / LOW<br><br>⚠️ It is <strong>not a safety guarantee</strong> — the driver still physically inspects the food at pickup.'
    },
    {
      keys: ['freshness', 'freshness score', 'freshness check'],
      reply: 'The AI gives your food a <strong>freshness score from 0–100</strong> based on visual cues. Scores above 85 mean "Excellent", 78–85 is "Good", 68–78 is "Moderately Fresh", and below 68 is "Needs Review". This is just a guide — the driver makes the final call after physically inspecting the food.'
    },
    {
      keys: ['no food detected', 'ai says no food', 'wrong detection', 'ai rejected'],
      reply: 'If AI says "No Food Detected", try:<br>• Use a <strong>well-lit</strong> photo<br>• Centre the food in the frame<br>• Avoid blurry or dark images<br>• Don\'t use heavy filters or overlays<br>• Make sure the food is clearly visible<br>Try uploading a different photo — the AI usually gets it right the second time.'
    },
    {
      keys: ['is ai safe', 'does ai replace', 'ai safety', 'is ai reliable'],
      reply: 'No — the AI is <strong>only a pre-screening tool</strong>, not a safety guarantee. Every donation is physically inspected by the driver at pickup (smell, appearance, packaging, temperature, prep time). If the driver rejects the food, the delivery is cancelled immediately.'
    },

    /* ============ RECEIVERS / ASHRAMS ============ */
    {
      keys: ['find ashram', 'find ashrams', 'find ngo', 'receiver near me', 'find receiver', 'where ashram'],
      reply: 'Open the <strong>Find Ashrams</strong> page (<a href="find-ashrams.html">find-ashrams.html</a>). You can:<br>• 🔍 Search by name or area<br>• 🗂️ Filter by type (Orphanage, Old Age Home, NGO, Shelter, Ashram)<br>• 📍 Click <strong>Near Me</strong> to sort by distance<br>• 🍱 Filter by "Food Needed"<br>• Quick filters for Andheri, Bandra, Dadar, Malad, Borivali<br>Currently there are <strong>149 verified ashrams & NGOs</strong> in the Mumbai region.'
    },
    {
      keys: ['how many ashrams', 'ashram count', 'how many ngos', 'number of ashrams'],
      reply: 'Currently FeedFoodForward hosts <strong>149 verified ashrams & NGOs</strong>, primarily across Mumbai and surrounding areas. Each one has been geocoded for accurate distance-based matching and live map display.'
    },
    {
      keys: ['ashram types', 'type of ashrams', 'categories of receivers'],
      reply: 'Receivers are categorized as:<br>• 👶 <strong>Orphanage / Anath Ashram</strong><br>• 👵 <strong>Vruddhashram (Old Age Home)</strong><br>• 🏠 <strong>Shelter Home</strong><br>• 🤝 <strong>NGO</strong><br>• 🕉️ <strong>Ashram</strong>'
    },

    /* ============ TRACKING ============ */
    {
      keys: ['track', 'tracking', 'where is my delivery', 'live status', 'eta', 'where is driver'],
      reply: 'Go to <strong>Rescue &amp; Track</strong> (<a href="rescue-track.html">rescue-track.html</a>) and open the <em>Track Delivery</em> tab. You\'ll see:<br>• 🗺️ The driver\'s live position on the map<br>• ⏱️ ETA to destination<br>• 📍 Distance remaining<br>• 🚦 5-step delivery timeline<br>• 📄 Download receipt (after delivery)<br>• ⚠️ Report an issue button'
    },
    {
      keys: ['how tracked', 'how does tracking work', 'gps tracking', 'live gps'],
      reply: 'Tracking is powered by:<br>• 📡 Driver\'s browser <strong>GPS</strong> (updated every 5 s)<br>• 🛣️ <strong>OSRM routing</strong> for road-accurate paths<br>• 🔌 <strong>Socket.IO</strong> for real-time push updates<br>• 🗺️ <strong>Leaflet + OpenStreetMap</strong> for the map<br>You see the driver move live, with split completed/remaining route lines and rotation-aware markers.'
    },

    /* ============ QR CODES ============ */
    {
      keys: ['qr code', 'qr', 'pickup qr', 'delivery qr', 'how qr works'],
      reply: 'There are <strong>2 QR codes</strong> per donation:<br>• 🍽️ <strong>Pickup QR</strong> — shown by the donor at pickup, scanned by the driver<br>• 🏛️ <strong>Delivery QR</strong> — shown by the receiver at handover, scanned by the driver<br>Both are JSON payloads signed with the donation ID. If the wrong QR is scanned, the driver is warned and the delivery is blocked.'
    },
    {
      keys: ['qr not working', 'qr fail', 'qr scan fail', 'camera not working'],
      reply: 'If QR scanning fails:<br>• 📱 Allow camera access in the browser<br>• 🔆 Brighten the screen to full<br>• 🧼 Clean the camera lens<br>• 📏 Hold steady about 15 cm from the QR<br>• 🔧 Use the "Simulate Scan" button (for demo)<br>The Driver Hub also supports manual scan fallback if the camera is blocked.'
    },
    /* ============ DONOR DASHBOARD ============ */
    {
      keys: ['what is dashboard', 'what does dashboard show', 'donor dashboard', 'dashboard page', 'my dashboard'],
      reply: 'Your <strong>Donor Dashboard</strong> (<a href="donor-dashboard.html">donor-dashboard.html</a>) is your activity overview. It shows:<br>• 👋 A personalized welcome with your name<br>• 🎁 <strong>Total Donations</strong> — every donation you\'ve created<br>• 🍽️ <strong>Meals Donated</strong> — total servings across all donations<br>• 🚚 <strong>Active Donations</strong> — pickups still in progress<br>• ✅ <strong>Completed Donations</strong> — fully delivered<br>• 📦 <strong>Recent Donations</strong> — latest 5 with status badges<br>• 🌱 <strong>My Impact</strong> — meals provided, food waste reduced, contribution %'
    },
    {
      keys: ['how to use dashboard', 'dashboard feature', 'what can i do dashboard', 'dashboard help'],
      reply: 'On your Dashboard you can:<br>• 👀 See live counts of your donations (auto-refreshes every 30 s)<br>• 📦 Click <strong>View →</strong> on any recent donation to jump to its tracking page<br>• ➕ Tap <strong>+ New Donation</strong> to start a new rescue<br>• 📊 Click <strong>View All →</strong> next to Recent Donations to open My Donations<br>• 🌍 Click <strong>Full Impact Report →</strong> to see your environmental footprint'
    },
    {
      keys: ['meals donated', 'active donations', 'completed donations', 'donation stats'],
      reply: 'These are the stat cards on your Dashboard:<br>• 🎁 <strong>Total Donations</strong> — how many donations you\'ve created<br>• 🍽️ <strong>Meals Donated</strong> — total servings you\'ve rescued<br>• 🚚 <strong>Active Donations</strong> — donations still being picked up or delivered<br>• ✅ <strong>Completed Donations</strong> — successfully delivered ones<br>All cards animate with a count-up when you open the page.'

    },

    /* ============ MY DONATIONS PAGE ============ */
    {
      keys: ['what is my donations', 'my donations page', 'what does my donations show', 'donations list'],
      reply: 'The <strong>My Donations</strong> page (<a href="my-donations.html">my-donations.html</a>) is your full donation history. It shows every donation as a card with:<br>• 🖼️ A thumbnail of the food photo<br>• 📛 Food name and current status badge (Pending / In Progress / Completed / Rejected)<br>• ⚖️ Weight, servings, and date<br>• 🏛️ Assigned ashram and driver name<br>• 🆔 Donation ID<br>• 🔘 Action buttons: <strong>View Details</strong>, <strong>📄 Receipt</strong> (completed only), or <strong>🚚 Track</strong> (in progress)'
    },
    {
      keys: ['search donations', 'filter donations', 'find donation', 'how to search my donations'],
      reply: 'On <a href="my-donations.html">My Donations</a> you can:<br>• 🔍 <strong>Search</strong> by food name or category<br>• 🎛️ <strong>Filter by status</strong>: All / Pending / In Progress / Completed / Rejected<br>• 📊 See how many are shown vs total ("Showing X of Y donations")<br>• 🎯 Combine search + filter to narrow down fast<br>• 🔄 The list auto-refreshes every 30 seconds'
    },
    {
      keys: ['view details', 'donation details', 'see donation info', 'donation detail modal'],
      reply: 'Click <strong>View Details</strong> on any donation card in <a href="my-donations.html">My Donations</a> to open a modal with the full breakdown: food name, category, weight, servings, donor, assigned ashram, driver, created date, urgency, and status description. You also get shortcut buttons for actions like downloading a receipt or tracking the delivery.'
    },
    {
      keys: ['how to download receipt', 'download receipt', 'get receipt', 'donation receipt', 'receipt button'],
      reply: 'Receipts are available for <strong>completed deliveries</strong>. Open <a href="my-donations.html">My Donations</a>, find a card with the ✅ <strong>Completed</strong> badge, and click <strong>📄 Receipt</strong>. A styled PDF is generated with your donation ID, food details, donor, receiver, driver, and a QR code linking back to the platform.'
    },
    {
      keys: ['donation status', 'status badges', 'what do statuses mean', 'pending vs in progress'],
      reply: 'Donation status badges on <a href="my-donations.html">My Donations</a>:<br>• 🟡 <strong>Pending</strong> — waiting for a driver to accept<br>• 🔵 <strong>In Progress</strong> — driver on the way or delivering<br>• 🟢 <strong>Completed</strong> — delivered to the ashram<br>• 🔴 <strong>Rejected</strong> — driver rejected at pickup (unsafe food)'
    },
    {
      keys: ['no donations', 'empty donations', 'i dont see donations', 'donations empty'],
      reply: 'If My Donations looks empty, check:<br>• 👤 Are you logged in? Check the user chip in the header<br>• 🎯 Is the filter set to "All"? Try resetting it<br>• 🔍 Is there text in the search box hiding results?<br>• 🔄 Refresh the page — sometimes the backend takes a moment<br>If it\'s still empty, you may not have created any donations yet — click <strong>+ New Donation</strong> to start.'
    },
    {
      keys: ['track from my donations', 'track button', 'how to track from donations'],
      reply: 'For any donation that\'s <strong>In Progress</strong>, click the <strong>🚚 Track</strong> button on its card in <a href="my-donations.html">My Donations</a>. It opens <a href="rescue-track.html#track">Rescue &amp; Track</a> where you\'ll see the driver\'s live location and ETA.'
    },
    /* ============ LEADERBOARD & BADGES ============ */
    {
      keys: ['leaderboard', 'ranking', 'top donor', 'top rescuer', 'rank'],
      reply: 'The <strong>Leaderboard</strong> (<a href="leaderboard.html">leaderboard.html</a>) ranks donors by total food rescued. You can switch between <em>This Month</em> and <em>All Time</em>. The top 3 are highlighted in a podium layout, and you can also see the full table with badges for each donor.'
    },
    {
      keys: ['badge', 'badges', 'achievements', 'medals', 'titles'],
      reply: 'Donors earn badges based on total food rescued:<br>• 🏆 <strong>Food Hero</strong> — 1,000+ KG rescued<br>• 🌿 <strong>Green Champion</strong> — 800+ KG rescued<br>• ⭐ <strong>Consistent Rescuer</strong> — 30+ donations<br>• 🤝 <strong>Community Champion</strong> — multi-ashram support<br>• 🌱 <strong>Rescue Leader</strong> — 500+ KG rescued<br>Badges appear on your <a href="profile.html">profile</a> and the leaderboard.'
    },

    /* ============ IMPACT / CSR ============ */
    {
      keys: ['impact', 'csr', 'co2', 'carbon', 'environment', 'water saved', 'emissions'],
      reply: 'The <strong>Impact &amp; CSR</strong> page (<a href="impact-csr.html">impact-csr.html</a>) shows:<br>• 🍱 Total food rescued (KG)<br>• 🍽️ Meals served<br>• 🌍 CO₂ emissions prevented<br>• 💧 Water equivalent saved<br>• 🗑️ Landfill space saved<br>You can also generate a <strong>printable CSR report</strong> for corporate filings.'
    },
    {
      keys: ['how calculated', 'co2 calculation', 'impact formula', 'how is impact calculated'],
      reply: 'All impact figures are <strong>directional estimates</strong> based on standard food-waste conversion factors from FAO/EPA. Meal counts are derived from food weight using a standard ratio. Every page shows these are estimates so you know they\'re approximate.'
    },
    {
      keys: ['meals per kg', 'how many meals per kg', 'servings vs meals'],
      reply: 'We estimate roughly <strong>1 kg ≈ 2.5 meals</strong> for prepared food, using standard conversion ratios. Actual meals depend on the type of food (a kg of rice feeds more people than a kg of paneer curry) — so it\'s a directional guide, not an exact figure.'
    },

    /* ============ SAFETY ============ */
    {
      keys: ['safe', 'safety', 'hygiene', 'is it safe', 'food safety', 'spoiled', 'spoilage'],
      reply: 'Safety is a top priority:<br>✅ Only freshly-prepared, properly-stored food should be donated<br>✅ Every donation is <strong>physically inspected by the driver</strong> at pickup<br>✅ If the driver rejects the food, the delivery is cancelled immediately<br>✅ AI is only a pre-screen — <strong>never a replacement</strong> for human inspection<br>Never donate spoiled, unsafe, or hours-old food.'
    },
    {
      keys: ['what to check', 'driver check', 'physical inspection', 'driver verify'],
      reply: 'Before accepting a donation, the driver checks:<br>• 👃 Smell — no off odours<br>• 👀 Appearance — colour, texture, no visible spoilage<br>• 📦 Packaging — intact, clean, sealed<br>• 🌡️ Temperature — appropriate for the food type<br>• 🕐 Prep time — within safe window<br>If any of these fail, the driver rejects the food and the mission is cancelled.'
    },

    /* ============ PAGES / NAVIGATION ============ */
    {
      keys: ['what pages', 'site pages', 'all pages', 'list of pages'],
      reply: 'Main pages on FeedFoodForward:<br>• 🏠 Home (<a href="index.html">index.html</a>)<br>• 🍱 Donate Food (<a href="donate-food.html">donate-food.html</a>)<br>• 🤖 AI Inspection (<a href="ai-inspection.html">ai-inspection.html</a>)<br>• 🏠 Find Ashrams (<a href="find-ashrams.html">find-ashrams.html</a>)<br>• 🚚 Rescue &amp; Track (<a href="rescue-track.html">rescue-track.html</a>)<br>• 📦 My Donations (<a href="my-donations.html">my-donations.html</a>)<br>• 📊 Donor Dashboard (<a href="donor-dashboard.html">donor-dashboard.html</a>)<br>• 🏆 Leaderboard (<a href="leaderboard.html">leaderboard.html</a>)<br>• 🌍 Impact &amp; CSR (<a href="impact-csr.html">impact-csr.html</a>)<br>• 👤 Profile (<a href="profile.html">profile.html</a>)<br>• ⚙️ Settings (<a href="settings.html">settings.html</a>)'
    },
    {
      keys: ['donate page', 'where donate', 'open donate'],
      reply: 'Open the Donate Food page here: <a href="donate-food.html">donate-food.html</a> — it has the 5-step wizard to create a new donation.'
    },
    {
      keys: ['my donations', 'my donations page', 'view my donations', 'past donations'],
      reply: 'Your donations page is here: <a href="my-donations.html">my-donations.html</a>. You can search, filter by status (Pending, In Progress, Completed, Rejected), view details, download receipts, and track any in-progress delivery.'
    },
    {
      keys: ['dashboard', 'donor dashboard', 'where is dashboard'],
      reply: 'Your donor dashboard is here: <a href="donor-dashboard.html">donor-dashboard.html</a>. It shows your total donations, meals donated, active donations, completed donations, recent activity, and impact stats.'
    },

    /* ============ RECEIPTS ============ */
    {
      keys: ['receipt', 'download receipt', 'pdf receipt', 'get receipt', 'invoice'],
      reply: 'Receipts are available for <strong>completed deliveries</strong>. Go to <a href="my-donations.html">My Donations</a>, find a completed donation, and click <strong>📄 Receipt</strong>. A styled PDF is generated with your donation details, QR code, and impact summary.'
    },

    /* ============ ACCOUNT / PROFILE ============ */
    {
      keys: ['profile', 'my profile', 'edit profile', 'update profile'],
      reply: 'Open your profile here: <a href="profile.html">profile.html</a>. You can edit your display name, tagline, contact info, and about section. Your achievements and donation history appear there too.'
    },
    {
      keys: ['settings', 'account settings', 'change settings', 'preferences'],
      reply: 'Go to <a href="settings.html">settings.html</a> to manage:<br>• 👤 Account info (name, email, phone, language)<br>• 🔔 Notifications (email, SMS, pickup, delivery, weekly, marketing)<br>• 🔒 Privacy (public profile, location, leaderboard, research)<br>• 🛡️ Security (password, 2FA, active sessions)<br>• 🎨 Appearance (theme, motion, compact mode)'
    },
    {
      keys: ['change password', 'reset password', 'forgot password', 'password'],
      reply: 'To change your password, go to <a href="settings.html">Settings</a> → <strong>Security</strong> → <strong>Change Password</strong>. If you forgot it, click "Forgot password?" on the login modal.'
    },
    {
      keys: ['delete account', 'remove account', 'close account', 'cancel account'],
      reply: 'To delete your account, go to <a href="settings.html">Settings</a> → <strong>Danger Zone</strong> → <strong>Delete Account</strong>. You\'ll be asked to type "DELETE" to confirm. This is permanent — all your data will be removed.'
    },
    {
      keys: ['login', 'sign in', 'how to login', 'log in'],
      reply: 'Click <strong>Login</strong> in the top-right of any page, or use the <a href="index.html?login=1">login modal</a>. Enter your registered email and password. Your role (donor/driver/ashram/admin) determines which dashboard you land on.'
    },
    {
      keys: ['signup', 'sign up', 'register', 'create account', 'new account'],
      reply: 'Click <strong>Sign Up</strong> in the header, or go to <a href="index.html?signup=1">the signup modal</a>. Choose your role (Donor / Ashram / Driver), fill in the role-specific fields, and you\'re in. Admin accounts are created only by the platform owner.'
    },
    {
      keys: ['logout', 'log out', 'sign out'],
      reply: 'To log out, click your avatar in the top-right → <strong>🚪 Logout</strong>, or use the logout button in the sidebar. You\'ll be redirected to the homepage.'
    },

    /* ============ TROUBLESHOOTING ============ */
    {
      keys: ['image not uploading', 'upload failed', 'cant upload', 'image error'],
      reply: 'If image upload fails:<br>• ✅ Use JPG, PNG, or WEBP<br>• ✅ Keep file under 5 MB<br>• ✅ Refresh the page and try again<br>• ✅ Try a different browser<br>• ✅ Make sure JavaScript is enabled'
    },
    {
      keys: ['map not loading', 'map broken', 'map error', 'map blank'],
      reply: 'If the map doesn\'t load:<br>• 🌐 Check your internet connection<br>• 🚫 Disable ad-blockers temporarily<br>• 🔄 Reload the page<br>• 🧭 Try a different browser<br>Maps use OpenStreetMap + Leaflet, so a slow connection can delay tile loading.'
    },
    {
      keys: ['no driver', 'driver not assigned', 'no pickup', 'nobody accepted'],
      reply: 'Driver matching is automatic and usually takes <strong>5–10 minutes</strong>. If no driver accepts:<br>• 📍 Verify your pickup address is correct<br>• ⏱️ Wait a bit longer — matching is real-time<br>• ⚠️ Report an issue from the tracking page if it\'s been over 30 min'
    },
    {
      keys: ['delivery delayed', 'late delivery', 'driver late', 'where is my food'],
      reply: 'If your delivery is delayed, open <a href="rescue-track.html#track">Rescue &amp; Track</a> and check:<br>• 🗺️ Driver\'s live position<br>• ⏱️ Updated ETA<br>• 💬 Message the driver (if chat enabled)<br>You can also click <strong>⚠️ Report an issue</strong> — our team monitors reported issues and will reach out.'
    },
    {
      keys: ['driver rejected', 'food rejected', 'pickup failed', 'rejected at pickup'],
      reply: 'If the driver rejected the food, the mission is cancelled and the donation appears as "Rejected" in <a href="my-donations.html">My Donations</a>. Common reasons are quality, safety, or temperature issues. No penalty is applied — just re-inspect the food before re-donating.'
    },
    {
      keys: ['issue', 'report issue', 'problem', 'complain', 'report a bug'],
      reply: 'You can report issues two ways:<br>• ⚠️ <strong>Delivery issue</strong> — click "Report an Issue" on the tracking page<br>• 💬 <strong>Platform feedback</strong> — go to <a href="feedback.html">feedback.html</a><br>Our team reviews reports daily and reaches out within 24 hours.'
    },

    /* ============ FEEDBACK ============ */
    {
      keys: ['feedback', 'give feedback', 'rate us', 'review', 'suggestion', 'feature request'],
      reply: 'We love feedback! Go to <a href="feedback.html">feedback.html</a>. You can:<br>• 🐛 Report a bug<br>• 💡 Request a feature<br>• ⚡ Suggest an improvement<br>• ❤️ Leave a compliment<br>• ⭐ Rate the platform 1–5 stars'
    },

    /* ============ LOCATION / CITIES ============ */
    {
      keys: ['which cities', 'cities covered', 'where do you operate', 'location coverage', 'available in'],
      reply: 'FeedFoodForward currently covers <strong>Mumbai and surrounding areas</strong> with 149 ashrams & NGOs. The dataset includes data from other Indian cities (Pune, Nagpur, Nashik, Bengaluru, Delhi, Chennai, Hyderabad, Kolkata, Ahmedabad) via OpenStreetMap integration, ready to be enabled.'
    },

    /* ============ DATA / TECH ============ */
    {
      keys: ['how do you get data', 'where is data from', 'data source', 'osm'],
      reply: 'Ashram and receiver data is sourced from <strong>OpenStreetMap (Overpass API)</strong>, then geocoded via <strong>Nominatim</strong> and stored in <strong>MongoDB</strong> with geospatial indexing. Donor restaurant data comes from OSM too. This ensures accurate locations and distance-based matching.'
    },
    {
      keys: ['technology', 'tech stack', 'built with', 'how built'],
      reply: 'FeedFoodForward is built with:<br>• 🖥️ <strong>Node.js + Express</strong> backend<br>• 🗄️ <strong>MongoDB</strong> with geospatial indexing<br>• 🤖 <strong>Google Gemini AI</strong> for vision inspection<br>• 🗺️ <strong>Leaflet + OpenStreetMap</strong> for maps<br>• 📍 <strong>Nominatim + OSRM</strong> for geocoding & routing<br>• 🔌 <strong>Socket.IO</strong> for real-time tracking<br>• 📄 <strong>html2pdf.js</strong> for receipt generation'
    },

    /* ============ CONTACT / SUPPORT ============ */
    {
      keys: ['contact', 'support', 'help', 'email', 'phone', 'talk to human', 'customer care'],
      reply: 'Reach out to us at:<br>• ✉️ <strong>support@feedfoodforward.demo</strong><br>• 📞 <strong>+91 98123 45678</strong><br>• 💬 Or use the <a href="feedback.html">feedback form</a><br>We usually reply within a day.'
    },
    {
      keys: ['help page', 'help and support', 'getting started', 'guide'],
      reply: 'Our <strong>Getting Started</strong> guide walks you through the 5-step donation flow, common troubleshooting, and contact options. Open it here: <a href="help.html">help.html</a>.'
    },

    /* ============ LEGAL / PRIVACY ============ */
    {
      keys: ['privacy', 'data privacy', 'my data', 'gdpr', 'data usage'],
      reply: 'Your privacy is respected. You control:<br>• Whether your profile is public<br>• Whether your live location is shared (only during active pickups)<br>• Whether you appear on the leaderboard<br>• Whether your data is used for research<br>Manage these in <a href="settings.html">Settings → Privacy</a>.'
    },
    {
      keys: ['terms', 'conditions', 'terms of use'],
      reply: 'By using FeedFoodForward you agree to donate only safe, freshly-prepared food and to keep pickup windows accurate. Full terms are being finalized for the production launch. For questions, email support@feedfoodforward.demo.'
    }
  ];

  /* ---------- 5. Smart reply matcher ---------- */
  function getReply(q) {
    const text = (q || '').toLowerCase().trim();
    if (!text) return 'Ask me anything about FeedFoodForward!';

    /* Score every KB entry by how many keywords it matches */
    let best = null;
    let bestScore = 0;

    for (const item of KB) {
      let score = 0;
      for (const k of item.keys) {
        if (text.includes(k)) {
          /* Longer keyword = more specific = higher weight */
          score += k.length;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        best = item;
      }
    }

    if (best && bestScore > 0) return best.reply;

    return 'I\'m not sure about that one. Try asking about <strong>donating food</strong>, <strong>AI inspection</strong>, <strong>tracking deliveries</strong>, <strong>finding ashrams</strong>, <strong>your role</strong>, or type <strong>"help"</strong> for support options.';
  }

  /* ---------- 6. Message rendering ---------- */
  function addMessage(text, who) {
    const div = document.createElement('div');
    div.className = 'ff-chat-msg ' + who;
    div.innerHTML = who === 'bot'
      ? '<div class="ff-chat-msg-avatar">🤖</div><div class="ff-chat-msg-bubble">' + text + '</div>'
      : '<div class="ff-chat-msg-bubble">' + text + '</div>';
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  function addTyping() {
    const div = document.createElement('div');
    div.className = 'ff-chat-msg bot ff-chat-typing-row';
    div.id = 'ff-chat-typing';
    div.innerHTML = `
      <div class="ff-chat-msg-avatar">🤖</div>
      <div class="ff-chat-msg-bubble ff-chat-typing">
        <span></span><span></span><span></span>
      </div>`;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }
  function removeTyping() {
    const t = document.getElementById('ff-chat-typing');
    if (t) t.remove();
  }

  /* ---------- 7. Send flow with Gemini + local fallback ---------- */
  const conversation = [];

  async function sendMessage(text) {
    const q = (text || '').trim();
    if (!q) return;

    addMessage(escapeHtml(q), 'user');
    input.value = '';
    addTyping();

    conversation.push({ role: 'user', text: q });
    if (conversation.length > 8) conversation.splice(0, conversation.length - 8);

    /* Try backend Gemini first */
    let reply = null;
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: q,
          history: conversation.slice(0, -1)
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.reply) reply = data.reply;
      }
    } catch (e) {
      console.warn('Chat backend unreachable, using local KB:', e);
    }

    const delay = 450 + Math.random() * 400;
    setTimeout(() => {
      removeTyping();
      const finalReply = reply || getReply(q);
      addMessage(finalReply, 'bot');
      conversation.push({ role: 'bot', text: stripHtml(finalReply) });
      if (conversation.length > 8) conversation.splice(0, conversation.length - 8);
    }, delay);
  }

  function stripHtml(s) {
    return String(s || '').replace(/<[^>]*>/g, '');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  /* ---------- 8. Events ---------- */
  toggle.addEventListener('click', () => {
    const isOpen = !panel.hidden;
    panel.hidden = isOpen;
    toggle.classList.toggle('is-open', !isOpen);
    wrap.classList.toggle('is-open', !isOpen);

    if (!isOpen) {
      badge.style.display = 'none';
      if (!messages.dataset.greeted) {
        messages.dataset.greeted = '1';
        addTyping();
        setTimeout(() => {
          removeTyping();
          addMessage(
            'Hi! 👋 I\'m your FeedFoodForward assistant. I can help with <strong>donating food</strong>, <strong>AI inspection</strong>, <strong>tracking deliveries</strong>, <strong>finding ashrams</strong>, <strong>your role</strong>, and more. What would you like to know?',
            'bot'
          );
        }, 700);
      }
      setTimeout(() => input.focus(), 200);
    }
  });

  closeBtn.addEventListener('click', () => {
    panel.hidden = true;
    toggle.classList.remove('is-open');
    wrap.classList.remove('is-open');
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage(input.value);
  });

  quickRow.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-q]');
    if (!btn) return;
    sendMessage(btn.dataset.q);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) {
      panel.hidden = true;
      toggle.classList.remove('is-open');
      wrap.classList.remove('is-open');
    }
  });

  /* Expose opener for external buttons (like the Getting Started page) */
  window.ffOpenChatbot = function () {
    if (!panel.hidden) {
      panel.scrollIntoView({ behavior: 'smooth', block: 'end' });
      return;
    }
    toggle.click();
  };

  /* ---------- 9. First-time nudge ---------- */
  setTimeout(() => {
    if (badge) badge.style.display = 'flex';
  }, 1500);

})();