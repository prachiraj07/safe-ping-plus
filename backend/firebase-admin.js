const admin = require('firebase-admin');
const path = require('path');

// Use the downloaded service account JSON file
const serviceAccount = require(path.join(__dirname, '../firebase-service-account.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL || "https://your-project-id-default-rtdb.firebaseio.com"
});

const db = admin.database();
const auth = admin.auth();

console.log('✅ Firebase Admin initialized successfully');

module.exports = { admin, db, auth };
