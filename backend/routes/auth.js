const express = require('express');
const router = express.Router();
const { auth, db } = require('../firebase-admin');
const jwt = require('jsonwebtoken');

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, phone } = req.body;

    // Create Firebase auth user
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name
    });

    // Save additional user data
    await db.ref(`users/${userRecord.uid}`).set({
      name,
      email,
      phone,
      createdAt: Date.now(),
      role: 'user'
    });

    // Generate JWT token
    const token = jwt.sign(
      { uid: userRecord.uid, email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      user: {
        uid: userRecord.uid,
        email,
        name
      },
      token
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Verify user exists
    const userRecord = await auth.getUserByEmail(email);
    
    // Get user data from database
    const userSnapshot = await db.ref(`users/${userRecord.uid}`).once('value');
    const userData = userSnapshot.val();

    // Generate JWT token
    const token = jwt.sign(
      { uid: userRecord.uid, email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        name: userData.name
      },
      token
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
  }
});

// Verify token middleware
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Get user profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const userSnapshot = await db.ref(`users/${req.user.uid}`).once('value');
    res.json({
      success: true,
      user: userSnapshot.val()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
