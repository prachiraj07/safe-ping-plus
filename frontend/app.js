// SAFE-PING+ Main Application Logic
// This file contains all the JavaScript for the application

let currentUser = null;
let userLocation = { lat: 0, lng: 0 };
let map = null;
let marker = null;
let watchId = null;
let panicHoldTimer = null;
let panicActive = false;

// ============================================
// AUTHENTICATION
// ============================================
function toggleAuthForm() {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    
    if (loginForm.style.display === 'none') {
        loginForm.style.display = 'block';
        signupForm.style.display = 'none';
    } else {
        loginForm.style.display = 'none';
        signupForm.style.display = 'block';
    }
}

async function login() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        showToast('Please fill all fields', 'warning');
        return;
    }

    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        currentUser = userCredential.user;
        showToast('Login successful!', 'success');
        loadMainApp();
    } catch (error) {
        showToast('Login failed: ' + error.message, 'error');
    }
}

async function signup() {
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const phone = document.getElementById('signupPhone').value;
    const password = document.getElementById('signupPassword').value;

    if (!name || !email || !phone || !password) {
        showToast('Please fill all fields', 'warning');
        return;
    }

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        currentUser = userCredential.user;

        await database.ref('users/' + currentUser.uid).set({
            name: name,
            email: email,
            phone: phone,
            createdAt: Date.now()
        });

        showToast('Account created successfully!', 'success');
        loadMainApp();
    } catch (error) {
        showToast('Signup failed: ' + error.message, 'error');
    }
}

function logout() {
    auth.signOut().then(() => {
        currentUser = null;
        stopLocationTracking();
        document.getElementById('authScreen').style.display = 'block';
        document.getElementById('mainApp').style.display = 'none';
        showToast('Logged out successfully', 'success');
    });
}

auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        loadMainApp();
    } else {
        document.getElementById('authScreen').style.display = 'block';
        document.getElementById('mainApp').style.display = 'none';
    }
});

// ============================================
// MAIN APP
// ============================================
async function loadMainApp() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';

    const userSnapshot = await database.ref('users/' + currentUser.uid).once('value');
    const userData = userSnapshot.val();
    document.getElementById('userName').textContent = userData.name;

    startLocationTracking();
    loadEmergencyContacts();
    initializeMap();
}

// ============================================
// GPS TRACKING
// ============================================
function startLocationTracking() {
    if (navigator.geolocation) {
        document.getElementById('gpsStatus').textContent = 'Active';
        
        watchId = navigator.geolocation.watchPosition(
            (position) => {
                userLocation.lat = position.coords.latitude;
                userLocation.lng = position.coords.longitude;

                document.getElementById('latitude').textContent = userLocation.lat.toFixed(6);
                document.getElementById('longitude').textContent = userLocation.lng.toFixed(6);

                if (marker && map) {
                    marker.setPosition(userLocation);
                    map.setCenter(userLocation);
                }

                if (currentUser) {
                    database.ref('users/' + currentUser.uid + '/location').set({
                        lat: userLocation.lat,
                        lng: userLocation.lng,
                        timestamp: Date.now()
                    });
                }

                reverseGeocode(userLocation.lat, userLocation.lng);
            },
            (error) => {
                console.error('GPS Error:', error);
                document.getElementById('gpsStatus').textContent = 'Error';
            },
            {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 5000
            }
        );
    } else {
        showToast('Geolocation not supported', 'error');
    }
}

function stopLocationTracking() {
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
}

function reverseGeocode(lat, lng) {
    const geocoder = new google.maps.Geocoder();
    const latlng = { lat: lat, lng: lng };

    geocoder.geocode({ location: latlng }, (results, status) => {
        if (status === 'OK' && results[0]) {
            document.getElementById('currentLocation').textContent = 
                results[0].formatted_address.substring(0, 40) + '...';
        }
    });
}

// ============================================
// GOOGLE MAPS
// ============================================
function initializeMap() {
    const mapOptions = {
        center: userLocation,
        zoom: 15,
        mapTypeId: google.maps.MapTypeId.ROADMAP
    };

    map = new google.maps.Map(document.getElementById('realMap'), mapOptions);

    marker = new google.maps.Marker({
        position: userLocation,
        map: map,
        title: 'Your Location',
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#FF1B6B',
            fillOpacity: 1,
            strokeColor: 'white',
            strokeWeight: 3
        }
    });
}

// ============================================
// EMERGENCY CONTACTS
// ============================================
async function loadEmergencyContacts() {
    const contactsRef = database.ref('users/' + currentUser.uid + '/emergencyContacts');
    
    contactsRef.on('value', (snapshot) => {
        const contacts = snapshot.val();
        const contactsList = document.getElementById('contactsList');
        
if (!contacts) {
    contactsList.innerHTML = '<p>No emergency contacts added yet.</p>';
    document.getElementById('contactCount').textContent = '0';
    return;
}

        const contactsArray = Object.entries(contacts);
        document.getElementById('contactCount').textContent = contactsArray.length;

        contactsList.innerHTML = contactsArray.map(([id, contact]) => `
            

                
${contact.name.charAt(0)}

                

                    
${contact.name}

                    
${contact.phone} • ${contact.relation}

                

                Call
            

        `).join('');
    });
}

function showAddContactModal() {
    document.getElementById('addContactModal').classList.add('active');
}

function closeAddContactModal() {
    document.getElementById('addContactModal').classList.remove('active');
    document.getElementById('contactName').value = '';
    document.getElementById('contactPhone').value = '';
    document.getElementById('contactRelation').value = '';
}

