// Firebase Configuration
// Replace these values with your actual Firebase project credentials
// Get them from: Firebase Console → Project Settings → General

const firebaseConfig = {
    apiKey: "YOUR_API_KEY_HERE",
    authDomain: "your-project.firebaseapp.com",
    databaseURL: "https://your-project.firebaseio.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Export Firebase services
const auth = firebase.auth();
const database = firebase.database();

// Optional: Enable persistence
database.ref('.info/connected').on('value', (snapshot) => {
    if (snapshot.val() === true) {
        console.log('✅ Connected to Firebase');
    } else {
        console.log('❌ Not connected to Firebase');
    }
});
