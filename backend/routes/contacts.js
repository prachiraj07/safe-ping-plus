const express = require('express');
const router = express.Router();
const { db } = require('../firebase-admin');

// Get all emergency contacts
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const contactsSnapshot = await db.ref(`users/${userId}/emergencyContacts`).once('value');
    
    res.json({
      success: true,
      contacts: contactsSnapshot.val() || {}
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add emergency contact
router.post('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, phone, relation } = req.body;

    const newContactRef = db.ref(`users/${userId}/emergencyContacts`).push();
    await newContactRef.set({
      name,
      phone,
      relation,
      addedAt: Date.now()
    });

    res.status(201).json({
      success: true,
      contactId: newContactRef.key
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete emergency contact
router.delete('/:userId/:contactId', async (req, res) => {
  try {
    const { userId, contactId } = req.params;
    await db.ref(`users/${userId}/emergencyContacts/${contactId}`).remove();
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
