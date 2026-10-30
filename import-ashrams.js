/* ============================================================
   import-ashrams.js — reads ashrams.csv → saves to MongoDB
   ============================================================ */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const mongoose = require('mongoose');
require('dotenv').config();

/* ---------- Schema ---------- */
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

/* ---------- Read CSV ---------- */
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

/* ---------- Main ---------- */
async function main() {
  console.log('🚀 Starting import...\n');

  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI missing in .env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ MongoDB connected\n');

  const csvPath = path.join(__dirname, 'ashrams.csv');
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ File not found: ${csvPath}`);
    process.exit(1);
  }

  const rows = await readCSV(csvPath);
  console.log(`📄 Parsed ${rows.length} rows\n`);

  // ⚠️ Uncomment these 2 lines to WIPE existing ashrams first:
  // await Ashram.deleteMany({});
  // console.log('🧹 Cleared old data\n');

  let saved = 0, skipped = 0, bad = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];

    const name = (r.name || '').trim();
    const lat  = parseFloat(r.latitude);
    const lng  = parseFloat(r.longitude);
    const addr = (r.address || '').trim();

    if (!name || name.toLowerCase() === 'name') { bad++; continue; }
    if (isNaN(lat) || isNaN(lng)) {
      console.log(`⏭️  [${i + 1}] ${name} — missing lat/lng`);
      bad++;
      continue;
    }

    try {
      const exists = await Ashram.findOne({ name, address: addr });
      if (exists) { skipped++; continue; }

      await Ashram.create({
        name,
        type:        (r.type        || '').trim(),
        state:       (r.state       || '').trim(),
        district:    (r.district    || '').trim(),
        city:        (r.city        || '').trim(),
        address:     addr,
        pincode:     (r.pincode     || '').trim(),
        phone:       (r.phone       || '').trim(),
        website:     (r.website     || '').trim(),
        capacity:    (r.capacity    || '').trim(),
        food_needed: (r.food_needed || '').trim(),
        verified:    (r.verified    || '').trim(),
        location: {
          type: 'Point',
          coordinates: [lng, lat]
        }
      });

      saved++;
      console.log(`[${saved}] ✅ ${name}`);
    } catch (err) {
      console.log(`❌ ${name}: ${err.message}`);
      bad++;
    }
  }

  console.log('\n========== DONE ==========');
  console.log(`✅ Saved:    ${saved}`);
  console.log(`⏭️  Skipped:  ${skipped} (duplicates)`);
  console.log(`❌ Bad rows: ${bad}`);
  console.log('==========================\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('💥 Fatal:', err);
  process.exit(1);
});