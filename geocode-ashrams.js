/* ============================================================
   geocode-ashrams.js
   Reads ashrams.csv, gets lat/lng from Nominatim (free),
   saves them into MongoDB.
   ============================================================ */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const mongoose = require('mongoose');
require('dotenv').config();

/* ---------- 1. Ashram schema ---------- */
const ashramSchema = new mongoose.Schema({
  name:      String,
  address:   String,
  city:      String,
  state:     String,
  phone:     String,
  website:   String,
  location: {
    type:        { type: String, default: 'Point' },
    coordinates: [Number]   // [lng, lat]
  }
});

ashramSchema.index({ location: '2dsphere' });

const Ashram = mongoose.model('Ashram', ashramSchema);

/* ---------- 2. Geocode ONE address using Nominatim ---------- */
async function geocode(address) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=in`;

  const res = await fetch(url, {
    headers: {
      // Nominatim requires a User-Agent
      'User-Agent': 'FeedFoodForward/1.0 (student project)'
    }
  });

  if (!res.ok) {
    console.log(`   ⚠️  HTTP ${res.status}`);
    return null;
  }

  const data = await res.json();

  if (!data || data.length === 0) return null;

  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon)
  };
}

/* ---------- 3. Read CSV ---------- */
function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

/* ---------- 4. Main ---------- */
async function main() {
  console.log('🚀 Starting geocode script...\n');

  // Connect to MongoDB
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI missing in .env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ MongoDB connected\n');

  // Read the CSV
  const csvPath = path.join(__dirname, 'ashrams.csv');

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ File not found: ${csvPath}`);
    console.error('   Please create ashrams.csv in the project folder.');
    process.exit(1);
  }

  const ashrams = await readCSV(csvPath);
  console.log(`📄 Found ${ashrams.length} ashrams in CSV\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < ashrams.length; i++) {
    const a = ashrams[i];
    const fullAddress = `${a.address || ''}, ${a.city || ''}, ${a.state || ''}, India`;
    const label = `[${i + 1}/${ashrams.length}] ${a.name}`;

    process.stdout.write(`${label} ... `);

    try {
      const coords = await geocode(fullAddress);

      if (!coords) {
        console.log('❌ Not found');
        failed++;
      } else {
        // Check if this ashram already exists (avoid duplicates)
        const exists = await Ashram.findOne({ name: a.name, address: a.address });

        if (exists) {
          console.log(`⏭️  Already exists`);
        } else {
          await Ashram.create({
            name:    a.name,
            address: a.address,
            city:    a.city,
            state:   a.state,
            phone:   a.phone,
            website: a.website,
            location: {
              type: 'Point',
              coordinates: [coords.lng, coords.lat]
            }
          });
          console.log(`✅ ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
          success++;
        }
      }
    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
      failed++;
    }

    // Nominatim rate limit: max 1 request per second
    await new Promise(r => setTimeout(r, 1100));
  }

  console.log('\n========== DONE ==========');
  console.log(`✅ Saved:  ${success}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped duplicates`);
  console.log('==========================\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('💥 Fatal:', err);
  process.exit(1);
});