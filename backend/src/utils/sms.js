const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const sendSMS = async (to, body) => {
  try {
    if (to.startsWith('0')) {
      to = '+20' + to.substring(1);
    } else if (!to.startsWith('+')) {
  to = '+20' + to; 
    }

    const message = await client.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    });

    console.log(' SMS sent successfully:', message.sid);
    return true;
  } catch (error) {
    console.error(' Failed to send SMS:', error.message);
    return false;
  }
};


module.exports = { sendSMS };
