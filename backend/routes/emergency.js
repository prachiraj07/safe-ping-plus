const express = require('express');
const router = express.Router();
const { db } = require('../firebase-admin');
const { sendSOSMessage, isTwilioConfigured } = require('../twilio-sms');

// Trigger panic/SOS alert
router.post('/panic', async (req, res) => {
  try {
    const { userId, location } = req.body;

    // Validate input
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing userId'
      });
    }

    if (!location || !location.lat || !location.lng) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid location data'
      });
    }

    // Get user data
    const userSnapshot = await db.ref(`users/${userId}`).once('value');
    const userData = userSnapshot.val();

    if (!userData) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get emergency contacts
    const contactsSnapshot = await db.ref(`users/${userId}/emergencyContacts`).once('value');
    const contacts = contactsSnapshot.val();

    if (!contacts || Object.keys(contacts).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No emergency contacts found. Please add at least one emergency contact.'
      });
    }

    // Create incident record
    const incidentRef = db.ref('incidents').push();
    await incidentRef.set({
      userId,
      userName: userData.name || 'Unknown User',
      userEmail: userData.email || '',
      location: {
        lat: location.lat,
        lng: location.lng
      },
      timestamp: Date.now(),
      status: 'active',
      type: 'panic'
    });

    console.log(`🚨 Panic alert triggered by ${userData.name} (${userId})`);
    console.log(`📍 Location: ${location.lat}, ${location.lng}`);

    // Send SMS to all emergency contacts (only if Twilio is configured)
    let smsResults = [];
    let smsAttempted = false;

    if (isTwilioConfigured) {
      console.log(`📱 Sending SMS to ${Object.keys(contacts).length} contacts...`);
      
      const smsPromises = Object.values(contacts).map(contact =>
        sendSOSMessage(contact.phone, userData.name || 'User', location)
          .catch(err => {
            console.error(`❌ SMS failed to ${contact.phone}:`, err.message);
            return { success: false, error: err.message };
          })
      );

      smsResults = await Promise.all(smsPromises);
      smsAttempted = true;

      const successCount = smsResults.filter(r => r.success).length;
      console.log(`✅ SMS sent: ${successCount}/${Object.keys(contacts).length}`);
    } else {
      console.log('⚠️  Twilio not configured - SMS alerts skipped');
    }

    // Log SOS alert in user's profile
    await db.ref(`users/${userId}/sosAlerts`).push({
      location: {
        lat: location.lat,
        lng: location.lng
      },
      contactsNotified: Object.keys(contacts).length,
      smsAttempted,
      smsSent: smsResults.filter(r => r.success).length,
      timestamp: Date.now(),
      incidentId: incidentRef.key
    });

    // Prepare response
    const response = {
      success: true,
      incidentId: incidentRef.key,
      totalContacts: Object.keys(contacts).length,
      message: 'Emergency alert sent successfully'
    };

    if (smsAttempted) {
      response.contactsNotified = smsResults.filter(r => r.success).length;
      response.smsFailed = smsResults.filter(r => !r.success).length;
    } else {
      response.warning = 'SMS not configured - alerts saved to database only';
    }

    res.json(response);

  } catch (error) {
    console.error('❌ Panic endpoint error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to process panic alert',
      details: error.message 
    });
  }
});

// Get incident history
router.get('/incidents/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing userId'
      });
    }

    const incidentsSnapshot = await db.ref('incidents')
      .orderByChild('userId')
      .equalTo(userId)
      .limitToLast(20)
      .once('value');

    const incidents = incidentsSnapshot.val() || {};
    
    // Convert to array and sort by timestamp
    const incidentArray = Object.entries(incidents)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.timestamp - a.timestamp);

    res.json({
      success: true,
      count: incidentArray.length,
      incidents: incidentArray
    });

  } catch (error) {
    console.error('❌ Get incidents error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Cancel/resolve incident
router.post('/resolve/:incidentId', async (req, res) => {
  try {
    const { incidentId } = req.params;

    if (!incidentId) {
      return res.status(400).json({
        success: false,
        error: 'Missing incidentId'
      });
    }

    // Check if incident exists
    const incidentSnapshot = await db.ref(`incidents/${incidentId}`).once('value');
    
    if (!incidentSnapshot.exists()) {
      return res.status(404).json({
        success: false,
        error: 'Incident not found'
      });
    }

    // Update incident status
    await db.ref(`incidents/${incidentId}`).update({
      status: 'resolved',
      resolvedAt: Date.now()
    });

    console.log(`✅ Incident ${incidentId} resolved`);

    res.json({ 
      success: true,
      message: 'Incident resolved successfully'
    });

  } catch (error) {
    console.error('❌ Resolve incident error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Get active incidents (for admin/monitoring)
router.get('/active', async (req, res) => {
  try {
    const incidentsSnapshot = await db.ref('incidents')
      .orderByChild('status')
      .equalTo('active')
      .once('value');

    const incidents = incidentsSnapshot.val() || {};
    
    const incidentArray = Object.entries(incidents)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.timestamp - a.timestamp);

    res.json({
      success: true,
      count: incidentArray.length,
      incidents: incidentArray
    });

  } catch (error) {
    console.error('❌ Get active incidents error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

module.exports = router;
