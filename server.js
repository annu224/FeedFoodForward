/* ==========================================================================
   FeedFoodForward — server.js (Phase 3 · Gemini + MongoDB + GIS + Delivery)
   ========================================================================== */

require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');
const fs = require('fs');

/* ============================================================
   Load restaurant coordinates from restaurant first.csv
   ============================================================ */
const DONOR_COORDS = {};
try {
  const csvPath = path.join(__dirname, 'restaurant first.csv');
  if (fs.existsSync(csvPath)) {
    const csvRaw = fs.readFileSync(csvPath, 'utf8');
    const lines = csvRaw.split('\n');
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length < 7) continue;
      const name = (cols[1] || '').trim().replace(/^"|"$/g, '');
      const lat  = parseFloat((cols[4] || '').trim());
      const lng  = parseFloat((cols[5] || '').trim());
      if (name && !isNaN(lat) && !isNaN(lng)) {
        DONOR_COORDS[name.toLowerCase()] = [lng, lat];   /* GeoJSON order */
      }
    }
    console.log(`📍 Loaded ${Object.keys(DONOR_COORDS).length} donor coordinates from CSV`);
  } else {
    console.warn('⚠️ restaurant first.csv not found — donor coords will not resolve from CSV');
  }
} catch (err) {
  console.warn('⚠️ Could not load restaurant CSV:', err.message);
}

function donorCoordsByName(name) {
  if (!name) return null;
  return DONOR_COORDS[String(name).trim().toLowerCase()] || null;
}

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const MONGO_URI = process.env.MONGODB_URI;

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));
app.use(express.static(__dirname));

/* ==========================================================================
   MongoDB connection
   ========================================================================== */
let mongoConnected = false;

async function connectMongo() {
  if (!MONGO_URI) {
    console.warn('⚠️  MONGODB_URI missing in .env — donations will NOT persist.');
    return;
  }
  try {
    await mongoose.connect(MONGO_URI);
    mongoConnected = true;
    console.log('  ✅ MongoDB connected:', mongoose.connection.name);
  } catch (err) {
    console.error('  ❌ MongoDB connection failed:', err.message);
  }
}

/* ==========================================================================
   MODELS
   ========================================================================== */

/* ---------- DONATION MODEL ---------- */
const donationSchema = new mongoose.Schema({
  donationId:   { type: String, required: true, unique: true },
  foodName:     { type: String, default: 'Prepared Meal' },
  foodCategory: { type: String, default: 'Prepared Meals' },
  weightKg:     { type: Number, default: 0 },
  servings:     { type: Number, default: 0 },
  donorName:    { type: String, default: 'Hotel Green Leaf' },
  ashramName:   { type: String, default: 'Unassigned' },
  driverName:   { type: String, default: 'Unassigned' },
  driverId:     { type: String, default: null },
  status:       { type: String, default: 'Pending' },
  matchScore:   { type: Number, default: 90 },
  claimedBy:    { type: String, default: null },
  claimedAt:    { type: Date,   default: null },
  claimId:      { type: String, default: null },
  approvedAt:   { type: Date,   default: null },
  urgency:      { type: String, default: 'MEDIUM' },
  imageUrl:     { type: String, default: '' },
  aiAnalysis:   { type: Object, default: {} },

  pickupCoords:   { type: { type: String, default: 'Point' }, coordinates: { type: [Number], default: [0, 0] } },
  deliveryCoords: { type: { type: String, default: 'Point' }, coordinates: { type: [Number], default: [0, 0] } },

  acceptedAt:           { type: Date, default: null },
  pickupVerifiedAt:     { type: Date, default: null },
  pickupVerifiedBy:     { type: String, default: null },
  deliveryVerifiedAt:   { type: Date, default: null },
  deliveryVerifiedBy:   { type: String, default: null },

  lastDriverLocation: { type: { type: String, default: 'Point' }, coordinates: { type: [Number], default: [0, 0] } },
  lastDriverUpdate:   { type: Date, default: null },

  statusHistory: [{
    status: String,
    at:     { type: Date, default: Date.now },
    by:     String
  }],

  createdAt: { type: Date, default: Date.now }
});
const Donation = mongoose.model('Donation', donationSchema);

/* ---------- CLAIM MODEL ---------- */
const claimSchema = new mongoose.Schema({
  claimId:     { type: String, required: true, unique: true },
  donationId:  { type: String, required: true, index: true },
  ashramName:  { type: String, required: true, index: true },
  ashramEmail: { type: String, default: '' },
  donorName:   { type: String, required: true, index: true },
  status:      { type: String, enum: ['pending','approved','rejected','cancelled'], default: 'pending' },
  driverId:    { type: String, default: null },
  decidedAt:   { type: Date, default: null },
  createdAt:   { type: Date, default: Date.now }
});
claimSchema.index({ donationId: 1, ashramName: 1 }, { unique: true });
const Claim = mongoose.model('Claim', claimSchema);

/* ---------- DRIVER MODEL ---------- */
const driverSchema = new mongoose.Schema({
  userId:          { type: String, required: true, unique: true },
  name:            { type: String, required: true },
  vehicle:         { type: String, default: 'EV Cargo Van' },
  phone:           { type: String, default: '' },
  rating:          { type: Number, default: 4.9 },
  available:       { type: Boolean, default: true },
  currentDonation: { type: String, default: null },
  location: {
    type:        { type: String, default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] }
  },
  accuracy:   { type: Number, default: null },
  lastUpdate: { type: Date,   default: null }
});
driverSchema.index({ location: '2dsphere' });
const Driver = mongoose.model('Driver', driverSchema);

/* ---------- ASHRAM MODEL ---------- */
const ashramSchema = new mongoose.Schema({
  name:         { type: String, required: true },
  type:         String,
  state:        String,
  district:     String,
  city:         String,
  address:      String,
  pincode:      String,
  phone:        String,
  website:      String,
  capacity:     String,
  food_needed:  String,
  verified:     String,
  location: {
    type:        { type: String, default: 'Point' },
    coordinates: [Number]
  }
});
ashramSchema.index({ location: '2dsphere' });
const Ashram = mongoose.model('Ashram', ashramSchema);

/* ---------- DONOR MODEL ---------- */
const donorSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  type:      String,
  cuisine:   String,
  address:   String,
  city:      String,
  state:     String,
  phone:     String,
  website:   String,
  osmId:     { type: String, unique: true },
  location: {
    type:        { type: String, default: 'Point' },
    coordinates: [Number]
  }
});
donorSchema.index({ location: '2dsphere' });
const Donor = mongoose.model('Donor', donorSchema);

/* ---------- USER MODEL ---------- */
const userSchema = new mongoose.Schema({
  email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
  name:       { type: String, default: 'User' },
  phone:      { type: String, default: '' },
  role:       { type: String, enum: ['donor', 'ashram', 'driver', 'admin'], default: 'donor' },
  roleLabel:  { type: String, default: 'Food Donor' },
  avatar:     { type: String, default: '👤' },
  verified:   { type: String, default: 'Pending verification' },
  language:   { type: String, default: 'en-IN' },
  passwordHash: { type: String, default: '' },

  org:       String,
  orgType:   String,
  address:   String,
  residents: String,
  needs:     String,
  vehicle:   String,
  license:   String,
  area:      String,

  settings: {
    notifications: {
      email:     { type: Boolean, default: true  },
      sms:       { type: Boolean, default: true  },
      pickup:    { type: Boolean, default: true  },
      delivery:  { type: Boolean, default: true  },
      weekly:    { type: Boolean, default: false },
      marketing: { type: Boolean, default: false }
    },
    privacy: {
      publicProfile: { type: Boolean, default: true  },
      location:      { type: Boolean, default: true  },
      leaderboard:   { type: Boolean, default: true  },
      research:      { type: Boolean, default: false }
    },
    security: {
      twoFactor: { type: Boolean, default: false }
    },
    appearance: {
      theme:        { type: String, enum: ['light','dark','system'], default: 'light' },
      reduceMotion: { type: Boolean, default: false },
      compact:      { type: Boolean, default: false }
    }
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

/* ==========================================================================
   CREATE FIRST ADMIN
   ========================================================================== */
async function ensureAdminAccount() {
  if (!mongoConnected) return;
  try {
    const adminEmail = 'admin@feedfoodforward.demo';
    const existing = await User.findOne({ email: adminEmail });
    if (existing) return;

    let hash = 'admin123';
    try {
      const bcrypt = require('bcryptjs');
      hash = await bcrypt.hash(hash, 10);
    } catch (e) {}

    await User.create({
      email:        adminEmail,
      name:         'System Administrator',
      phone:        '',
      role:         'admin',
      roleLabel:    'Admin',
      avatar:       '⚡',
      verified:     'Admin',
      passwordHash: hash
    });
    console.log('✅ Admin account created: ' + adminEmail);
  } catch (err) {
    console.error('Admin seed failed:', err.message);
  }
}

/* ---------- ISSUE REPORT MODEL ---------- */
const issueSchema = new mongoose.Schema({
  issueId:       { type: String, required: true, unique: true },
  type:          { type: String, required: true },
  details:       { type: String, default: '' },
  donationId:    { type: String, default: '' },
  reporter:      { type: String, default: 'Anonymous' },
  reporterEmail: { type: String, default: '' },
  status:        { type: String, enum: ['open','in-progress','resolved'], default: 'open' },
  createdAt:     { type: Date, default: Date.now }
});
const Issue = mongoose.model('Issue', issueSchema);

/* ==========================================================================
   Helpers
   ========================================================================== */
function parseDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const m = dataUrl.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
  if (!m) return null;
  return { mimeType: m[1], data: m[2] };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function haversineKm(a, b) {
  const R = 6371;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLng = (b[1] - a[1]) * Math.PI / 180;
  const l1 = a[0] * Math.PI / 180;
  const l2 = b[0] * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(l1) * Math.cos(l2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

async function fetchRoadRoute(start, end) {
  const url = `https://router.project-osrm.org/route/v1/driving/` +
              `${start[1]},${start[0]};${end[1]},${end[0]}` +
              `?overview=full&geometries=geojson`;

  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'FeedFoodForward/1.0 (student project)' }
    });
    if (!r.ok) throw new Error(`OSRM HTTP ${r.status}`);

    const data = await r.json();
    if (!data.routes || data.routes.length === 0) {
      throw new Error('OSRM returned no routes');
    }

    const route = data.routes[0];
    const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);

    return {
      route: coords,
      distanceKm: route.distance / 1000,
      durationMin: route.duration / 60
    };
  } catch (err) {
    console.warn('OSRM failed, using straight line:', err.message);
    return {
      route: [start, end],
      distanceKm: haversineKm(start, end),
      durationMin: (haversineKm(start, end) / 15) * 60
    };
  }
}