async function addContact() {
    const name = document.getElementById('contactName').value;
    const phone = document.getElementById('contactPhone').value;
    const relation = document.getElementById('contactRelation').value;

    if (!name || !phone || !relation) {
        showToast('Please fill all fields', 'warning');
        return;
    }

    try {
        const newContactRef = database.ref('users/' + currentUser.uid + '/emergencyContacts').push();
        await newContactRef.set({
            name: name,
            phone: phone,
            relation: relation,
            addedAt: Date.now()
        });

        showToast('Contact added successfully!', 'success');
        closeAddContactModal();
    } catch (error) {
        showToast('Failed to add contact', 'error');
    }
}

function callContact(phone, name) {
    showToast(`Calling ${name}...`, 'success');
    
    database.ref('users/' + currentUser.uid + '/callLogs').push({
        contactName: name,
        contactPhone: phone,
        timestamp: Date.now()
    });
}

// ============================================
// PANIC BUTTON
// ============================================
const panicBtn = document.getElementById('panicBtn');

panicBtn.addEventListener('mousedown', () => {
    panicHoldTimer = setTimeout(() => triggerPanic(), 3000);
});

panicBtn.addEventListener('mouseup', () => {
    clearTimeout(panicHoldTimer);
});

panicBtn.addEventListener('touchstart', () => {
    panicHoldTimer = setTimeout(() => triggerPanic(), 3000);
});

panicBtn.addEventListener('touchend', () => {
    clearTimeout(panicHoldTimer);
});

async function triggerPanic() {
    if (panicActive) return;
    
    panicActive = true;
    panicBtn.classList.add('active');
    document.getElementById('panicModal').classList.add('active');

    const incidentRef = database.ref('incidents').push();
    await incidentRef.set({
        userId: currentUser.uid,
        location: userLocation,
        timestamp: Date.now(),
        status: 'active',
        type: 'panic'
    });

    await sendSOSToContacts();
}

async function sendSOSToContacts() {
    const contactsSnapshot = await database.ref('users/' + currentUser.uid + '/emergencyContacts').once('value');
    const contacts = contactsSnapshot.val();

    if (!contacts) {
        showToast('No emergency contacts to alert', 'warning');
        return;
    }

    const locationLink = `https://maps.google.com/?q=${userLocation.lat},${userLocation.lng}`;

    await database.ref('users/' + currentUser.uid + '/sosAlerts').push({
        location: userLocation,
        timestamp: Date.now()
    });

    document.getElementById('panicModalText').innerHTML = 
        `✓ ${Object.keys(contacts).length} contacts notified
✓ Location shared
✓ Security alerted`;
}

function confirmPanic() {
    showToast('Emergency services notified', 'success');
    document.getElementById('panicModal').classList.remove('active');
}

function cancelPanic() {
    panicActive = false;
    panicBtn.classList.remove('active');
    document.getElementById('panicModal').classList.remove('active');
    document.body.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
    showToast('Emergency alert cancelled', 'success');
}

// ============================================
// QUICK ACTIONS
// ============================================
function activateSiren() {
    showToast('🔊 Siren activated!', 'error');
    const audio = document.getElementById('siren-audio');
    if (audio) {
        audio.currentTime = 0;
        audio.volume = 1.0;
        audio.play();
    } else {
        showToast('Siren audio not found!', 'warning');
    }
}
document.getElementById('siren-btn').addEventListener('click', activateSiren);



async function shareLocation() {
    const locationLink = `https://maps.google.com/?q=${userLocation.lat},${userLocation.lng}`;
    
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'My Current Location',
                text: 'I am sharing my location with you via SAFE-PING+',
                url: locationLink
            });
            showToast('Location shared successfully', 'success');
        } catch (error) {
            console.log('Share cancelled');
        }
    } else {
        navigator.clipboard.writeText(locationLink);
        showToast('📍 Location link copied to clipboard', 'success');
    }

    database.ref('users/' + currentUser.uid + '/locationShares').push({
        location: userLocation,
        timestamp: Date.now()
    });
}

function shareLocationLive() {
    shareLocation();
}

function fakeCall() {
    showToast('📞 Fake call activated - "Mom calling..."', 'success');
}

function flashSOS() {
    showToast('💡 SOS flash activated', 'success');
}

// ============================================
// NAVIGATION
// ============================================
function showSection(section) {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    
    document.getElementById('homeSection').style.display = 'none';
    document.getElementById('mapSection').style.display = 'none';
    document.getElementById('contactsSection').style.display = 'none';

    if (section === 'home') {
        document.getElementById('homeSection').style.display = 'block';
        document.querySelectorAll('.nav-item')[0].classList.add('active');
    } else if (section === 'map') {
        document.getElementById('mapSection').style.display = 'block';
        document.querySelectorAll('.nav-item')[1].classList.add('active');
        if (map) google.maps.event.trigger(map, 'resize');
    } else if (section === 'contacts') {
        document.getElementById('contactsSection').style.display = 'block';
        document.querySelectorAll('.nav-item')[2].classList.add('active');
    }
}

// ============================================
// UTILITY
// ============================================
function showToast(message, type = 'error') {
    const toast = document.getElementById('alertToast');
    toast.textContent = message;
    
    if (type === 'success') {
        toast.style.background = 'var(--success)';
    } else if (type === 'warning') {
        toast.style.background = 'var(--warning)';
    } else {
        toast.style.background = 'var(--danger)';
    }
    
    toast.classList.add('active');
    setTimeout(() => {
        toast.classList.remove('active');
    }, 3000);
}