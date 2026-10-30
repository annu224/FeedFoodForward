const { useState, useEffect, useRef } = React;

/* ==================================================================
   FOOD DETECTION — canvas pixel heuristic
   ================================================================== */
function detectFoodFromImage(imageSrc) {
  return new Promise((resolve) => {
    if (!imageSrc) {
      return resolve({ isFood: false, confidence: 0, foodScore: 0, reason: 'no-image' });
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const SIZE = 64;
        const canvas = document.createElement('canvas');
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, SIZE, SIZE);

        const data = ctx.getImageData(0, 0, SIZE, SIZE).data;
        const total = SIZE * SIZE;

        let sumR = 0, sumG = 0, sumB = 0;
        let warmPixels = 0, saturatedPixels = 0, veryDarkPixels = 0, veryBrightPixels = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          sumR += r; sumG += g; sumB += b;

          if (r - b > 20 && r > 70) warmPixels++;

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          if (max - min > 40) saturatedPixels++;

          const brightness = (r + g + b) / 3;
          if (brightness < 30) veryDarkPixels++;
          if (brightness > 240) veryBrightPixels++;
        }

        const avgR = sumR / total;
        const avgG = sumG / total;
        const avgB = sumB / total;
        const avgBrightness = (avgR + avgG + avgB) / 3;

        const warmthRatio     = warmPixels / total;
        const saturationRatio = saturatedPixels / total;
        const darkRatio       = veryDarkPixels / total;
        const brightRatio     = veryBrightPixels / total;

        let score = 0;
        const warmthDelta = avgR - avgB;

        if (warmthDelta > 25)       score += 30;
        else if (warmthDelta > 10)  score += 18;
        else if (warmthDelta > 0)   score += 8;
        else if (warmthDelta < -25) score -= 15;

        if (warmthRatio > 0.5)       score += 25;
        else if (warmthRatio > 0.3)  score += 15;
        else if (warmthRatio > 0.15) score += 5;

        if (saturationRatio > 0.4)       score += 25;
        else if (saturationRatio > 0.25) score += 15;
        else if (saturationRatio > 0.1)  score += 5;

        if (avgBrightness > 50 && avgBrightness < 230)      score += 15;
        else if (avgBrightness > 30 && avgBrightness < 245) score += 5;

        if (darkRatio > 0.5)   score -= 20;
        if (brightRatio > 0.5) score -= 15;

        score = Math.max(0, Math.min(100, score));
        const isFood = score >= 45;
        const confidence = Math.round(
          isFood ? 65 + (score - 45) * 0.9 : 60 + (45 - score) * 0.8
        );

        resolve({
          isFood,
          confidence: Math.min(98, confidence),
          foodScore: score
        });
      } catch (err) {
        console.warn('Food detection failed:', err);
        resolve({ isFood: true, confidence: 75, foodScore: 55, fallback: true });
      }
    };

    img.onerror = () => {
      resolve({ isFood: true, confidence: 75, foodScore: 55, fallback: true });
    };

    img.src = imageSrc;
  });
}

/* ==================================================================
   FOOD ANALYSIS — deterministic based on image hash
   ================================================================== */
function generateFoodAnalysis(imageSrc, details = {}) {
  let hash = 0;
  const sample = (imageSrc || '').slice(0, 2000) + (imageSrc || '').slice(-2000);
  for (let i = 0; i < sample.length; i++) {
    hash = ((hash << 5) - hash) + sample.charCodeAt(i);
    hash = hash & hash;
  }
  const seed = Math.abs(hash) || 12345;
  const rng = (min, max, offset) => min + ((seed * (offset + 13)) % (max - min + 1));

  const FOOD_TYPES = [
    { name: 'Prepared Vegetarian Meal', items: ['Roti', 'Vegetable Curry', 'Dal'] },
    { name: 'Bakery & Bread Items',     items: ['Sourdough', 'Croissant', 'Bun'] },
    { name: 'Fresh Fruit & Produce',    items: ['Apple', 'Banana', 'Orange'] },
    { name: 'Cooked Rice & Curries',    items: ['Rice', 'Paneer Curry', 'Raita'] },
    { name: 'Mixed Snacks & Sweets',    items: ['Samosa', 'Laddu', 'Cookie'] }
  ];

  const pick = FOOD_TYPES[seed % FOOD_TYPES.length];
  const confidence = rng(88, 98, 1);
  const freshness  = rng(72, 96, 2);
  const items = pick.items.map((item, i) => ({
    name: item,
    confidence: rng(85, 97, 3 + i)
  }));

  let condition, conditionColor, spoilage;
  if (freshness >= 88)      { condition = 'Excellent';        conditionColor = '🟢'; spoilage = false; }
  else if (freshness >= 78) { condition = 'Good';             conditionColor = '🟢'; spoilage = false; }
  else if (freshness >= 68) { condition = 'Moderately Fresh'; conditionColor = '🟡'; spoilage = true;  }
  else                      { condition = 'Needs Review';     conditionColor = '🟡'; spoilage = true;  }

  let suitability, suitabilityText, recommendation;
  if (freshness >= 85) {
    suitability = 'RECOMMENDED';
    suitabilityText = 'Food appears suitable for donation based on visual inspection.';
    recommendation = 'HIGH';
  } else if (freshness >= 75) {
    suitability = 'RECOMMENDED';
    suitabilityText = 'Food appears suitable, but prioritize quick pickup.';
    recommendation = 'MEDIUM';
  } else {
    suitability = 'MANUAL INSPECTION RECOMMENDED';
    suitabilityText = 'Some visual indicators suggest manual verification before donation.';
    recommendation = 'HIGH';
  }

  return {
    foodName: details.foodName || pick.name,
    confidence,
    freshness,
    condition,
    conditionColor,
    spoilage,
    items,
    suitability,
    suitabilityText,
    recommendation,
    quantity: details.weightKg ? `${details.weightKg} kg` : '—',
    servings: details.servings || '—'
  };
}

/* ==================================================================
   DEMO DATA
   ================================================================== */