/* ==========================================================================
   GET /api/health
   ========================================================================== */
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    geminiConfigured: !!GEMINI_KEY,
    mongoConnected,
    time: new Date().toISOString()
  });
});

/* ==========================================================================
   GET /api/geocode?address=...
   ========================================================================== */
app.get('/api/geocode', async (req, res) => {
  const address = (req.query.address || '').trim();
  if (!address) return res.status(400).json({ error: 'Missing ?address= parameter' });

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=in`;

    const r = await fetch(url, {
      headers: {
        'User-Agent': 'FeedFoodForward/1.0 (student project; contact@feedfoodforward.demo)',
        'Accept-Language': 'en'
      }
    });

    if (!r.ok) return res.status(502).json({ error: `Geocoder HTTP ${r.status}` });

    const data = await r.json();
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Address not found', address });
    }

    const best = data[0];
    console.log(`📍 Geocoded "${address}" → ${best.lat}, ${best.lon}`);

    res.json({
      ok: true,
      address,
      displayName: best.display_name,
      lat: parseFloat(best.lat),
      lng: parseFloat(best.lon)
    });
  } catch (err) {
    console.error('Geocode error:', err.message);
    res.status(500).json({ error: 'Geocoding failed', detail: err.message });
  }
});

/* ==========================================================================
   GET /api/delivery/sample
   ========================================================================== */
app.get('/api/delivery/sample', async (req, res) => {
  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });

    const PREFERRED_CITIES = ['Mumbai', 'Pune', 'Bengaluru', 'Delhi'];

    let donor = null;
    let ashram = null;

    for (const city of PREFERRED_CITIES) {
      const ashramsInCity = await Ashram.aggregate([
        { $match: { city: city, 'location.coordinates.0': { $exists: true, $ne: null } } },
        { $sample: { size: 1 } }
      ]);
      if (ashramsInCity.length === 0) continue;

      const candidateAshram = ashramsInCity[0];
      const [a_lng, a_lat] = candidateAshram.location.coordinates;

      const nearbyDonors = await Donor.aggregate([
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [a_lng, a_lat] },
            distanceField: 'distMeters',
            maxDistance: 25000,
            spherical: true,
            query: { 'location.coordinates.0': { $exists: true } }
          }
        },
        { $limit: 5 }
      ]);
      if (nearbyDonors.length === 0) continue;

      donor = nearbyDonors[Math.floor(Math.random() * nearbyDonors.length)];
      ashram = candidateAshram;
      break;
    }

    if (!donor || !ashram) {
      const anyAshram = await Ashram.findOne({ 'location.coordinates.0': { $exists: true, $ne: null } });
      if (!anyAshram) return res.status(404).json({ error: 'No ashrams with coordinates found.' });

      const [a_lng, a_lat] = anyAshram.location.coordinates;
      const nearbyDonors = await Donor.aggregate([
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [a_lng, a_lat] },
            distanceField: 'distMeters',
            maxDistance: 30000,
            spherical: true
          }
        },
        { $limit: 5 }
      ]);
      if (nearbyDonors.length === 0) return res.status(404).json({ error: 'No donors with coordinates found.' });

      donor = nearbyDonors[Math.floor(Math.random() * nearbyDonors.length)];
      ashram = anyAshram;
    }

    const [d_lng, d_lat] = donor.location.coordinates;
    const [a_lng, a_lat] = ashram.location.coordinates;

    const pickup = { lat: d_lat, lng: d_lng };
    const destination = { lat: a_lat, lng: a_lng };

    const road = await fetchRoadRoute([pickup.lat, pickup.lng], [destination.lat, destination.lng]);

    res.json({
      ok: true,
      city: donor.city || ashram.city || 'Unknown',
      pickup: {
        name: donor.name,
        address: donor.address || '',
        type: donor.type || 'Restaurant',
        cuisine: donor.cuisine || '',
        lat: pickup.lat,
        lng: pickup.lng
      },
      destination: {
        name: ashram.name,
        address: ashram.address || '',
        type: ashram.type || 'Ashram',
        city: ashram.city || '',
        lat: destination.lat,
        lng: destination.lng
      },
      distanceKm: Number(road.distanceKm.toFixed(2)),
      estimatedMinutes: Math.max(5, Math.round(road.durationMin)),
      route: road.route
    });
  } catch (err) {
    console.error('Delivery sample error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   GET /api/delivery/route?city=mumbai
   ========================================================================== */
app.get('/api/delivery/route', async (req, res) => {
  const city = (req.query.city || 'Mumbai').trim();

  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });

    const ashramsInCity = await Ashram.aggregate([
      { $match: { city: city, 'location.coordinates.0': { $exists: true, $ne: null } } },
      { $sample: { size: 1 } }
    ]);
    if (ashramsInCity.length === 0) return res.status(404).json({ error: `No ashrams found in ${city}.` });

    const ashram = ashramsInCity[0];
    const [a_lng, a_lat] = ashram.location.coordinates;

    const nearbyDonors = await Donor.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [a_lng, a_lat] },
          distanceField: 'distMeters',
          maxDistance: 25000,
          spherical: true
        }
      },
      { $limit: 5 }
    ]);
    if (nearbyDonors.length === 0) return res.status(404).json({ error: `No donors near ${city}.` });

    const donor = nearbyDonors[Math.floor(Math.random() * nearbyDonors.length)];
    const [d_lng, d_lat] = donor.location.coordinates;

    const pickup = { lat: d_lat, lng: d_lng };
    const destination = { lat: a_lat, lng: a_lng };

    const road = await fetchRoadRoute([pickup.lat, pickup.lng], [destination.lat, destination.lng]);

    res.json({
      ok: true,
      city,
      pickup: {
        name: donor.name,
        address: donor.address || '',
        type: donor.type || 'Restaurant',
        cuisine: donor.cuisine || '',
        lat: pickup.lat,
        lng: pickup.lng
      },
      destination: {
        name: ashram.name,
        address: ashram.address || '',
        type: ashram.type || 'Ashram',
        city: ashram.city || '',
        lat: destination.lat,
        lng: destination.lng
      },
      distanceKm: Number(road.distanceKm.toFixed(2)),
      estimatedMinutes: Math.max(5, Math.round(road.durationMin)),
      route: road.route
    });
  } catch (err) {
    console.error('Delivery route error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   GET /api/ashrams/search?city=bangalore
   ========================================================================== */
const CITY_BBOX = {
  'bangalore':     '12.75,77.40,13.15,77.80',
  'bengaluru':     '12.75,77.40,13.15,77.80',
  'delhi':         '28.40,76.80,28.90,77.40',
  'newdelhi':      '28.40,76.80,28.90,77.40',
  'mumbai':        '18.85,72.75,19.30,73.05',
  'chennai':       '12.90,80.10,13.25,80.35',
  'kolkata':       '22.40,88.20,22.70,88.50',
  'hyderabad':     '17.25,78.30,17.55,78.60',
  'pune':          '18.40,73.70,18.65,73.95',
  'ahmedabad':     '22.90,72.45,23.15,72.70',
  'jaipur':        '26.75,75.70,27.00,75.90',
  'lucknow':       '26.75,80.85,26.95,81.05',
  'varanasi':      '25.25,82.90,25.40,83.10',
  'kochi':         '9.85,76.20,10.10,76.40',
  'chandigarh':    '30.65,76.70,30.80,76.85',
  'indore':        '22.60,75.75,22.85,75.95',
  'patna':         '25.55,85.05,25.70,85.25',
  'ranchi':        '23.30,85.25,23.45,85.40',
  'bhopal':        '23.20,77.35,23.35,77.50',
  'coimbatore':    '10.95,76.90,11.10,77.05',
  'madurai':       '9.85,78.05,10.00,78.20',
  'nagpur':        '21.05,79.00,21.20,79.20',
  'surat':         '21.10,72.75,21.30,72.95',
  'visakhapatnam': '17.65,83.15,17.85,83.35',
  'mysore':        '12.25,76.55,12.40,76.70',
  'mysuru':        '12.25,76.55,12.40,76.70',
  'goa':           '15.40,73.75,15.60,73.95'
};

app.get('/api/ashrams/search', async (req, res) => {
  const city = (req.query.city || 'bangalore').toLowerCase().replace(/\s+/g, '').trim();
  const bbox = CITY_BBOX[city];

  if (!bbox) {
    return res.status(400).json({
      error: 'Unknown city',
      requestedCity: city,
      supported: Object.keys(CITY_BBOX)
    });
  }

  const query = `
[out:json][timeout:25];
(
  nwr["amenity"="social_facility"](${bbox});
  nwr["social_facility"="group_home"](${bbox});
  nwr["social_facility"="assisted_living"](${bbox});
  nwr["amenity"="nursing_home"](${bbox});
  nwr["amenity"="place_of_worship"]["religion"="hindu"]["name"~"Ashram|ashram|Ashrama|Math|Matha|Mutt|Seva",i](${bbox});
);
out body center 80;
  `.trim();

  try {
    const r = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'FeedFoodForward/1.0 (student project)'
      },
      body: 'data=' + encodeURIComponent(query)
    });

    if (!r.ok) return res.status(502).json({ error: `Overpass HTTP ${r.status}` });

    const data = await r.json();
    const elements = data.elements || [];

    const places = elements
      .filter(el => el.tags && el.tags.name)
      .map(el => {
        const lat = el.lat || (el.center && el.center.lat);
        const lng = el.lon || (el.center && el.center.lon);
        if (!lat || !lng) return null;

        const tags = el.tags;
        let type = 'Ashram';
        if (tags.social_facility === 'group_home' || tags.amenity === 'nursing_home') type = 'Vruddhashram';
        else if (tags.social_facility === 'assisted_living') type = 'Elder Care';
        else if (tags.amenity === 'place_of_worship') type = 'Ashram';
        else if (tags.social_facility) type = 'Shelter';

        const addrParts = [
          tags['addr:housenumber'],
          tags['addr:street'],
          tags['addr:suburb'],
          tags['addr:city'] || city.charAt(0).toUpperCase() + city.slice(1)
        ].filter(Boolean);
        const address = addrParts.length > 0 ? addrParts.join(', ')
          : (tags['addr:full'] || city.charAt(0).toUpperCase() + city.slice(1));

        return {
          id: `osm-${el.type}-${el.id}`,
          name: tags.name,
          type,
          address,
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          residents: null,
          currentNeed: 'Contact for current needs',
          img: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=600&auto=format&fit=crop&q=80'
        };
      })
      .filter(Boolean)
      .filter((p, i, arr) => arr.findIndex(x => x.name.toLowerCase() === p.name.toLowerCase()) === i)
      .slice(0, 50);

    console.log(`🏠 Overpass: found ${places.length} places in ${city}`);

    res.json({ ok: true, city, count: places.length, places });
  } catch (err) {
    console.error('Overpass query failed:', err.message);
    res.status(500).json({ error: 'Overpass query failed', detail: err.message });
  }
});

/* ==========================================================================
   GET /api/ashrams/all
   ========================================================================== */
app.get('/api/ashrams/all', async (req, res) => {
  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });
    const ashrams = await Ashram.find().limit(1000).lean();
    res.json({ ok: true, count: ashrams.length, ashrams });
  } catch (err) {
    console.error('Ashram all error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   GET /api/donors/all
   ========================================================================== */
app.get('/api/donors/all', async (req, res) => {
  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });
    const donors = await Donor.find().limit(5000).lean();
    res.json({ ok: true, count: donors.length, donors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   GET /api/donors/nearby
   ========================================================================== */
app.get('/api/donors/nearby', async (req, res) => {
  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radiusKm = Math.min(Math.max(parseFloat(req.query.radiusKm) || 25, 1), 100);
    if (isNaN(lat) || isNaN(lng)) return res.status(400).json({ error: 'Invalid lat/lng' });

    const donors = await Donor.find({
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: radiusKm * 1000
        }
      }
    }).limit(500).lean();

    res.json({ ok: true, count: donors.length, donors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   GET /api/ashrams/db-nearby
   ========================================================================== */
app.get('/api/ashrams/db-nearby', async (req, res) => {
  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });

    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radiusKm = Math.min(Math.max(parseFloat(req.query.radiusKm) || 50, 1), 100);

    if (isNaN(lat) || isNaN(lng)) return res.status(400).json({ error: 'Missing or invalid lat/lng' });

    const ashrams = await Ashram.find({
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: radiusKm * 1000
        }
      }
    }).limit(200).lean();

    res.json({ ok: true, count: ashrams.length, radiusKm, ashrams });
  } catch (err) {
    console.error('Ashram nearby error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   GET /api/ashrams/nearby
   ========================================================================== */
app.get('/api/ashrams/nearby', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const radiusKm = Math.min(Math.max(parseFloat(req.query.radiusKm) || 30, 5), 80);

  if (isNaN(lat) || isNaN(lng)) return res.status(400).json({ error: 'Missing or invalid ?lat= & ?lng=' });

  const radiusM = radiusKm * 1000;

  const query = `
[out:json][timeout:30];
(
  nwr(around:${radiusM},${lat},${lng})["amenity"="social_facility"];
  nwr(around:${radiusM},${lat},${lng})["social_facility"="group_home"];
  nwr(around:${radiusM},${lat},${lng})["social_facility"="assisted_living"];
  nwr(around:${radiusM},${lat},${lng})["social_facility"="shelter"];
  nwr(around:${radiusM},${lat},${lng})["social_facility"="orphanage"];
  nwr(around:${radiusM},${lat},${lng})["amenity"="nursing_home"];
  nwr(around:${radiusM},${lat},${lng})["amenity"="monastery"];
  nwr(around:${radiusM},${lat},${lng})["office"="ngo"];
  nwr(around:${radiusM},${lat},${lng})["office"="charity"];
  nwr(around:${radiusM},${lat},${lng})["amenity"="community_centre"];
  nwr(around:${radiusM},${lat},${lng})["amenity"="place_of_worship"]["name"~"Ashram|ashram|Ashrama|Math|Matha|Mutt|Seva",i];
);
out body center 120;
  `.trim();

  try {
    const r = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'FeedFoodForward/1.0 (student project)'
      },
      body: 'data=' + encodeURIComponent(query)
    });

    if (!r.ok) return res.status(502).json({ error: `Overpass HTTP ${r.status}` });

    const data = await r.json();
    const elements = data.elements || [];

    const places = elements
      .filter(el => el.tags && el.tags.name)
      .map(el => {
        const la = el.lat || (el.center && el.center.lat);
        const ln = el.lon || (el.center && el.center.lon);
        if (!la || !ln) return null;

        const tags = el.tags;
        let type = 'Ashram';
        if (tags.social_facility === 'group_home' || tags.amenity === 'nursing_home') type = 'Vruddhashram';
        else if (tags.social_facility === 'assisted_living') type = 'Elder Care';
        else if (tags.social_facility === 'orphanage') type = 'Anath Ashram';
        else if (tags.social_facility === 'shelter') type = 'Shelter';
        else if (tags.amenity === 'place_of_worship') type = 'Ashram';

        const addrParts = [
          tags['addr:housenumber'],
          tags['addr:street'],
          tags['addr:suburb'],
          tags['addr:city']
        ].filter(Boolean);
        const address = addrParts.length > 0 ? addrParts.join(', ')
          : (tags['addr:full'] || 'See map for exact location');

        return {
          id: `osm-${el.type}-${el.id}`,
          name: tags.name,
          type,
          address,
          lat: parseFloat(la),
          lng: parseFloat(ln),
          residents: null,
          currentNeed: 'Contact for current needs',
          img: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=600&auto=format&fit=crop&q=80'
        };
      })
      .filter(Boolean)
      .filter((p, i, arr) => arr.findIndex(x => x.name.toLowerCase() === p.name.toLowerCase()) === i)
      .slice(0, 100);

    console.log(`🏠 Overpass nearby (${lat},${lng} r=${radiusKm}km): found ${places.length} places`);

    res.json({ ok: true, count: places.length, lat, lng, radiusKm, places });
  } catch (err) {
    console.error('Overpass nearby failed:', err.message);
    res.status(500).json({ error: 'Overpass query failed', detail: err.message });
  }
});

/* ==========================================================================
   GET /api/list-models
   ========================================================================== */
app.get('/api/list-models', async (req, res) => {
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_KEY}`);
    const data = await r.json();
    if (!data.models) return res.json(data);
    const usable = data.models
      .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
      .map(m => m.name.replace('models/', ''));
    res.json({ count: usable.length, models: usable });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   POST /api/analyze-food
   ========================================================================== */
app.post('/api/analyze-food', async (req, res) => {
  try {
    if (!GEMINI_KEY) return res.status(500).json({ error: 'Server missing GEMINI_API_KEY.' });

    const { image } = req.body || {};
    const parsed = parseDataUrl(image);
    if (!parsed) return res.status(400).json({ error: 'No valid image received.' });

    const promptText = `You are a food-quality inspector for a food-donation platform.

Return ONLY a JSON object with exactly this shape (no markdown, no backticks):

{
  "isFood": boolean,
  "foodName": string | null,
  "foodCategory": string | null,
  "confidence": number | null,
  "detectedItems": [ { "name": string, "confidence": number } ],
  "freshnessScore": number | null,
  "freshnessLabel": string | null,
  "visibleSpoilageDetected": boolean | null,
  "visibleSpoilageNotes": string | null,
  "donationSuitability": "RECOMMENDED" | "MANUAL_REVIEW_REQUIRED" | "NOT_RECOMMENDED" | null,
  "reasoning": string,
  "pickupUrgency": "HIGH" | "MEDIUM" | "LOW" | null,
  "pickupWindow": string | null,
  "pickupReason": string | null
}

Rules:
1. If image is NOT food: isFood=false, all other food fields null, detectedItems=[], reasoning="The uploaded image does not appear to contain food."
2. If image IS food: fill every field. foodCategory one of "Prepared Meals","Bakery","Produce","Snacks","Dairy","Beverages","Other". donationSuitability: RECOMMENDED if freshness>=85, MANUAL_REVIEW_REQUIRED if 65-84, NOT_RECOMMENDED if <65.
3. Return ONLY the JSON.`;

    const MODEL_CANDIDATES = [
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash-lite',
      'gemini-flash-lite-latest',
      'gemini-3.1-flash-lite-preview',
      'gemini-3.8-flash',
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-flash-latest'
    ];

    let lastError = null;
    let responseText = null;
    let usedModel = null;

    for (const modelName of MODEL_CANDIDATES) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_KEY}`;
      const body = {
        contents: [{
          parts: [
            { text: promptText },
            { inline_data: { mime_type: parsed.mimeType, data: parsed.data } }
          ]
        }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
      };

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          const rawText = await r.text();

          if (r.ok) {
            let envelope;
            try { envelope = JSON.parse(rawText); }
            catch (e) { lastError = `Model ${modelName} returned non-JSON`; break; }

            const candidate = envelope.candidates && envelope.candidates[0];
            const part = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0];
            const text = part && part.text;
            if (text) { responseText = text; usedModel = modelName; break; }

            lastError = `Model ${modelName} returned empty text`;
            break;
          }

          console.error(`[model ${modelName}] attempt ${attempt} — HTTP ${r.status}: ${rawText.slice(0, 150)}`);
          lastError = `Model ${modelName}: HTTP ${r.status}`;

          if ((r.status === 503 || r.status === 500) && attempt === 1) {
            await sleep(2000);
            continue;
          }
          break;
        } catch (fetchErr) {
          lastError = `Model ${modelName}: network error`;
          if (attempt === 1) { await sleep(1500); continue; }
          break;
        }
      }
      if (responseText) break;
    }

    if (!responseText) {
      return res.status(500).json({ error: 'All AI models failed right now. Try again in 30 seconds.', detail: lastError });
    }

    console.log(`✅ AI responded using model: ${usedModel}`);

    let analysis;
    try { analysis = JSON.parse(responseText); }
    catch (e) {
      const cleaned = responseText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      try { analysis = JSON.parse(cleaned); }
      catch (e2) { return res.status(502).json({ error: 'AI returned unparseable response.', raw: responseText.slice(0, 500) }); }
    }

    res.json(analysis);
  } catch (err) {
    console.error('AI ERROR:', err.message);
    res.status(500).json({ error: 'AI analysis failed.', detail: err.message });
  }
});

/* ==========================================================================
   POST /api/donations — save a new donation
   ========================================================================== */
app.post('/api/donations', async (req, res) => {
  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });

    const payload = req.body || {};
    const donationId = payload.donationId || `FF-DON-${Math.floor(10000 + Math.random() * 90000)}`;

    /* ---------- Resolve donor (pickup) coords ---------- */
    let pickupCoords = payload.pickupCoords;
    const hasValidPickup = pickupCoords
      && pickupCoords.coordinates
      && Array.isArray(pickupCoords.coordinates)
      && pickupCoords.coordinates[0] !== 0;

    if (!hasValidPickup) {
      const fromCsv = donorCoordsByName(payload.donorName);
      if (fromCsv) {
        pickupCoords = { type: 'Point', coordinates: fromCsv };
        console.log(`📍 Resolved donor "${payload.donorName}" from CSV →`, fromCsv);
      } else {
        pickupCoords = { type: 'Point', coordinates: [0, 0] };
      }
    }

    /* ---------- Resolve ashram (delivery) coords from DB ---------- */
    let deliveryCoords = payload.deliveryCoords;
    const hasValidDelivery = deliveryCoords
      && deliveryCoords.coordinates
      && Array.isArray(deliveryCoords.coordinates)
      && deliveryCoords.coordinates[0] !== 0;

    if (!hasValidDelivery && payload.ashramName) {
      try {
        const a = await Ashram.findOne({ name: payload.ashramName }).lean();
        if (a && a.location && a.location.coordinates && a.location.coordinates[0] !== 0) {
          deliveryCoords = { type: 'Point', coordinates: a.location.coordinates };
          console.log(`🏛️ Resolved ashram "${payload.ashramName}" from DB →`, a.location.coordinates);
        } else {
          deliveryCoords = { type: 'Point', coordinates: [0, 0] };
        }
      } catch (e) {
        deliveryCoords = { type: 'Point', coordinates: [0, 0] };
      }
    }
    if (!deliveryCoords) deliveryCoords = { type: 'Point', coordinates: [0, 0] };

    const doc = await Donation.create({
      donationId,
      foodName:     payload.foodName     || 'Prepared Meal',
      foodCategory: payload.foodCategory || 'Prepared Meals',
      weightKg:     Number(payload.weightKg) || 0,
      servings:     Number(payload.servings) || 0,
      donorName:    payload.donorName    || 'Hotel Green Leaf',
      ashramName:   payload.ashramName   || 'Unassigned',
      driverName:   payload.driverName   || 'Unassigned',
      status:       payload.status       || 'Pending',
      matchScore:   Number(payload.matchScore) || 90,
      urgency:      payload.urgency      || 'MEDIUM',
      imageUrl:     payload.imageUrl     || '',
      aiAnalysis:   payload.aiAnalysis   || {},
      pickupCoords,
      deliveryCoords,
      createdAt:    payload.createdAt ? new Date(payload.createdAt) : new Date()
    });

    console.log('📥 New donation saved:', doc.donationId,
                '· pickup:', pickupCoords.coordinates,
                '· delivery:', deliveryCoords.coordinates);

    res.json({ ok: true, donation: doc });
  } catch (err) {
    console.error('POST /api/donations error:', err.message);
    res.status(500).json({ error: err.message });
  }
});
/* ==========================================================================
   GET /api/donations
   ========================================================================== */
app.get('/api/donations/available', async (req, res) => {
  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });
    const docs = await Donation.find({
      status: 'Pending',
      $or: [{ claimedBy: { $exists: false } }, { claimedBy: null }]
    }).sort({ createdAt: -1 }).limit(100).lean();
    res.json({ ok: true, count: docs.length, donations: docs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------- POST /api/claims ---------- */
app.post('/api/claims', async (req, res) => {
  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });
    const { donationId, ashramName, ashramEmail } = req.body || {};
    if (!donationId || !ashramName) {
      return res.status(400).json({ error: 'donationId and ashramName required.' });
    }
    const donation = await Donation.findOneAndUpdate(
      { donationId, status: 'Pending', $or: [{ claimedBy: { $exists: false } }, { claimedBy: null }] },
      { $set: { status: 'Claimed', claimedBy: ashramName, claimedAt: new Date() } },
      { new: true }
    );
    if (!donation) return res.status(409).json({ error: 'This donation is no longer available.' });

    const claimId = 'FF-CLM-' + Math.floor(10000 + Math.random() * 90000);
    const claim = await Claim.create({
      claimId, donationId, ashramName,
      ashramEmail: ashramEmail || '',
      donorName: donation.donorName,
      status: 'pending'
    });
    await Donation.updateOne({ donationId }, { $set: { claimId: claim.claimId } });
    console.log('📩 Claim created:', claim.claimId, '·', ashramName, '→', donationId);
    res.json({ ok: true, claim, donation });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'You have already claimed this donation.' });
    console.error('POST /api/claims error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ---------- GET /api/claims ---------- */
app.get('/api/claims', async (req, res) => {
  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });
    const donor  = (req.query.donor  || '').trim();
    const ashram = (req.query.ashram || '').trim();
    const status = (req.query.status || '').trim();
    const filter = {};
    if (donor)  filter.donorName  = new RegExp('^' + donor.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '$', 'i');
    if (ashram) filter.ashramName = new RegExp('^' + ashram.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '$', 'i');
    if (status) filter.status = status;
    const claims = await Claim.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    res.json({ ok: true, count: claims.length, claims });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------- POST /api/claims/:claimId/approve ---------- */
app.post('/api/claims/:claimId/approve', async (req, res) => {
  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });
    const claim = await Claim.findOne({ claimId: req.params.claimId });
    if (!claim) return res.status(404).json({ error: 'Claim not found.' });
    if (claim.status !== 'pending') return res.status(409).json({ error: 'Claim already decided.' });

    const donation = await Donation.findOne({ donationId: claim.donationId });
    if (!donation) return res.status(404).json({ error: 'Donation not found.' });

    /* ---------- Automatic driver assignment ----------
       Pick the nearest AVAILABLE driver who is NOT currently
       on another mission. Falls back to any available driver. */
    let driver = null;
    const pickup = donation.pickupCoords && donation.pickupCoords.coordinates;

    try {
      if (pickup && pickup[0] !== 0) {
        /* Nearest available, idle driver with a known location */
        driver = await Driver.findOne({
          available: true,
          currentDonation: null,
          'location.coordinates.0': { $ne: 0 },
          location: {
            $near: {
              $geometry:    { type: 'Point', coordinates: pickup },
              $maxDistance: 50000   /* 50 km */
            }
          }
        }).lean();
      }
    } catch (e) { /* no driver found by geo search */ }

    /* Fallback 1: any available idle driver */
    if (!driver) {
      driver = await Driver.findOne({
        available: true,
        currentDonation: null
      }).lean();
    }

    /* Fallback 2: any available driver at all */
    if (!driver) {
      driver = await Driver.findOne({ available: true }).lean();
    }

    const driverId   = driver ? driver.userId : null;
    const driverName = driver ? driver.name   : 'Unassigned';
    const now        = new Date();

    if (driver) {
      await Driver.updateOne(
        { userId: driver.userId },
        { $set: { currentDonation: donation.donationId, available: false } }
      );
    }

    claim.status    = 'approved';
    claim.driverId  = driverId;
    claim.decidedAt = now;
    await claim.save();

    /* Look up the approved Ashram's coordinates so delivery tracking works */
    let deliveryCoords = donation.deliveryCoords;
    try {
      const ashramDoc = await Ashram.findOne({ name: claim.ashramName }).lean();
      if (ashramDoc && ashramDoc.location && ashramDoc.location.coordinates && ashramDoc.location.coordinates[0] !== 0) {
        deliveryCoords = { type: 'Point', coordinates: ashramDoc.location.coordinates };
      }
    } catch (e) {}

    const updated = await Donation.findOneAndUpdate(
      { donationId: donation.donationId },
      {
        $set: {
          status: 'Approved',
          ashramName: claim.ashramName,
          driverId,
          driverName,
          approvedAt: now,
          deliveryCoords,
          claimedBy: claim.ashramName
        },
        $push: {
          statusHistory: {
            $each: [
              { status: 'Approved',          at: now, by: 'donor' },
              { status: 'Driver Auto-Assigned', at: now, by: 'system:' + driverName }
            ]
          }
        }
      },
      { new: true }
    );
    await Claim.updateMany(
      { donationId: donation.donationId, status: 'pending', claimId: { $ne: claim.claimId } },
      { $set: { status: 'rejected', decidedAt: now } }
    );

    try {
      io.to('donation:' + donation.donationId).emit('donation:status', {
        donationId: donation.donationId, status: updated.status, at: now.toISOString()
      });
    } catch (e) {}

    console.log('✅ Claim approved:', claim.claimId, '· driver:', driverName);
    res.json({ ok: true, claim, donation: updated, driver: driver ? { userId: driver.userId, name: driver.name } : null });
  } catch (err) {
    console.error('Approve claim error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ---------- POST /api/claims/:claimId/reject ---------- */
app.post('/api/claims/:claimId/reject', async (req, res) => {
  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });
    const claim = await Claim.findOne({ claimId: req.params.claimId });
    if (!claim) return res.status(404).json({ error: 'Claim not found.' });
    if (claim.status !== 'pending') return res.status(409).json({ error: 'Claim already decided.' });

    const now = new Date();
    claim.status    = 'rejected';
    claim.decidedAt = now;
    await claim.save();

    const updated = await Donation.findOneAndUpdate(
      { donationId: claim.donationId },
      {
        $set: { status: 'Pending', claimedBy: null, claimId: null },
        $push: { statusHistory: { status: 'Rejected', at: now, by: 'donor' } }
      },
      { new: true }
    );

    try {
      io.to('donation:' + claim.donationId).emit('donation:status', {
        donationId: claim.donationId, status: 'Pending', at: now.toISOString()
      });
    } catch (e) {}

    console.log('❌ Claim rejected:', claim.claimId);
    res.json({ ok: true, claim, donation: updated });
  } catch (err) {
    console.error('Reject claim error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/donations', async (req, res) => {
  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });

    const donor  = (req.query.donor  || '').trim();
    const driver = (req.query.driver || '').trim();

    const filter = {};
    if (donor) {
      filter.donorName = { $regex: '^' + donor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', $options: 'i' };
    }
    if (driver) {
      /* Match either driverId (email) OR driverName (fallback) */
      filter.$or = [
        { driverId:   driver },
        { driverName: driver }
      ];
    }

    const docs = await Donation.find(filter).sort({ createdAt: -1 }).limit(200);
    res.json({ ok: true, count: docs.length, donations: docs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/drivers/availability', async (req, res) => {
  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });
    const { userId, available } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required.' });
    await Driver.findOneAndUpdate(
      { userId },
      { $set: { available: !!available } },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   GET /api/drivers/me — driver profile + their assigned donations count
   ========================================================================== */
app.get('/api/drivers/me', async (req, res) => {
  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });
    const userId = (req.query.userId || '').trim();
    if (!userId) return res.status(400).json({ error: 'Missing ?userId=' });
    const driver = await Driver.findOne({ userId }).lean();
    res.json({ ok: true, driver });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   PATCH /api/donations/:id
   ========================================================================== */
app.patch('/api/donations/:id', async (req, res) => {
  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });
    const doc = await Donation.findOneAndUpdate(
      { donationId: req.params.id },
      { $set: req.body || {} },
      { new: true }
    );
    if (!doc) return res.status(404).json({ error: 'Donation not found.' });
    res.json({ ok: true, donation: doc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   USER ROUTES — register / me / settings / delete
   ========================================================================== */

/* ==========================================================================
   POST /api/auth/admin-login
   Admin-only login endpoint. Rejects anyone whose role is not 'admin'.
   ========================================================================== */
app.post('/api/auth/admin-login', async (req, res) => {
  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });

    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    /* Only look for users whose role is exactly 'admin' */
    const user = await User.findOne({
      email: email.toLowerCase().trim(),
      role: 'admin'
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid admin credentials.' });
    }

    /* Verify password */
    let ok = false;
    try {
      const bcrypt = require('bcryptjs');
      ok = await bcrypt.compare(password, user.passwordHash || '');
    } catch (e) {
      ok = (user.passwordHash === password);
    }
    if (!user.passwordHash) ok = (password === 'admin123');
    if (!ok) return res.status(401).json({ error: 'Invalid admin credentials.' });

    console.log('🔐 Admin login:', user.email);

    res.json({
      ok: true,
      user: {
        name:      user.name,
        email:     user.email,
        role:      'admin',
        roleLabel: 'Admin',
        avatar:    user.avatar || '⚡',
        verified:  user.verified || 'Admin'
      }
    });
  } catch (err) {
    console.error('admin-login error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   Admin middleware — protects all /api/admin/* routes
   ========================================================================== */
function requireAdmin(req, res, next) {
  /* The frontend sends the logged-in email in a header */
  const email = (req.headers['x-user-email'] || '').toLowerCase().trim();
  if (!email) return res.status(401).json({ error: 'Missing x-user-email header.' });

  User.findOne({ email })
    .then(user => {
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required.' });
      }
      req.admin = user;
      next();
    })
    .catch(err => res.status(500).json({ error: err.message }));
}

/* ==========================================================================
   Admin — list all users
   ========================================================================== */
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });
    const users = await User.find({ role: { $ne: 'admin' } })
      .select('-passwordHash -settings')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    res.json({ ok: true, count: users.length, users });
  } catch (err) {
    console.error('GET /api/admin/users error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   Admin — list all drivers
   ========================================================================== */
app.get('/api/admin/drivers', requireAdmin, async (req, res) => {
  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });
    const drivers = await Driver.find().sort({ lastUpdate: -1 }).limit(500).lean();
    res.json({ ok: true, count: drivers.length, drivers });
  } catch (err) {
    console.error('GET /api/admin/drivers error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   Sample protected admin API — replace/extend with your real admin logic
   ========================================================================== */
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });

    const [totalUsers, totalDonations, totalAshrams, totalDrivers, pending, inTransit, delivered, rejected] =
      await Promise.all([
        User.countDocuments(),
        Donation.countDocuments(),
        Ashram.countDocuments(),
        Driver.countDocuments(),
        Donation.countDocuments({ status: 'Pending' }),
        Donation.countDocuments({ status: { $in: ['Accepted','In Transit','Picked Up'] } }),
        Donation.countDocuments({ status: 'Delivered' }),
        Donation.countDocuments({ status: 'Rejected' })
      ]);

    res.json({
      ok: true,
      stats: {
        totalUsers, totalDonations, totalAshrams, totalDrivers,
        pending, inTransit, delivered, rejected
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------- POST /api/auth/login ---------- */
app.post('/api/auth/login', async (req, res) => {
  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });

    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    let ok = false;
    try {
      const bcrypt = require('bcryptjs');
      ok = await bcrypt.compare(password, user.passwordHash || '');
    } catch (e) {
      ok = (user.passwordHash === password);
    }

    if (!user.passwordHash) ok = true;

    if (user.role === 'admin' && !user.passwordHash) {
      ok = (password === 'admin123');
    }

    if (!ok) return res.status(401).json({ error: 'Invalid email or password.' });

    res.json({
      ok: true,
      user: {
        name:      user.name,
        email:     user.email,
        phone:     user.phone,
        role:      user.role,
        roleLabel: user.roleLabel,
        avatar:    user.avatar,
        verified:  user.verified,
        org:       user.org,
        orgType:   user.orgType,
        address:   user.address,
        residents: user.residents,
        needs:     user.needs,
        vehicle:   user.vehicle,
        license:   user.license,
        area:      user.area
      }
    });
  } catch (err) {
    console.error('POST /api/auth/login error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* POST /api/users/register */
app.post('/api/users/register', async (req, res) => {
  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });

    const body = req.body || {};
    const email = (body.email || '').toLowerCase().trim();
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required.' });
    }

    if (body.role === 'admin') {
      const requesterRole = (req.headers['x-user-role'] || '').toLowerCase();
      if (requesterRole !== 'admin') {
        return res.status(403).json({ error: 'Admin accounts cannot be self-registered.' });
      }
    }

    const update = {
      name:      body.name      || 'User',
      phone:     body.phone     || '',
      role:      body.role      || 'donor',
      roleLabel: body.roleLabel || 'Food Donor',
      avatar:    body.avatar    || '👤',
      verified:  body.verified  || 'Pending verification',
      org:       body.org       || '',
      orgType:   body.orgType   || '',
      address:   body.address   || '',
      residents: body.residents || '',
      needs:     body.needs     || '',
      vehicle:   body.vehicle   || '',
      license:   body.license   || '',
      area:      body.area      || '',
      updatedAt: new Date()
    };

    const user = await User.findOneAndUpdate(
      { email },
      { $set: update, $setOnInsert: { createdAt: new Date() } },
      { new: true, upsert: true }
    );

    const safeUser = user.toObject();
    delete safeUser.passwordHash;

    console.log('👤 User registered/updated:', user.email, '·', user.role);
    res.json({ ok: true, user: safeUser });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* GET /api/users/me?email=... */
app.get('/api/users/me', async (req, res) => {
  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });
    const email = (req.query.email || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ error: 'Missing ?email=' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    res.json({ ok: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* GET /api/users/settings?email=... */
app.get('/api/users/settings', async (req, res) => {
  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });
    const email = (req.query.email || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ error: 'Missing ?email=' });

    const user = await User.findOne({ email }, 'settings language').lean();
    if (!user) return res.status(404).json({ error: 'User not found.' });

    res.json({ ok: true, settings: user.settings, language: user.language });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* PATCH /api/users/settings?email=... */
app.patch('/api/users/settings', async (req, res) => {
  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });

    const email = (req.query.email || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ error: 'Missing ?email=' });

    const body = req.body || {};
    const $set = { updatedAt: new Date() };

    if (body.notifications) {
      Object.entries(body.notifications).forEach(([k, v]) => {
        $set[`settings.notifications.${k}`] = !!v;
      });
    }
    if (body.privacy) {
      Object.entries(body.privacy).forEach(([k, v]) => {
        $set[`settings.privacy.${k}`] = !!v;
      });
    }
    if (body.security) {
      Object.entries(body.security).forEach(([k, v]) => {
        $set[`settings.security.${k}`] = !!v;
      });
    }
    if (body.appearance) {
      if (body.appearance.theme) $set['settings.appearance.theme'] = body.appearance.theme;
      if ('reduceMotion' in body.appearance) $set['settings.appearance.reduceMotion'] = !!body.appearance.reduceMotion;
      if ('compact' in body.appearance)      $set['settings.appearance.compact']      = !!body.appearance.compact;
    }
    if (body.name)     $set.name     = body.name;
    if (body.phone)    $set.phone    = body.phone;
    if (body.language) $set.language = body.language;

    const user = await User.findOneAndUpdate({ email }, { $set }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found.' });

    console.log('⚙️ Settings saved for', email);
    res.json({ ok: true, user });
  } catch (err) {
    console.error('Settings PATCH error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* DELETE /api/users/me?email=... */
app.delete('/api/users/me', async (req, res) => {
  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });
    const email = (req.query.email || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ error: 'Missing ?email=' });

    const result = await User.deleteOne({ email });
    res.json({ ok: true, deleted: result.deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* GET /api/users/pending */
app.get('/api/users/pending', async (req, res) => {
  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });
    const users = await User.find({
      verified: { $regex: /pending/i },
      role:     { $ne: 'admin' }
    }).sort({ createdAt: -1 }).limit(200).lean();
    res.json({ ok: true, count: users.length, users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* PATCH /api/users/:id/verify */
app.patch('/api/users/:id/verify', async (req, res) => {
  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });
    const { verified } = req.body || {};
    if (!verified) return res.status(400).json({ error: 'Missing verified field.' });

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { verified, updatedAt: new Date() } },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: 'User not found.' });

    console.log('✅ User verification updated:', user.email, '·', verified);
    res.json({ ok: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   POST /api/chat — AI chatbot endpoint
   ========================================================================== */
const FF_KNOWLEDGE = `
# PLATFORM IDENTITY
FeedFoodForward is an AI-powered surplus food redistribution platform. It connects food donors (hotels, restaurants, cafés, bakeries, banquet halls, cloud kitchens, event organizers) with verified receivers (ashrams, Vruddhashrams / old age homes, Anath Ashrams / orphanages, NGOs, shelters) through trained delivery drivers.

Everything runs on one platform: photo-based AI inspection (Google Gemini), smart receiver matching, real-time GPS tracking (Leaflet + OSM + Socket.IO), and QR-verified handover at both ends.

# MISSION
"Rescue Food. Reduce Waste. Feed Communities."
Free for everyone — no commissions, no subscriptions, no hidden charges.

# 4 USER ROLES
1. Donor — hotels, restaurants, cafés, bakeries, event organizers. Creates donations via 5-step wizard.
2. Ashram/NGO — receivers like old-age homes, orphanages, shelters. Shows Delivery QR at handover.
3. Driver — trained delivery partner with GPS + QR scanning. Physically verifies every donation.
4. Admin — platform oversight. Created only by the platform owner (no self-registration).

# 5-STEP DONATION FLOW
1. Upload a photo (JPG, PNG, or WEBP under 5 MB).
2. Add details: food name, category, quantity (kg), servings, prepared-at time, pickup deadline, storage condition (Room temp / Refrigerated / Frozen), pickup address.
3. AI pre-screening — Gemini estimates food type, freshness (0–100), visible spoilage, and pickup urgency (HIGH / MEDIUM / LOW). Not a safety guarantee.
4. Smart matching suggests nearest suitable receiver by distance and their current need.
5. Pickup QR generated. Driver scans it at collection. Delivery QR is activated for the receiver at handover.

# AI INSPECTION
- Powered by Google Gemini vision models.
- Detects whether an image actually contains food (rejects non-food).
- Estimates freshness score with labels: Excellent (85+), Good (78–85), Moderately Fresh (68–78), Needs Review (<68).
- Flags possible visible spoilage.
- Suggests donationSuitability: RECOMMENDED / MANUAL_REVIEW_REQUIRED / NOT_RECOMMENDED.
- Suggests pickupUrgency: HIGH / MEDIUM / LOW.
- Always reminds users: AI is a pre-screen, NOT a safety guarantee. The driver makes the final safety call.

# SAFETY RULES
- Only safe, freshly-prepared, well-stored food should be donated.
- Every donation is physically inspected by the driver at pickup.
- Driver checks: smell, appearance, packaging integrity, temperature, and prep time.
- If the driver rejects the food, the delivery is cancelled immediately.
- Never donate food that is spoiled, has been sitting out for hours, or is unsafe to eat.

# QR VERIFICATION SYSTEM
Two QR codes secure the chain of custody:
- Pickup QR: shown by donor → scanned by driver at pickup.
- Delivery QR: shown by receiver → scanned by driver at handover.
Both are JSON payloads containing type + donationId. Wrong QRs are blocked.

# LEADERBOARD & BADGES
Donors earn badges based on total food rescued:
- 🏆 Food Hero — 1,000+ KG
- 🌿 Green Champion — 800+ KG
- ⭐ Consistent Rescuer — 30+ donations
- 🤝 Community Champion — multi-ashram support
- 🌱 Rescue Leader — 500+ KG
Leaderboard has "This Month" and "All Time" views.

# IMPACT & CSR
The Impact & CSR page shows:
- Total food rescued (KG)
- Meals served (est. 1 kg ≈ 2.5 meals)
- CO₂ emissions prevented
- Water equivalent saved
- Landfill space saved
- Printable CSR report for corporate filings
All figures are DIRECTIONAL ESTIMATES based on FAO/EPA food-waste conversion factors.

# PAGES (link to these when relevant)
- index.html — Home with live rescue activity
- donate-food.html — 5-step wizard
- ai-inspection.html — AI results viewer
- find-ashrams.html — 149+ verified ashrams & NGOs directory
- rescue-track.html — Live GPS map + Track Delivery tab
- driver-hub.html — Mission control, QR scanning, navigation
- donor-dashboard.html — Donor overview page
- my-donations.html — Full donation history with search + filters
- ngo-dashboard.html — Receiver incoming donations + Delivery QR
- leaderboard.html — Top donors + badges
- impact-csr.html — Impact metrics + CSR report
- profile.html — Profile editing
- settings.html — Account, notifications, privacy, security, appearance
- admin-portal.html — Admin oversight
- feedback.html — Feedback form
- help.html — Getting Started guide

# DONOR DASHBOARD (donor-dashboard.html)
This is the donor's activity overview page. It shows:
- A personalized welcome with the donor's name
- 4 summary stat cards: Total Donations, Meals Donated, Active Donations, Completed Donations (each with an animated count-up)
- A "Recent Donations" panel showing the latest 5 donations, each with food name, weight, servings, relative date, status badge, and a View link
- A "My Impact" panel showing Meals Provided, Food Waste Reduced (KG), and Donation Contribution percentage
- A "+ New Donation" button that jumps to donate-food.html
- A "View All →" link that jumps to my-donations.html
- A "Full Impact Report →" link that jumps to impact-csr.html
- Auto-refreshes every 30 seconds

# MY DONATIONS PAGE (my-donations.html)
This is the donor's full donation history. Features:
- A search bar that searches by food name / category
- Status filter buttons: All, Pending, In Progress, Completed, Rejected
- A "Showing X of Y donations" counter
- Each donation card shows: food thumbnail, food name, status badge, weight (kg), servings, relative date, assigned ashram, assigned driver, donation ID, and action buttons
- Action buttons per card: "View Details" (opens modal), "📄 Receipt" (only for completed), "🚚 Track" (only for in-progress)
- The View Details modal shows the full breakdown (food, category, weight, servings, donor, ashram, driver, created date, urgency) plus action buttons
- Download Receipt generates a styled PDF with the donation ID, food details, donor, receiver, driver, and a QR code linking back to the platform
- Auto-refreshes every 30 seconds

# DONATION STATUS MEANINGS
- Pending (🟡) — donation created, waiting for a driver to accept
- Accepted (🔵) — a driver has accepted the mission
- In Progress / In Transit (🔵) — food picked up, driver heading to receiver
- Completed / Delivered (🟢) — received by ashram, receipt available
- Rejected (🔴) — driver rejected the food at pickup (unsafe food)
- Cancelled (🔴) — donor or system cancelled the donation

# TECH STACK (if asked)
Node.js + Express backend, MongoDB with geospatial indexing, Google Gemini AI for vision, Leaflet + OpenStreetMap for maps, Nominatim geocoding, OSRM routing, Socket.IO real-time tracking, html2pdf.js for receipts.

# DATA SOURCE
Ashram and restaurant data from OpenStreetMap (Overpass API), geocoded via Nominatim, stored in MongoDB with 2dsphere indexes. Currently 149 verified ashrams in the Mumbai region.

# CITIES
Live in: Mumbai + surrounding areas. Additional cities in dataset (Pune, Nagpur, Nashik, Bengaluru, Delhi, Chennai, Hyderabad, Kolkata, Ahmedabad) ready to enable.

# ACCOUNT & SETTINGS
- Login/Signup: click the buttons in the top-right header
- Admin accounts: created only by the platform owner — cannot be self-registered
- Password reset: via "Forgot password?" on the login modal
- Delete account: Settings → Danger Zone → type DELETE to confirm
- Download data: Settings → Danger Zone → Download My Data
- Receipts: My Donations → completed donation → 📄 Receipt button

# TROUBLESHOOTING (common issues)
- Image upload fails → use JPG/PNG/WEBP under 5 MB, refresh, try another browser
- "No food detected" → better lighting, centre the food, avoid blurry shots
- QR won't scan → brighten screen, clean lens, hold 15 cm away, use Simulate Scan fallback
- Can't see donations → check user chip top-right, log out + log back in, ensure filter is set to "All", clear the search box
- My Donations is empty → you may not have created any donations yet; click "+ New Donation" to start
- Map won't load → check internet, disable ad-blockers, reload
- No driver assigned yet → matching is automatic, usually 5–10 min
- Delivery delayed → open Rescue & Track, use Report an Issue button

# CONTACT / SUPPORT
- Email: support@feedfoodforward.demo
- Phone: +91 98123 45678
- Feedback form: feedback.html
- Getting Started guide: help.html

# RESPONSE RULES (VERY IMPORTANT)
- Warm, friendly, concise. 2–4 sentences max unless listing multiple items.
- Plain English. No markdown headings, no code blocks, no bullet symbols (use "•" or "1️⃣ 2️⃣ 3️⃣" for lists).
- You MAY include HTML links like <a href="page.html">page.html</a> when pointing to a page.
- 0–2 emojis per reply.
- Never invent features. If unsure, say: "I'm not certain — please email support@feedfoodforward.demo."
- Politely redirect off-topic questions (politics, news, coding, sports, etc.) back to FeedFoodForward topics.
- NEVER claim the AI inspection replaces human safety verification.
- NEVER promise features that don't exist on this platform.
- If the user asks about their specific donation/delivery, tell them to check the relevant page (My Donations, Rescue & Track) since you don't have access to their live data.
`;

app.post('/api/chat', async (req, res) => {
  try {
    if (!GEMINI_KEY) {
      return res.json({ ok: false, reply: null, reason: 'no-api-key' });
    }

    const { message, history } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Missing message.' });
    }

    const contents = [];

    contents.push({
      role: 'user',
      parts: [{ text:
        FF_KNOWLEDGE +
        '\n\nAcknowledge with a single word: "ready".'
      }]
    });
    contents.push({
      role: 'model',
      parts: [{ text: 'ready' }]
    });

    const safeHistory = Array.isArray(history) ? history.slice(-10) : [];
    safeHistory.forEach(turn => {
      if (!turn || !turn.text) return;
      const role = turn.role === 'bot' ? 'model' : 'user';
      contents.push({
        role,
        parts: [{ text: String(turn.text).slice(0, 800) }]
      });
    });

    contents.push({
      role: 'user',
      parts: [{ text: message.slice(0, 800) }]
    });

    const MODEL_CANDIDATES = [
      'gemini-flash-latest',
      'gemini-2.0-flash',
      'gemini-flash-lite-latest',
      'gemini-2.5-flash-lite',
      'gemini-1.5-flash-latest'
    ];

    let reply = null;
    let usedModel = null;
    let lastError = null;

    for (const modelName of MODEL_CANDIDATES) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_KEY}`;

      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            generationConfig: {
              temperature: 0.55,
              topP: 0.9,
              topK: 40,
              maxOutputTokens: 400
            },
            safetySettings: [
              { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_ONLY_HIGH' },
              { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_ONLY_HIGH' },
              { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
              { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }
            ]
          })
        });

        if (!r.ok) {
          const txt = await r.text();
          console.warn(`Chat model ${modelName} HTTP ${r.status}:`, txt.slice(0, 150));
          lastError = `HTTP ${r.status}`;
          continue;
        }

        const data = await r.json();
        const cand = data.candidates && data.candidates[0];
        const part = cand && cand.content && cand.content.parts && cand.content.parts[0];
        const text = part && part.text;

        if (text && text.trim()) {
          reply = text.trim();
          usedModel = modelName;
          break;
        }
        lastError = 'empty reply';
      } catch (err) {
        console.warn(`Chat model ${modelName} error:`, err.message);
        lastError = err.message;
      }
    }

    if (!reply) {
      return res.json({ ok: false, reply: null, error: lastError });
    }

    console.log(`💬 Chat replied via ${usedModel}`);
    res.json({ ok: true, reply, model: usedModel });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.json({ ok: false, reply: null, error: err.message });
  }
});

