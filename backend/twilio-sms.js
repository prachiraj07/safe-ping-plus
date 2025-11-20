const twilio = require('twilio');
const dotenv = require('dotenv');
dotenv.config();

const isTwilioConfigured =
  process.env.TWILIO_ACCOUNT_SID &&
  process.env.TWILIO_ACCOUNT_SID.startsWith('AC') &&
  process.env.TWILIO_AUTH_TOKEN &&
  process.env.TWILIO_PHONE_NUMBER;

const client = isTwilioConfigured
  ? twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    )
  : null;

if (isTwilioConfigured) {
  console.log('✅ Twilio SMS service initialized');
} else {
  console.log('⚠️  Twilio not configured - SMS alerts skipped');
}

async function sendSOSMessage(to, userName, location) {
  const message = `SAFE-PING+ ALERT! ${userName} needs help! Location: https://maps.google.com/?q=${location.lat},${location.lng} Time: ${new Date().toLocaleString()}`;
  try {
    if (!client) throw new Error('Twilio not configured');
    const result = await client.messages.create({
      body: message, // <-- SHORT message
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to
    });
    console.log('SMS sent:', result.sid);
    return { success: true, sid: result.sid };
  } catch (error) {
    console.error('SMS error:', error);
    return { success: false, error: error.message };
  }
}


async function sendLocationShare(to, userName, location) {
  const message = `📍 ${userName} shared their location with you via SAFE-PING+

View location: https://maps.google.com/?q=${location.lat},${location.lng}

Time: ${new Date().toLocaleString()}`;

  try {
    if (!client) throw new Error('Twilio not configured');
    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to
    });
    return { success: true, sid: result.sid };
  } catch (error) {
    console.error('SMS error:', error);
    return { success: false, error: error.message };
  }
}

module.exports = { sendSOSMessage, sendLocationShare, isTwilioConfigured };