const DEMO_DONATIONS = [
  {
    id: 'FF-DON-98241',
    foodName: 'Prepared Vegetarian Meals (Paneer, Rice & Dal)',
    category: 'Prepared Meals',
    weightKg: 45,
    servings: 120,
    donorName: 'Hotel Green Leaf',
    ashramName: 'Shanti Vruddhashram',
    driverName: 'Rajesh Kumar (EV Van)',
    status: 'In Transit',
    matchScore: 96,
    urgency: 'HIGH',
    imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'FF-DON-98242',
    foodName: 'Fresh Baked Bread & Croissants',
    category: 'Bakery',
    weightKg: 20,
    servings: 60,
    donorName: 'Urban Artisan Bakery',
    ashramName: 'Anand Seva Anath Ashram',
    driverName: 'Priya Sharma (Three-Wheeler EV)',
    status: 'Picked Up',
    matchScore: 92,
    urgency: 'MEDIUM',
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80'
  }
];

const DEMO_ASHRAMS = [
  {
    id: 'ashram-01',
    name: 'Shanti Vruddhashram',
    type: 'Vruddhashram',
    residents: 85,
    currentNeed: '60 hot meals before 8:30 PM',
    address: '15 Seva Ashram Lane, Jayanagar, Bengaluru',
    distanceKm: 2.4, lat: 12.9250, lng: 77.5938,
    img: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'ashram-02',
    name: 'Anand Seva Anath Ashram',
    type: 'Anath Ashram',
    residents: 120,
    currentNeed: '100 meals or bakery items',
    address: '88 Children Park Road, BTM Layout, Bengaluru',
    distanceKm: 3.8, lat: 12.9165, lng: 77.6101,
    img: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=600&auto=format&fit=crop&q=80'
  }
];

/* ★ CHANGED — Rescue Map + Track Delivery merged into one entry */
const OTHER_PAGES = [
  { href: 'index.html',         label: 'Home' },
  { href: 'donate-food.html',   label: 'Donate Food' },
  { href: 'ai-inspection.html', label: 'AI Inspection' },
  { href: 'rescue-track.html',  label: 'Rescue & Track' },
  { href: 'find-ashrams.html',  label: 'Find Ashrams' },
  { href: 'driver-hub.html',    label: 'Driver Hub' },
  { href: 'leaderboard.html',   label: 'Leaderboard' },
  { href: 'impact-csr.html',    label: 'Impact & CSR' },
  { href: 'admin-portal.html',  label: 'Admin Portal' },
  { href: 'profile.html',       label: 'Profile' }
];

const DEMO_IMAGE = 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&auto=format&fit=crop&q=80';

/* ==================================================================
   APP
   ================================================================== */
