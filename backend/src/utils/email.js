const nodemailer = require('nodemailer');
const { env } = require('../config/env');

const sendEmail = async ({ to, subject, text, html }) => {
  try {
    if (!env.SMTP_HOST || !env.SMTP_USER) {
      console.log('[Email:DEV] Would send email:', { to, subject, text });
      return { mocked: true };
    }

    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT) || 587,
      secure: false,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }
    });

    const info = await transporter.sendMail({ from: env.SMTP_USER, to, subject, text, html });
    console.log('Email sent:', info.messageId);
    return info;
  } catch (err) {
    console.error('Email send error:', err.message);
    throw err;
  }
};

module.exports = { sendEmail };
