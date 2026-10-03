require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env'), quiet: true });
const { connectStore } = require('./models/store');
(async () => { const { store, client } = await connectStore(); try { await store.db.command({ ping: 1 }); console.log('MongoDB OK — database:', store.db.databaseName); } finally { await client.close(); } })().catch(error => { console.error('MongoDB:', error.message); process.exitCode = 1; });