function App() {
  const [view, setView] = useState('home');
  const [userRole, setUserRole] = useState('donor');
  const [donations, setDonations] = useState(DEMO_DONATIONS);
  const [selectedDonation, setSelectedDonation] = useState(DEMO_DONATIONS[0]);

  /* ★ ADDED — internal tab for the merged Rescue & Track view */
  const [rescueTab, setRescueTab] = useState('map'); // 'map' | 'track'

  const [wizardStep, setWizardStep] = useState(1);
  const [foodName, setFoodName] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [servings, setServings] = useState('');

  const [uploadedImage, setUploadedImage] = useState(null);
  const [aiState, setAiState] = useState('idle');
  const [aiResult, setAiResult] = useState(null);
  const [aiDetection, setAiDetection] = useState(null);

  const [aiViewImage, setAiViewImage] = useState(null);
  const [aiViewState, setAiViewState] = useState('idle');
  const [aiViewResult, setAiViewResult] = useState(null);
  const [aiViewDetection, setAiViewDetection] = useState(null);

  const wizardFileRef = useRef(null);
  const aiViewFileRef = useRef(null);

  const [showQrModal, setShowQrModal] = useState(false);
  const [qrType, setQrType] = useState('pickup');
  const [toast, setToast] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  };

  /* ★ CHANGED — Map now lives inside the merged 'rescue' view and only
     initialises when the map tab is active. Re-runs on tab switch so
     the map re-mounts cleanly (fresh DOM node = no stale Leaflet id). */
  useEffect(() => {
    if (view !== 'rescue') return;
    const t = setTimeout(() => {
      const mapContainer = document.getElementById('map');
      if (mapContainer && !mapContainer._leaflet_id) {
        const map = L.map('map').setView([12.9550, 77.6100], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap'
        }).addTo(map);
        L.marker([12.9716, 77.6412]).addTo(map).bindPopup('<b>🏨 Hotel Green Leaf</b><br>45 KG Prepared Food');
        L.marker([12.9250, 77.5938]).addTo(map).bindPopup('<b>👵 Shanti Vruddhashram</b><br>Needs 60 Meals');
        L.marker([12.9550, 77.6100]).addTo(map).bindPopup('<b>🚚 Rajesh Kumar (EV Van)</b><br>ETA 8 mins en route');
        L.polyline([[12.9716, 77.6412], [12.9550, 77.6100], [12.9250, 77.5938]], {
          color: '#10b981', weight: 4, dashArray: '8, 8'
        }).addTo(map);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [view, rescueTab]);

  const readFileAsDataURL = (file, onDone) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      showToast('⚠️ Please choose a JPG, PNG, or WEBP image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => onDone(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleWizardUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    readFileAsDataURL(file, (dataUrl) => {
      setUploadedImage(dataUrl);
      setAiState('idle');
      setAiResult(null);
      setAiDetection(null);
      showToast('📷 Image uploaded.');
    });
  };

  const loadWizardDemoImage = () => {
    setUploadedImage(DEMO_IMAGE);
    setAiState('idle');
    setAiResult(null);
    setAiDetection(null);
    showToast('📷 Demo image loaded.');
  };

  const handleAiViewUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    readFileAsDataURL(file, (dataUrl) => {
      setAiViewImage(dataUrl);
      setAiViewState('idle');
      setAiViewResult(null);
      setAiViewDetection(null);
      showToast('📷 Image uploaded.');
    });
  };

  const loadAiViewDemoImage = () => {
    setAiViewImage(DEMO_IMAGE);
    setAiViewState('idle');
    setAiViewResult(null);
    setAiViewDetection(null);
    showToast('📷 Demo image loaded.');
  };

  const runWizardAiDetection = async () => {
    if (!uploadedImage) {
      showToast('⚠️ Please upload a food image first.');
      return;
    }

    setWizardStep(3);
    setAiState('analyzing');
    setAiResult(null);
    setAiDetection(null);

    const detection = await detectFoodFromImage(uploadedImage);
    await new Promise((r) => setTimeout(r, 1500));

    setAiDetection(detection);

    if (!detection.isFood) {
      setAiState('no-food');
      showToast('❌ No food detected in this image.');
      return;
    }

    const analysis = generateFoodAnalysis(uploadedImage, {
      foodName: foodName || undefined,
      weightKg,
      servings
    });
    setAiResult(analysis);
    setAiState('food');
    showToast('✅ AI analysis complete.');
  };

  const runAiViewDetection = async () => {
    if (!aiViewImage) {
      showToast('⚠️ Please upload a food image first.');
      return;
    }

    setAiViewState('analyzing');
    setAiViewResult(null);
    setAiViewDetection(null);

    const detection = await detectFoodFromImage(aiViewImage);
    await new Promise((r) => setTimeout(r, 1500));

    setAiViewDetection(detection);

    if (!detection.isFood) {
      setAiViewState('no-food');
      showToast('❌ No food detected in this image.');
      return;
    }

    const analysis = generateFoodAnalysis(aiViewImage, {});
    setAiViewResult(analysis);
    setAiViewState('food');
    showToast('✅ AI analysis complete.');
  };

  const handleCreateDonation = () => {
    const newObj = {
      id: `FF-DON-${Math.floor(10000 + Math.random() * 90000)}`,
      foodName: foodName || (aiResult && aiResult.foodName) || 'Prepared Meal',
      category: 'Prepared Meals',
      weightKg: Number(weightKg) || 5,
      servings: Number(servings) || 20,
      donorName: 'Hotel Green Leaf',
      ashramName: 'Shanti Vruddhashram',
      driverName: 'Rajesh Kumar (EV Cargo)',
      status: 'In Transit',
      matchScore: 96,
      urgency: 'HIGH',
      imageUrl: uploadedImage || DEMO_IMAGE
    };
    setDonations([newObj, ...donations]);
    setSelectedDonation(newObj);
    showToast('✅ Donation created — redirecting to tracking.');
    /* ★ CHANGED — merged rescue view + jump to the Tracking tab */
    setView('rescue');
    setRescueTab('track');
  };

  const resetWizard = () => {
    setWizardStep(1);
    setFoodName('');
    setWeightKg('');
    setServings('');
    setUploadedImage(null);
    setAiState('idle');
    setAiResult(null);
    setAiDetection(null);
    showToast('↺ Wizard reset.');
  };

  /* ★ CHANGED — 'map' + 'tracking' collapsed into one 'rescue' entry */
  const NAV_ITEMS = [
    { key: 'home',    label: 'Home' },
    { key: 'wizard',  label: 'Donate Food' },
    { key: 'ai',      label: 'AI Inspection' },
    { key: 'rescue',  label: 'Rescue & Track' },
    { key: 'ashrams', label: 'Find Ashrams' },
    { key: 'driver',  label: 'Driver Portal' },
    { key: 'impact',  label: 'Impact & CSR' },
    { key: 'admin',   label: 'Admin' }
  ];

  return (
    <div className="min-h-screen flex flex-col">

      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div onClick={() => setView('home')} className="flex items-center space-x-2.5 cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-800 to-emerald-400 flex items-center justify-center text-white font-extrabold shadow">❤️</div>
            <div>
              <span className="font-extrabold text-xl tracking-tight text-slate-900 font-display">
                FeedFood<span className="text-brand-600">Forward</span>
              </span>
              <span className="block text-[9px] uppercase tracking-widest text-brand-700 font-bold -mt-1">
                AI Food Redistribution
              </span>
            </div>
          </div>

          <nav className="hidden lg:flex items-center space-x-1 text-xs font-semibold">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                className={`px-3.5 py-2 rounded-lg transition ${
                  view === item.key
                    ? 'bg-brand-600 text-white font-bold shadow hover:bg-brand-700'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center space-x-2">
            <select value={userRole} onChange={(e) => setUserRole(e.target.value)}
              className="text-xs font-bold bg-slate-100 border border-slate-300 rounded-xl px-3 py-1.5 text-slate-800">
              <option value="donor">🏨 Donor View</option>
              <option value="ashram">👵 Ashram View</option>
              <option value="driver">🚚 Driver View</option>
              <option value="admin">⚡ Admin View</option>
            </select>
          </div>
        </div>

        <div className="bg-slate-100 border-t border-slate-200">
          <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold">
            <span className="text-slate-500 uppercase tracking-wider">Other Pages:</span>
            {OTHER_PAGES.map(p => (
              <a key={p.href} href={p.href} className="text-brand-700 hover:text-brand-900 hover:underline">
                {p.label}
              </a>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1">

        {view === 'home' && (
          <div>
            <section className="bg-slate-900 text-white py-16 px-4">
              <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-7 space-y-6">
                  <span className="inline-block text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                    ⚡ AI-Powered Food Redistribution Network
                  </span>
                  <h1 className="text-4xl sm:text-6xl font-extrabold font-display leading-tight">
                    Rescue Food.<br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-200">Reduce Waste.</span><br />
                    Feed Communities.
                  </h1>
                  <p className="text-slate-300 text-base max-w-xl">
                    FeedFoodForward connects surplus food from hotels, restaurants, cafes, and events with nearby Anath Ashrams, Vruddhashrams, and NGOs — powered by AI visual quality inspection and live GPS tracking.
                  </p>
                  <div className="flex flex-wrap gap-3 pt-2">
                    <button onClick={() => setView('wizard')} className="px-6 py-3.5 bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs rounded-xl shadow-xl">
                      Donate Surplus Food Now
                    </button>
                    {/* ★ CHANGED — jump straight to the map tab of the merged view */}
                    <button
                      onClick={() => { setView('rescue'); setRescueTab('map'); }}
                      className="px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700"
                    >
                      Explore Rescue Map
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-5 bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-2xl space-y-4">
                  <div className="text-xs font-mono text-emerald-400 font-bold flex justify-between border-b border-slate-700 pb-2">
                    <span>PIPELINE PREVIEW</span>
                    <span>LIVE GPS ACTIVE</span>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-white">Hotel Green Leaf</div>
                      <div className="text-[10px] text-slate-400">45 KG Prepared Food</div>
                    </div>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded">UPLOADING</span>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-white">AI Inspection Engine</div>
                      <div className="text-[10px] text-slate-400">94% Visual Freshness Score</div>
                    </div>
                    <span className="text-[10px] bg-sky-500/20 text-sky-400 font-bold px-2 py-0.5 rounded">ANALYZED</span>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-white">Shanti Vruddhashram</div>
                      <div className="text-[10px] text-slate-400">85 Residents • 120 Servings</div>
                    </div>
                    <span className="text-[10px] bg-purple-500/20 text-purple-400 font-bold px-2 py-0.5 rounded">96% MATCH</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="py-10 bg-white border-b border-slate-200">
              <div className="max-w-6xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="p-4 bg-brand-50 rounded-2xl">
                  <div className="text-3xl font-extrabold text-brand-700">1,420 KG</div>
                  <div className="text-xs text-slate-600 font-semibold mt-1">Food Rescued</div>
                </div>
                <div className="p-4 bg-emerald-50 rounded-2xl">
                  <div className="text-3xl font-extrabold text-emerald-700">3,570+</div>
                  <div className="text-xs text-slate-600 font-semibold mt-1">Meals Delivered</div>
                </div>
                <div className="p-4 bg-sky-50 rounded-2xl">
                  <div className="text-3xl font-extrabold text-sky-700">48+</div>
                  <div className="text-xs text-slate-600 font-semibold mt-1">Active Donors</div>
                </div>
                <div className="p-4 bg-purple-50 rounded-2xl">
                  <div className="text-3xl font-extrabold text-purple-700">14</div>
                  <div className="text-xs text-slate-600 font-semibold mt-1">Connected Ashrams</div>
                </div>
              </div>
            </section>
          </div>
        )}

        {view === 'wizard' && (
          <div className="py-10 px-4 max-w-3xl mx-auto space-y-6">
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-extrabold text-slate-900">5-Step Food Rescue Wizard</h1>
              <p className="text-xs text-slate-500">List surplus food, run AI inspection, and match with nearby Ashrams.</p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
              <div className="flex justify-between text-xs font-bold border-b pb-3">
                <span className={wizardStep === 1 ? 'text-brand-600 font-extrabold' : 'text-slate-400'}>1. Photo</span>
                <span className={wizardStep === 2 ? 'text-brand-600 font-extrabold' : 'text-slate-400'}>2. Details</span>
                <span className={wizardStep === 3 ? 'text-brand-600 font-extrabold' : 'text-slate-400'}>3. AI Analysis</span>
                <span className={wizardStep === 4 ? 'text-brand-600 font-extrabold' : 'text-slate-400'}>4. Matching</span>
                <span className={wizardStep === 5 ? 'text-brand-600 font-extrabold' : 'text-slate-400'}>5. Confirm</span>
              </div>

              {wizardStep === 1 && (
                <div className="space-y-4 text-center">
                  {uploadedImage ? (
                    <img src={uploadedImage} alt="Food preview" className="w-64 h-44 object-cover rounded-2xl mx-auto shadow border border-slate-200" />
                  ) : (
                    <div className="w-64 h-44 rounded-2xl mx-auto border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-slate-400">
                      <div className="text-3xl mb-1">📷</div>
                      <div className="text-xs font-semibold">No image yet</div>
                    </div>
                  )}
                  <input ref={wizardFileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleWizardUpload} className="hidden" />
                  <div className="flex flex-wrap justify-center gap-2 pt-1">
                    <button onClick={() => wizardFileRef.current && wizardFileRef.current.click()} className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl shadow">
                      📷 {uploadedImage ? 'Change Image' : 'Choose Image'}
                    </button>
                    <button onClick={loadWizardDemoImage} className="px-4 py-2 bg-white border border-slate-300 text-slate-800 font-bold text-xs rounded-xl">
                      Or Use Demo Image
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      if (!uploadedImage) {
                        showToast('⚠️ Please upload a food image first.');
                        return;
                      }
                      setWizardStep(2);
                    }}
                    className="w-full py-3 bg-brand-600 text-white font-bold text-xs rounded-xl shadow mt-2"
                  >
                    Proceed to Food Details →
                  </button>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold block mb-1">Food Description</label>
                    <input type="text" value={foodName} onChange={(e) => setFoodName(e.target.value)} placeholder="e.g. Prepared Vegetarian Meal" className="w-full p-2.5 border rounded-xl" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold block mb-1">Weight (KG)</label>
                      <input type="number" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="e.g. 5" className="w-full p-2.5 border rounded-xl" />
                    </div>
                    <div>
                      <label className="font-bold block mb-1">Servings</label>
                      <input type="number" value={servings} onChange={(e) => setServings(e.target.value)} placeholder="e.g. 20" className="w-full p-2.5 border rounded-xl" />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 italic">Note: the AI does not guess weight or servings — you provide them.</p>
                  <button onClick={runWizardAiDetection} className="w-full py-3 bg-brand-600 text-white font-bold text-xs rounded-xl shadow mt-2">
                    🤖 Run AI Visual Inspection →
                  </button>
                  <button onClick={() => setWizardStep(1)} className="w-full py-2 text-slate-500 hover:text-slate-800 font-bold text-[11px]">
                    ← Back to Image
                  </button>
                </div>
              )}

              {wizardStep === 3 && (
                <div className="space-y-4 text-xs">
                  {aiState === 'analyzing' && (
                    <div className="text-center py-10 space-y-3">
                      <div className="w-12 h-12 border-4 border-slate-200 border-t-brand-600 rounded-full mx-auto animate-spin"></div>
                      <div className="font-bold text-slate-800">🤖 Analyzing image…</div>
                      <div className="text-slate-500">Running food detection, freshness check, and suitability.</div>
                    </div>
                  )}

                  {aiState === 'no-food' && (
                    <div className="p-6 bg-red-50 border-2 border-red-200 rounded-2xl text-center space-y-3">
                      <div className="text-5xl">🚫</div>
                      <div className="text-lg font-extrabold text-red-800">No Food Detected</div>
                      <p className="text-red-900 text-xs max-w-md mx-auto">
                        The uploaded image does not appear to contain food. Please upload a clear photo of the food you want to donate.
                      </p>
                      <div className="inline-flex items-center gap-2 bg-white border border-red-200 px-3 py-1.5 rounded-lg text-[11px] font-bold text-red-800">
                        <span>Detection confidence:</span>
                        <span>{aiDetection ? aiDetection.confidence + '%' : '—'}</span>
                      </div>
                      <div className="pt-2">
                        <button
                          onClick={() => {
                            setUploadedImage(null);
                            setAiState('idle');
                            setAiDetection(null);
                            setWizardStep(1);
                          }}
                          className="px-4 py-2 bg-brand-600 text-white font-bold rounded-xl"
                        >
                          ← Upload a Different Image
                        </button>
                      </div>
                    </div>
                  )}

                  {aiState === 'food' && aiResult && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 relative">
                          <img src={uploadedImage} alt="Inspected food" className="w-full h-48 object-cover" />
                          <div className="absolute top-2 left-2 bg-brand-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                            {aiResult.items[0] ? `${aiResult.items[0].name} ${aiResult.items[0].confidence}%` : 'Food'}
                          </div>
                          <div className="absolute bottom-2 right-2 bg-brand-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                            Grade A
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="p-3 bg-white rounded-2xl border border-slate-200 border-l-4 border-l-brand-600">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">🤖 AI Analysis</div>
                            <div className="flex justify-between mb-1"><span className="text-slate-600">Food Detected</span><span className="font-bold">{aiResult.foodName}</span></div>
                            <div className="flex justify-between mb-1"><span className="text-slate-600">Confidence</span><span className="font-bold text-brand-600">{aiResult.confidence}%</span></div>
                          </div>

                          <div className="p-3 bg-white rounded-2xl border border-slate-200">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">🌿 Freshness</div>
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-2xl font-extrabold text-brand-600">{aiResult.freshness}</span>
                              <div className="flex-1 h-2 bg-slate-200 rounded overflow-hidden">
                                <div className="h-full bg-brand-600" style={{ width: `${aiResult.freshness}%` }}></div>
                              </div>
                            </div>
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-600">Condition</span>
                              <span className="font-bold text-brand-700">{aiResult.conditionColor} {aiResult.condition}</span>
                            </div>
                            <div className="flex justify-between text-[11px] mt-1">
                              <span className="text-slate-600">Visible Spoilage</span>
                              <span className="font-bold text-brand-700">{aiResult.spoilage ? '⚠️ Possible damage' : '🟢 Not detected'}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="p-3 bg-white rounded-2xl border border-slate-200">
                          <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">📦 Quantity</div>
                          <div className="text-lg font-extrabold text-slate-900">{aiResult.quantity}</div>
                          <div className="text-[10px] text-slate-400 mt-1 mb-2">Provided by donor</div>
                          <div className="text-lg font-extrabold text-slate-900">{aiResult.servings}</div>
                          <div className="text-[10px] text-slate-400">Servings</div>
                        </div>
                        <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
                          <div className="text-[10px] font-bold text-emerald-800 uppercase mb-1">❤️ Suitability</div>
                          <div className="font-extrabold text-emerald-700 text-sm mb-1">
                            {aiResult.conditionColor} {aiResult.suitability}
                          </div>
                          <div className="text-[11px] text-emerald-900">{aiResult.suitabilityText}</div>
                        </div>
                        <div className="p-3 bg-white rounded-2xl border-l-4 border-l-red-500">
                          <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">⚡ Smart Pickup</div>
                          <div className="font-extrabold text-red-500 text-sm mb-1">Priority: {aiResult.recommendation}</div>
                          <div className="text-[11px] text-slate-500">Pickup within 2–3 hours.</div>
                        </div>
                      </div>

                      <div className="p-3 bg-white rounded-2xl border border-slate-200">
                        <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">🔍 Detected Items</div>
                        {aiResult.items.map((it, i) => (
                          <div key={i} className="flex justify-between text-[11px] mb-1">
                            <span>{it.name}</span>
                            <span className="font-bold">{it.confidence}%</span>
                          </div>
                        ))}
                      </div>

                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900">
                        ⚠️ <strong>Safety Notice:</strong> AI assessment does not replace human food-safety inspection.
                      </div>

                      <button
                        onClick={() => setWizardStep(4)}
                        className="w-full py-3 bg-brand-600 text-white font-bold text-xs rounded-xl shadow"
                      >
                        Proceed to Smart Matching →
                      </button>
                    </>
                  )}

                  {aiState === 'idle' && (
                    <div className="text-center py-8 text-slate-500 text-xs">
                      No analysis has run yet. Go back to Step 2 and click "Run AI Visual Inspection".
                    </div>
                  )}
                </div>
              )}

              {wizardStep === 4 && (
                <div className="space-y-3 text-xs">
                  <div className="p-4 bg-brand-50 border border-brand-300 rounded-2xl flex justify-between items-center">
                    <div>
                      <div className="font-bold text-slate-900">Shanti Vruddhashram (Vruddhashram)</div>
                      <div className="text-slate-500">85 Residents • Distance: 2.4 KM</div>
                    </div>
                    <span className="font-extrabold text-brand-700 text-base">96% Match</span>
                  </div>
                  <div className="p-4 bg-white border border-slate-200 rounded-2xl flex justify-between items-center">
                    <div>
                      <div className="font-bold text-slate-900">Anand Seva Anath Ashram (Anath Ashram)</div>
                      <div className="text-slate-500">120 Residents • Distance: 3.8 KM</div>
                    </div>
                    <span className="font-extrabold text-slate-500 text-base">88% Match</span>
                  </div>
                  <button onClick={() => setWizardStep(5)} className="w-full py-3 bg-brand-600 text-white font-bold text-xs rounded-xl shadow">
                    Confirm Selection →
                  </button>
                  <button onClick={() => setWizardStep(3)} className="w-full py-2 text-slate-500 hover:text-slate-800 font-bold text-[11px]">
                    ← Back to AI Analysis
                  </button>
                </div>
              )}

              {wizardStep === 5 && (
                <div className="space-y-4 text-xs">
                  <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2">
                    <div className="font-bold text-base">Confirm Donation Creation</div>
                    <div>Food: {foodName || (aiResult && aiResult.foodName) || 'Prepared Meal'}</div>
                    <div>Quantity: {weightKg || '—'} KG • {servings || '—'} Servings</div>
                    <div>Destination: Shanti Vruddhashram</div>
                    {aiResult && <div className="text-emerald-400">AI Verdict: {aiResult.conditionColor} {aiResult.suitability}</div>}
                  </div>
                  <button onClick={handleCreateDonation} className="w-full py-3.5 bg-gradient-to-r from-brand-600 to-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-xl">
                    Create Food Donation & Assign Driver →
                  </button>
                  <button onClick={resetWizard} className="w-full py-2 text-slate-500 hover:text-slate-800 font-bold text-[11px]">
                    ↺ Start Again
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ★ CHANGED — Merged "Rescue & Track" view with internal tabs */}
        {view === 'rescue' && (
          <div className="py-8 px-4 max-w-6xl mx-auto space-y-4">

            {/* Tab bar */}
            <div className="flex justify-center">
              <div className="inline-flex gap-1 p-1 bg-slate-100 border border-slate-200 rounded-2xl">
                <button
                  onClick={() => setRescueTab('map')}
                  className={`px-5 py-2.5 text-xs font-bold rounded-xl transition ${
                    rescueTab === 'map'
                      ? 'bg-brand-700 text-white shadow'
                      : 'text-slate-600 hover:bg-emerald-50 hover:text-brand-700'
                  }`}
                >
                  🗺️ Rescue Map
                </button>
                <button
                  onClick={() => setRescueTab('track')}
                  className={`px-5 py-2.5 text-xs font-bold rounded-xl transition ${
                    rescueTab === 'track'
                      ? 'bg-brand-700 text-white shadow'
                      : 'text-slate-600 hover:bg-emerald-50 hover:text-brand-700'
                  }`}
                >
                  🚚 Track Delivery
                </button>
              </div>
            </div>

            {/* --- MAP TAB --- */}
            {rescueTab === 'map' && (
              <>
                <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200">
                  <div>
                    <h2 className="font-extrabold text-slate-900 text-lg">Live Rescue GPS Map</h2>
                    <p className="text-xs text-slate-500">Tracking food donor, assigned EV driver, and destination Ashram.</p>
                  </div>
                  <button onClick={() => setView('driver')} className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl">
                    Open Driver QR Scanner
                  </button>
                </div>
                <div id="map" style={{ height: '480px', borderRadius: '24px' }}></div>
                <a href="rescue-track.html#map" className="block text-center text-brand-700 hover:underline text-xs font-bold">
                  → Open full Rescue & Track page (rescue-track.html)
                </a>
              </>
            )}

            {/* --- TRACK TAB --- */}
            {rescueTab === 'track' && (
              <>
                <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200">
                  <div>
                    <h2 className="font-extrabold text-slate-900 text-lg">Tracking Delivery #FF-DON-98241</h2>
                    <p className="text-xs text-slate-500">Hotel Green Leaf ➔ Shanti Vruddhashram • 45 KG Prepared Veg Meals • 120 Servings</p>
                  </div>
                </div>
                <div id="map" style={{ height: '480px', borderRadius: '24px' }}></div>

                {/* Timeline */}
                <div className="flex flex-wrap justify-center gap-2">
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-lg">1. Donation Created ✓</span>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-lg">2. Ashram Matched ✓</span>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-lg">3. Driver Assigned ✓</span>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-lg">4. Food Picked Up ✓</span>
                  <span className="text-[10px] font-bold bg-amber-400 text-slate-900 px-3 py-1.5 rounded-lg">5. In Transit ●</span>
                  <span className="text-[10px] font-bold bg-white border border-slate-200 text-slate-500 px-3 py-1.5 rounded-lg">6. Delivered ○</span>
                </div>

                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    onClick={() => showToast('📄 Receipt downloaded (demo)')}
                    className="px-4 py-2 bg-white border border-slate-300 text-slate-800 font-bold text-xs rounded-xl"
                  >
                    📄 Download Receipt
                  </button>
                  <button
                    onClick={() => showToast('✅ Issue report submitted (demo)')}
                    className="px-4 py-2 bg-white border border-slate-300 text-slate-800 font-bold text-xs rounded-xl"
                  >
                    ⚠️ Report an Issue
                  </button>
                  <button
                    onClick={() => setView('driver')}
                    className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl"
                  >
                    🚚 Open Driver QR Scanner
                  </button>
                </div>

                <a href="rescue-track.html#track" className="block text-center text-brand-700 hover:underline text-xs font-bold">
                  → Open full Rescue & Track page (rescue-track.html)
                </a>
              </>
            )}
          </div>
        )}

        {view === 'ashrams' && (
          <div className="py-10 px-4 max-w-6xl mx-auto space-y-6">
            <h1 className="text-2xl font-extrabold text-slate-900">Verified Ashrams & NGOs</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {DEMO_ASHRAMS.map((a) => (
                <div key={a.id} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex items-center space-x-4">
                  <img src={a.img} alt={a.name} className="w-20 h-20 rounded-2xl object-cover" />
                  <div className="space-y-1 text-xs">
                    <div className="font-extrabold text-slate-900 text-sm">{a.name}</div>
                    <div className="text-slate-500">{a.type} • {a.residents} Residents</div>
                    <div className="text-brand-600 font-bold">{a.currentNeed}</div>
                    <button onClick={() => setView('wizard')} className="px-3 py-1 bg-brand-600 text-white font-bold rounded-lg mt-1">
                      Donate Food Here
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <a href="find-ashrams.html" className="block text-center text-brand-700 hover:underline text-xs font-bold">
              → Open full Find Ashrams page (find-ashrams.html)
            </a>
          </div>
        )}

        {view === 'driver' && (
          <div className="py-10 px-4 max-w-4xl mx-auto space-y-6">
            <div className="bg-slate-900 text-white p-6 rounded-3xl space-y-4">
              <div className="text-xs font-mono text-amber-400 font-bold">DRIVER MISSION PORTAL • RAJESH KUMAR</div>
              <h2 className="text-xl font-bold">Active Mission: #FF-DON-98241</h2>
              <p className="text-xs text-slate-300">45 KG Prepared Food • Hotel Green Leaf ➔ Shanti Vruddhashram</p>
              <div className="flex flex-wrap gap-2 pt-2">
                <button onClick={() => { setQrType('pickup'); setShowQrModal(true); }} className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow">
                  Scan Pickup QR Code
                </button>
                <button onClick={() => { setQrType('delivery'); setShowQrModal(true); }} className="px-4 py-2 bg-brand-600 text-white font-bold text-xs rounded-xl shadow">
                  Scan Delivery QR Code
                </button>
              </div>
            </div>
            <a href="driver-hub.html" className="block text-center text-brand-700 hover:underline text-xs font-bold">
              → Open full Driver Hub page (driver-hub.html)
            </a>
          </div>
        )}

        {view === 'impact' && (
          <div className="py-10 px-4 max-w-5xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-extrabold text-slate-900">Social Impact & CSR Reports</h1>
              <button onClick={() => window.print()} className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl">
                Print CSR Report (PDF)
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="p-4 bg-white rounded-2xl border border-slate-200">
                <div className="text-2xl font-bold text-brand-600">1,420 KG</div>
                <div className="text-xs text-slate-500">Food Rescued</div>
              </div>
              <div className="p-4 bg-white rounded-2xl border border-slate-200">
                <div className="text-2xl font-bold text-emerald-600">3,570+</div>
                <div className="text-xs text-slate-500">Meals Served</div>
              </div>
              <div className="p-4 bg-white rounded-2xl border border-slate-200">
                <div className="text-2xl font-bold text-sky-600">~2,840 KG</div>
                <div className="text-xs text-slate-500">CO2 Emissions Saved</div>
              </div>
              <div className="p-4 bg-white rounded-2xl border border-slate-200">
                <div className="text-2xl font-bold text-purple-600">1.2M Liters</div>
                <div className="text-xs text-slate-500">Water Saved</div>
              </div>
            </div>
            <a href="impact-csr.html" className="block text-center text-brand-700 hover:underline text-xs font-bold">
              → Open full Impact & CSR page (impact-csr.html)
            </a>
          </div>
        )}

        {view === 'ai' && (
          <div className="py-10 px-4 max-w-4xl mx-auto space-y-6">
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-extrabold text-slate-900">AI Visual Inspection</h1>
              <p className="text-xs text-slate-500">Upload a photo — the AI checks whether it contains food and evaluates freshness.</p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              {aiViewImage ? (
                <img src={aiViewImage} alt="Preview" className="w-full max-w-md mx-auto h-64 object-cover rounded-2xl border border-slate-200 shadow" />
              ) : (
                <div className="w-full max-w-md mx-auto h-64 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-slate-400">
                  <div className="text-4xl mb-2">📷</div>
                  <div className="text-sm font-semibold">No image selected</div>
                </div>
              )}

              <input ref={aiViewFileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAiViewUpload} className="hidden" />

              <div className="flex flex-wrap justify-center gap-3">
                <button onClick={() => aiViewFileRef.current && aiViewFileRef.current.click()} className="px-5 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl shadow">
                  📷 {aiViewImage ? 'Change Image' : 'Choose Image'}
                </button>
                <button onClick={loadAiViewDemoImage} className="px-5 py-2.5 bg-white border border-slate-300 text-slate-800 font-bold text-xs rounded-xl">
                  Use Demo Image
                </button>
                <button
                  onClick={runAiViewDetection}
                  disabled={!aiViewImage || aiViewState === 'analyzing'}
                  className={`px-5 py-2.5 font-bold text-xs rounded-xl shadow ${(!aiViewImage || aiViewState === 'analyzing') ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-brand-600 text-white'}`}
                >
                  🤖 Run AI Analysis
                </button>
              </div>
            </div>

            {aiViewState === 'analyzing' && (
              <div className="bg-white rounded-3xl p-10 border border-slate-200 text-center space-y-3">
                <div className="w-12 h-12 border-4 border-slate-200 border-t-brand-600 rounded-full mx-auto animate-spin"></div>
                <div className="font-bold text-slate-800">🤖 Analyzing image…</div>
                <div className="text-xs text-slate-500">Running detection, freshness check, and suitability.</div>
              </div>
            )}

            {aiViewState === 'no-food' && (
              <div className="bg-red-50 border-2 border-red-200 rounded-3xl p-8 text-center space-y-3">
                <div className="text-5xl">🚫</div>
                <div className="text-lg font-extrabold text-red-800">No Food Detected</div>
                <p className="text-red-900 text-sm max-w-md mx-auto">
                  The uploaded image does not appear to contain food. Please upload a clear image of the food you want to donate.
                </p>
                <div className="inline-flex items-center gap-2 bg-white border border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold text-red-800">
                  <span>Detection confidence:</span>
                  <span>{aiViewDetection ? aiViewDetection.confidence + '%' : '—'}</span>
                </div>
              </div>
            )}

            {aiViewState === 'food' && aiViewResult && (
              <div className="bg-slate-900 text-white rounded-3xl p-6 space-y-4 font-mono text-xs">
                <div className="text-emerald-400 font-bold">▸ MODEL: canvas-food-heuristic + deterministic-analyzer</div>
                <div>▸ Detected Class : <span className="text-white font-bold">{aiViewResult.foodName}</span></div>
                <div>▸ Confidence     : <span className="text-white font-bold">{aiViewResult.confidence}%</span></div>
                <div>▸ Freshness Score: <span className="text-emerald-400 font-bold">{aiViewResult.freshness} / 100</span></div>
                <div>▸ Condition      : <span className="text-white font-bold">{aiViewResult.conditionColor} {aiViewResult.condition}</span></div>
                <div>▸ Spoilage       : <span className="text-white font-bold">{aiViewResult.spoilage ? '⚠️ Possible damage' : '🟢 Not detected'}</span></div>
                <div>▸ Suitability    : <span className="text-emerald-400 font-bold">{aiViewResult.conditionColor} {aiViewResult.suitability}</span></div>
                <div>▸ Priority       : <span className="text-amber-400 font-bold">{aiViewResult.recommendation} (pickup within 2–3h)</span></div>
                <div className="border-t border-slate-700 pt-3">
                  <div className="text-emerald-400 font-bold mb-1">DETECTED ITEMS:</div>
                  {aiViewResult.items.map((it, i) => (
                    <div key={i}>• {it.name} — {it.confidence}%</div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-center gap-3">
              <button onClick={() => setView('wizard')} className="px-5 py-2.5 bg-brand-600 text-white font-bold text-xs rounded-xl shadow">
                Send to Donation Wizard →
              </button>
              <a href="ai-inspection.html" className="px-5 py-2.5 bg-white border border-slate-300 text-slate-800 font-bold text-xs rounded-xl">
                Open full AI Inspection page
              </a>
            </div>
          </div>
        )}

        {view === 'admin' && (
          <div className="py-10 px-4 max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900">Admin Control Portal</h1>
                <p className="text-xs text-slate-500">Platform oversight — donations, users, ashrams, drivers.</p>
              </div>
              <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-3 py-1 rounded-full border border-amber-200">
                ADMIN MODE
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="p-4 bg-white rounded-2xl border border-slate-200">
                <div className="text-2xl font-bold text-brand-600">1,420 KG</div>
                <div className="text-xs text-slate-500">Total Rescued</div>
              </div>
              <div className="p-4 bg-white rounded-2xl border border-slate-200">
                <div className="text-2xl font-bold text-sky-600">142</div>
                <div className="text-xs text-slate-500">Deliveries</div>
              </div>
              <div className="p-4 bg-white rounded-2xl border border-slate-200">
                <div className="text-2xl font-bold text-purple-600">48</div>
                <div className="text-xs text-slate-500">Active Donors</div>
              </div>
              <div className="p-4 bg-white rounded-2xl border border-slate-200">
                <div className="text-2xl font-bold text-emerald-600">14</div>
                <div className="text-xs text-slate-500">Ashrams</div>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center">
                <h2 className="font-extrabold text-slate-900 text-sm">Recent Donations</h2>
                <button onClick={() => setView('wizard')} className="px-3 py-1.5 bg-brand-600 text-white font-bold text-xs rounded-lg">
                  + Create Test Donation
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-5 py-3">ID</th>
                      <th className="text-left px-5 py-3">Food</th>
                      <th className="text-left px-5 py-3">Donor</th>
                      <th className="text-left px-5 py-3">Ashram</th>
                      <th className="text-left px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {donations.map(d => (
                      <tr key={d.id} className="border-t border-slate-100">
                        <td className="px-5 py-3 font-mono text-[11px] text-slate-500">{d.id}</td>
                        <td className="px-5 py-3 font-semibold text-slate-800">{d.foodName}</td>
                        <td className="px-5 py-3 text-slate-600">{d.donorName}</td>
                        <td className="px-5 py-3 text-slate-600">{d.ashramName}</td>
                        <td className="px-5 py-3">
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                            {d.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <a href="admin-portal.html" className="block text-center text-brand-700 hover:underline text-xs font-bold">
              → Open full Admin Portal page (admin-portal.html)
            </a>
          </div>
        )}

      </main>

      {showQrModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 text-white rounded-3xl p-6 max-w-sm w-full space-y-4 text-center border border-slate-700">
            <h3 className="font-extrabold text-lg">Scan {qrType === 'pickup' ? 'Donor Pickup' : 'Ashram Delivery'} QR</h3>
            <div className="w-32 h-32 border-2 border-emerald-400 rounded-2xl mx-auto flex items-center justify-center font-mono text-xs">
              [ SCAN QR CODE ]
            </div>
            <button
              onClick={() => {
                showToast(`✅ ${qrType.toUpperCase()} QR verified — status updated.`);
                setShowQrModal(false);
              }}
              className="w-full py-2.5 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow"
            >
              Simulate Instant Scan Success
            </button>
            <button onClick={() => setShowQrModal(false)} className="w-full py-2 text-slate-400 hover:text-white font-bold text-[11px]">
              Cancel
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-5 py-3 rounded-xl text-xs font-bold shadow-2xl z-[9999]">
          {toast}
        </div>
      )}

      <footer className="bg-slate-900 text-slate-400 py-8 border-t border-slate-800 text-xs">
        <div className="max-w-6xl mx-auto px-4 space-y-4">
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-[11px] font-semibold">
            {OTHER_PAGES.map(p => (
              <a key={p.href} href={p.href} className="hover:text-emerald-400">
                {p.label}
              </a>
            ))}
          </div>
          <div className="text-center">
            © {new Date().getFullYear()} FeedFoodForward Platform. "Rescue Food. Reduce Waste. Feed Communities."
          </div>
        </div>
      </footer>

    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);