/* ==========================================================================
   ISSUE REPORTS
   ========================================================================== */

app.post('/api/issues', async (req, res) => {
  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });
    const body = req.body || {};
    if (!body.type) return res.status(400).json({ error: 'Issue type is required.' });

    const issueId = 'FF-ISS-' + Math.floor(10000 + Math.random() * 90000);

    const doc = await Issue.create({
      issueId,
      type:          body.type,
      details:       body.details || '',
      donationId:    body.donationId || '',
      reporter:      body.reporter || 'Anonymous',
      reporterEmail: body.reporterEmail || ''
    });

    console.log('🚨 Issue reported:', doc.issueId, '·', doc.type);
    res.json({ ok: true, issue: doc });
  } catch (err) {
    console.error('POST /api/issues error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/issues', async (req, res) => {
  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });
    const status = (req.query.status || '').trim();
    const filter = status ? { status } : {};
    const issues = await Issue.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    res.json({ ok: true, count: issues.length, issues });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/issues/:id', async (req, res) => {
  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });
    const doc = await Issue.findOneAndUpdate(
      { issueId: req.params.id },
      { $set: req.body || {} },
      { new: true }
    );
    if (!doc) return res.status(404).json({ error: 'Issue not found.' });
    res.json({ ok: true, issue: doc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==========================================================================
   SOCKET.IO — real-time donation tracking
   ========================================================================== */
const http     = require('http');
const server   = http.createServer(app);
const { Server } = require('socket.io');
const io       = new Server(server, { cors: { origin: '*', methods: ['GET','POST'] } });

io.on('connection', (socket) => {
  console.log('🔌 Socket connected:', socket.id);

  socket.on('join:donation', async ({ donationId, role, userId }) => {
    if (!donationId) return;
    try {
      if (!mongoConnected) return;
      const d = await Donation.findOne({ donationId }).lean();
      if (!d) return socket.emit('error:join', { message: 'Donation not found' });

      const authorised =
        (role === 'donor'  && d.donorName  === userId) ||
        (role === 'driver' && d.driverId   === userId) ||
        (role === 'ashram' && d.ashramName === userId) ||
        role === 'admin';
      if (!authorised) return socket.emit('error:join', { message: 'Not authorised' });

      socket.join('donation:' + donationId);
      socket.emit('joined:donation', { donationId, status: d.status });
    } catch (err) { console.error('join:donation failed:', err.message); }
  });

  socket.on('disconnect', () => console.log('🔌 Socket disconnected:', socket.id));
});

/* ==========================================================================
   DRIVER REGISTRATION & LIVE LOCATION
   ========================================================================== */
app.post('/api/drivers/register', async (req, res) => {
  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });
    const { userId, name, vehicle, phone, rating } = req.body || {};
    if (!userId || !name) return res.status(400).json({ error: 'userId and name required.' });

    const driver = await Driver.findOneAndUpdate(
      { userId },
      { $set: {
          name,
          vehicle: vehicle || 'EV Cargo Van',
          phone:   phone   || '',
          rating:  Number(rating) || 4.9
      } },
      { new: true, upsert: true }
    );
    res.json({ ok: true, driver });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/drivers/location', async (req, res) => {
  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });
    const { userId, lat, lng, accuracy, donationId } = req.body || {};
    if (!userId || typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'userId, lat, lng required.' });
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'Invalid coordinates.' });
    }

    const now = new Date();
    const driver = await Driver.findOneAndUpdate(
      { userId },
      { $set: {
          location:   { type: 'Point', coordinates: [lng, lat] },
          accuracy:   Number(accuracy) || null,
          lastUpdate: now
      } },
      { new: true }
    );
    if (!driver) return res.status(404).json({ error: 'Driver not registered.' });

    let activeDonationId = donationId || driver.currentDonation;
    if (activeDonationId) {
      const d = await Donation.findOneAndUpdate(
        { donationId: activeDonationId, driverId: userId },
        { $set: {
            lastDriverLocation: { type: 'Point', coordinates: [lng, lat] },
            lastDriverUpdate:   now
        } },
        { new: true }
      );
      if (d) {
        io.to('donation:' + d.donationId).emit('driver:location', {
          donationId: d.donationId,
          lat, lng,
          accuracy: Number(accuracy) || null,
          timestamp: now.toISOString()
        });
      }
    }
    res.json({ ok: true, updatedAt: now });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/drivers/live', async (req, res) => {
  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });
    const cutoff = new Date(Date.now() - 5 * 60 * 1000);
    const drivers = await Driver.find({
      lastUpdate: { $gte: cutoff },
      'location.coordinates.0': { $ne: 0 }
    }).limit(200).lean();
    res.json({ ok: true, count: drivers.length, drivers });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ==========================================================================
   DONATION TRACKING — full state endpoint
   ========================================================================== */
