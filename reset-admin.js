/* reset-admin.js — deletes the stale admin so it gets recreated on next server start */
require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI missing in .env');
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const result = await mongoose.connection.db
      .collection('users')
      .deleteOne({ email: 'admin@feedfoodforward.demo' });

    console.log('🗑️ Deleted admin user(s):', result.deletedCount);

    const remaining = await mongoose.connection.db
      .collection('users')
      .find({ role: 'admin' })
      .toArray();

    console.log('📋 Remaining admin accounts:', remaining.length);

    await mongoose.disconnect();
    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();