const express = require('express');
const router = express.Router();
const { db } = require('../firebase-admin');
const NodeGeocoder = require('node-geocoder');

const geocoder = NodeGeocoder({
  provider: 'google',
  apiKey: process.env.GOOGLE_MAPS_API_KEY
});

// Update user location
router.post('/update', async (req, res) => {
  try {
    const { userId, lat, lng } = req.body;

    // Reverse geocode to get address
    const addressData = await geocoder.reverse({ lat, lon: lng });
    const address = addressData[0]?.formattedAddress || 'Unknown location';

    // Save to database
    await db.ref(`users/${userId}/location`).set({
      lat,
      lng,
      address,
      timestamp: Date.now()
    });

    res.json({
      success: true,
      address
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user location
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const locationSnapshot = await db.ref(`users/${userId}/location`).once('value');
    
    res.json({
      success: true,
      location: locationSnapshot.val()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Share location with contacts
router.post('/share', async (req, res) => {
  try {
    const { userId, location } = req.body;
    
    await db.ref(`users/${userId}/locationShares`).push({
      location,
      timestamp: Date.now()
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