app.get('/api/donations/track/:donationId', async (req, res) => {
  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });
    const d = await Donation.findOne({ donationId: req.params.donationId }).lean();
    if (!d) return res.status(404).json({ error: 'Donation not found.' });

    let driver = null;
    if (d.driverId) driver = await Driver.findOne({ userId: d.driverId }).lean();
    res.json({ ok: true, donation: d, driver });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ==========================================================================
   DONATION STATUS TRANSITIONS
   ========================================================================== */
async function transitionDonation(filter, newStatus, by, extra = {}) {
  const now = new Date();
  return Donation.findOneAndUpdate(
    filter,
    {
      $set: Object.assign({ status: newStatus }, extra),
      $push: { statusHistory: { status: newStatus, at: now, by } }
    },
    { new: true }
  );
}

app.post('/api/donations/:id/accept', async (req, res) => {
  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });
    const { driverId } = req.body || {};
    if (!driverId) return res.status(400).json({ error: 'driverId required.' });

    const donationId = req.params.id;

    /* Find the donation first so we can give helpful error messages */
    const existing = await Donation.findOne({ donationId });
    if (!existing) {
      return res.status(404).json({ error: 'Donation not found.' });
    }

    /* Already accepted by someone else? */
    if (existing.driverId && existing.driverId !== driverId) {
      return res.status(409).json({ error: 'This mission was already accepted by another driver.' });
    }

    /* Already accepted by THIS driver? Just return success (idempotent). */
    if (existing.driverId === driverId) {
      return res.json({ ok: true, donation: existing });
    }

    /* Do the atomic update — accept ANY donation without a driver */
    const d = await Donation.findOneAndUpdate(
      { donationId: donationId, $or: [{ driverId: null }, { driverId: { $exists: false } }] },
      {
        $set: {
          driverId: driverId,
          driverName: (await Driver.findOne({ userId: driverId }).lean() || {}).name || 'Driver',
          status: 'Accepted',
          acceptedAt: new Date(),
          rejectReason: null
        },
        $push: { statusHistory: { status: 'Accepted', at: new Date(), by: driverId } }
      },
      { new: true }
    );

    if (!d) {
      return res.status(409).json({ error: 'This mission was just accepted by another driver.' });
    }

    await Driver.findOneAndUpdate(
      { userId: driverId },
      { $set: { currentDonation: d.donationId, available: false } },
      { upsert: true }
    );

    io.to('donation:' + d.donationId).emit('donation:status', {
      donationId: d.donationId, status: d.status, at: new Date().toISOString()
    });
    res.json({ ok: true, donation: d });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/donations/:id/pickup-verify', async (req, res) => {
  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });
    const { driverId, qrData } = req.body || {};
    if (!driverId || !qrData) return res.status(400).json({ error: 'driverId and qrData required.' });

    let parsed;
    try { parsed = JSON.parse(qrData); }
    catch (e) { return res.status(400).json({ error: 'QR is not valid JSON.' }); }
    if (parsed.type !== 'PICKUP') return res.status(400).json({ error: 'Not a pickup QR.' });
    if (parsed.donationId !== req.params.id) return res.status(400).json({ error: 'QR does not match this donation.' });

    const d = await Donation.findOne({ donationId: req.params.id });
    if (!d) return res.status(404).json({ error: 'Donation not found.' });
    if (['Picked Up','In Transit','Delivered'].includes(d.status)) {
      return res.status(409).json({ error: 'Already picked up or delivered.' });
    }
    if (d.driverId && d.driverId !== driverId) {
      return res.status(403).json({ error: 'Not the assigned driver.' });
    }

    const now = new Date();
    const updated = await transitionDonation(
      { donationId: req.params.id },
      'In Transit',
      driverId,
      { pickupVerifiedAt: now, pickupVerifiedBy: driverId, driverId }
    );
    io.to('donation:' + updated.donationId).emit('donation:status', {
      donationId: updated.donationId, status: updated.status, at: now.toISOString()
    });
    res.json({ ok: true, donation: updated });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/donations/:id/delivery-verify', async (req, res) => {
  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });
    const { ashramName, qrData } = req.body || {};
    if (!ashramName || !qrData) return res.status(400).json({ error: 'ashramName and qrData required.' });

    let parsed;
    try { parsed = JSON.parse(qrData); }
    catch (e) { return res.status(400).json({ error: 'QR is not valid JSON.' }); }
    if (parsed.type !== 'DELIVERY') return res.status(400).json({ error: 'Not a delivery QR.' });
    if (parsed.donationId !== req.params.id) return res.status(400).json({ error: 'QR does not match this donation.' });

    const d = await Donation.findOne({ donationId: req.params.id });
    if (!d) return res.status(404).json({ error: 'Donation not found.' });
    if (d.status === 'Delivered') return res.status(409).json({ error: 'Already delivered.' });
    if (!['In Transit','Picked Up'].includes(d.status)) {
      return res.status(409).json({ error: 'Food has not been picked up yet.' });
    }

    const now = new Date();
    const updated = await transitionDonation(
      { donationId: req.params.id },
      'Delivered',
      ashramName,
      { deliveryVerifiedAt: now, deliveryVerifiedBy: ashramName }
    );

    if (updated.driverId) {
      await Driver.findOneAndUpdate(
        { userId: updated.driverId },
        { $set: { currentDonation: null, available: true } }
      );
    }
    io.to('donation:' + updated.donationId).emit('donation:status', {
      donationId: updated.donationId, status: updated.status, at: now.toISOString()
    });
    res.json({ ok: true, donation: updated });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/donations/:id/reject', async (req, res) => {
  try {
    if (!mongoConnected) return res.status(503).json({ error: 'MongoDB not connected.' });
    const { driverId, reason } = req.body || {};
    if (!driverId) return res.status(400).json({ error: 'driverId required.' });

    const updated = await transitionDonation(
      { donationId: req.params.id, status: { $nin: ['Delivered','Rejected'] } },
      'Rejected',
      driverId,
      { rejectReason: reason || 'Food did not meet requirements' }
    );
    if (!updated) return res.status(409).json({ error: 'Cannot reject in current state.' });

    await Driver.findOneAndUpdate(
      { userId: driverId },
      { $set: { currentDonation: null, available: true } }
    );
    io.to('donation:' + updated.donationId).emit('donation:status', {
      donationId: updated.donationId, status: 'Rejected', at: new Date().toISOString()
    });
    res.json({ ok: true, donation: updated });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ==========================================================================
   API 404 guard
   ========================================================================== */
app.use('/api', (req, res) => {
  res.status(404).json({
    ok: false,
    error: 'API endpoint not found: ' + req.method + ' ' + req.path
  });
});

/* ==========================================================================
   HTML fallback — MUST stay last
   ========================================================================== */
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

/* ==========================================================================
   Start
   ========================================================================== */
connectMongo().then(async () => {
  await ensureAdminAccount();
  server.listen(PORT, () => {
    console.log('');
    console.log('  ✅ FeedFoodForward is running!');
    console.log(`  🌐 Open: http://localhost:${PORT}`);
    console.log(`  🤖 AI endpoint: http://localhost:${PORT}/api/analyze-food`);
    console.log(`  💾 Donations endpoint: http://localhost:${PORT}/api/donations`);
    console.log(`  📍 Geocode endpoint: http://localhost:${PORT}/api/geocode?address=MG+Road+Bangalore`);
    console.log(`  🏠 Ashrams endpoint: http://localhost:${PORT}/api/ashrams/search?city=bangalore`);
    console.log(`  🚚 Delivery sample: http://localhost:${PORT}/api/delivery/sample`);
    console.log(`  🚚 Delivery route: http://localhost:${PORT}/api/delivery/route?city=Mumbai`);
    console.log(`  🚚 Live drivers:   http://localhost:${PORT}/api/drivers/live`);
    console.log(`  🚚 Track donation: http://localhost:${PORT}/api/donations/track/FF-DON-12345`);
    console.log(`  🔌 Socket.IO:      enabled`);
    console.log(`  👤 Users API:      http://localhost:${PORT}/api/users/register`);
    console.log(`  ⚙️  Settings API:   http://localhost:${PORT}/api/users/settings?email=you@example.com`);
    console.log(`  🔑 Gemini: ${GEMINI_KEY ? 'configured' : 'MISSING'}`);
    console.log(`  🗄️  MongoDB: ${mongoConnected ? 'connected' : 'NOT connected'}`);
    console.log('');
  });
});
/* ==========================================================================
   GET /api/status/flow — canonical status pipeline (for debugging)
   ========================================================================== */
app.get('/api/status/flow', (req, res) => {
  res.json({
    ok: true,
    flow: [
      { stage: 'pending',    meaning: 'Donation created, awaiting an Ashram claim' },
      { stage: 'claimed',    meaning: 'An Ashram has claimed the donation, awaiting donor approval' },
      { stage: 'approved',   meaning: 'Donor approved. System auto-assigned a driver.' },
      { stage: 'accepted',   meaning: 'Driver accepted (optional — skippable in auto-assign mode)' },
      { stage: 'in-transit', meaning: 'Driver scanned Pickup QR — on the road to the receiver' },
      { stage: 'delivered',  meaning: 'Receiver scanned Delivery QR — complete' },
      { stage: 'rejected',   meaning: 'Driver rejected the food at pickup' },
      { stage: 'cancelled',  meaning: 'Donor or system cancelled the donation' }
    ]
  });
});