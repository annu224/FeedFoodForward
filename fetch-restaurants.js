/* ============================================================
   fetch-restaurants.js
   Fetches restaurants/cafes/hotels from OpenStreetMap (Overpass)
   for major Indian cities → saves to MongoDB as "Donors"
   ============================================================ */

const mongoose = require('mongoose');
require('dotenv').config();

/* ---------- Donor schema ---------- */
const donorSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  type:      String,     // Restaurant / Cafe / Hotel / Fast Food
  cuisine:   String,
  address:   String,
  city:      String,
  state:     String,
  phone:     String,
  website:   String,
  osmId:     { type: String, unique: true },   // avoid duplicates
  location: {
    type:        { type: String, default: 'Point' },
    coordinates: [Number]   // [lng, lat]
  }
});

donorSchema.index({ location: '2dsphere' });
const Donor = mongoose.model('Donor', donorSchema);

/* ---------- Cities to fetch (bounding boxes: south,west,north,east) ---------- */
const CITIES = [
  { name: 'Mumbai',     state: 'Maharashtra', bbox: '18.85,72.75,19.30,73.05' },
  { name: 'Pune',       state: 'Maharashtra', bbox: '18.40,73.70,18.65,73.95' },
  { name: 'Nagpur',     state: 'Maharashtra', bbox: '21.05,79.00,21.20,79.20' },
  { name: 'Nashik',     state: 'Maharashtra', bbox: '19.90,73.70,20.10,73.90' },
  { name: 'Bengaluru',  state: 'Karnataka',   bbox: '12.75,77.40,13.15,77.80' },
  { name: 'Delhi',      state: 'Delhi',       bbox: '28.40,76.80,28.90,77.40' },
  { name: 'Chennai',    state: 'Tamil Nadu',  bbox: '12.90,80.10,13.25,80.35' },
  { name: 'Hyderabad',  state: 'Telangana',   bbox: '17.25,78.30,17.55,78.60' },
  { name: 'Kolkata',    state: 'West Bengal', bbox: '22.40,88.20,22.70,88.50' },
  { name: 'Ahmedabad',  state: 'Gujarat',     bbox: '22.90,72.45,23.15,72.70' }
];

/* ---------- Overpass query for one city ---------- */
async function fetchCity(city) {
  const [s, w, n, e] = city.bbox.split(',');

  const query = `
[out:json][timeout:90];
(
  node["amenity"="restaurant"](${s},${w},${n},${e});
  node["amenity"="cafe"](${s},${w},${n},${e});
  node["amenity"="fast_food"](${s},${w},${n},${e});
  node["amenity"="food_court"](${s},${w},${n},${e});
  node["tourism"="hotel"](${s},${w},${n},${e});
);
out body 800;
  `.trim();

  console.log(`\n🌆 Fetching restaurants in ${city.name}…`);

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'FeedFoodForward/1.0 (student project)'
    },
    body: 'data=' + encodeURIComponent(query)
  });

  if (!res.ok) {
    console.log(`   ⚠️ HTTP ${res.status}`);
    return [];
  }

  const data = await res.json();
  return (data.elements || []).map(el => {
    if (!el.tags || !el.tags.name || !el.lat || !el.lon) return null;

    const tags = el.tags;
    let type = 'Restaurant';
    if (tags.amenity === 'cafe') type = 'Cafe';
    else if (tags.amenity === 'fast_food') type = 'Fast Food';
    else if (tags.amenity === 'food_court') type = 'Food Court';
    else if (tags.tourism === 'hotel') type = 'Hotel';

    // Build address
    const addrParts = [
      tags['addr:housenumber'],
      tags['addr:street'],
      tags['addr:suburb'],
      tags['addr:city'] || city.name
    ].filter(Boolean);

    return {
      name:    tags.name,
      type,
      cuisine: tags.cuisine || '',
      address: addrParts.length ? addrParts.join(', ') : city.name,
      city:    city.name,
      state:   city.state,
      phone:   tags.phone || tags['contact:phone'] || '',
      website: tags.website || tags['contact:website'] || '',
      osmId:   `osm-${el.type}-${el.id}`,
      location: {
        type: 'Point',
        coordinates: [parseFloat(el.lon), parseFloat(el.lat)]
      }
    };
  }).filter(Boolean);
}

/* ---------- Main ---------- */
async function main() {
  console.log('🚀 Fetching donors from OpenStreetMap…\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ MongoDB connected\n');

  let totalSaved = 0, totalSkipped = 0;

  for (const city of CITIES) {
    const results = await fetchCity(city);
    console.log(`   Found ${results.length} places`);

    let saved = 0, skipped = 0;
    for (const r of results) {
      try {
        const exists = await Donor.findOne({ osmId: r.osmId });
        if (exists) { skipped++; continue; }
        await Donor.create(r);
        saved++;
      } catch (err) {
        // Ignore duplicate key errors
      }
    }

    console.log(`   ✅ Saved ${saved}, ⏭️  Skipped ${skipped}`);
    totalSaved += saved;
    totalSkipped += skipped;

    // Be polite to Overpass
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n========== DONE ==========');
  console.log(`✅ Total saved:   ${totalSaved}`);
  console.log(`⏭️  Total skipped: ${totalSkipped}`);
  console.log('==========================\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('💥 Fatal:', err);
  process.exit(1);
});