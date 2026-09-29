import { getTransporter, isSmtpConfigured } from '../services/emailService.js';
import Message from '../models/Message.js';

// Sends the contact-form notification email and reports real success/failure
// (instead of swallowing errors) so the controller can tell the client the
// truth about delivery status.
//
// Note: this used to call `transporter.verify()` before `sendMail()`. That
// meant every failure paid the connection timeout twice (once for verify,
// once for send) before the request ever responded. `sendMail()` alone
// already reports connection failures just as clearly, so verify() was
// removed rather than duplicating the wait.
const sendContactEmail = async (payload) => {
  if (!isSmtpConfigured()) {
    console.warn('SMTP env vars missing; message saved without email delivery.');
    return false;
  }

  const transporter = getTransporter();
  try {
    await transporter.sendMail({
      from: `"Portfolio Contact" <${process.env.SMTP_USER}>`,
      to: process.env.CONTACT_RECEIVER_EMAIL || 'kumarvishant602@gmail.com',
      replyTo: payload.email,
      subject: `Portfolio inquiry: ${payload.subject}`,
      text: `Name: ${payload.name}\nEmail: ${payload.email}\n\n${payload.message}`
    });
    console.log('✅ Contact email sent');
    return true;
  } catch (err) {
    // ETIMEDOUT at the CONN stage (before auth) almost always means the SMTP
    // port itself is unreachable from this host — e.g. a hosting platform
    // blocking outbound SMTP traffic — not a bad SMTP_USER/SMTP_PASS. Logging
    // the code/command distinctly makes that easy to tell apart from an auth
    // failure at a glance. Never logs SMTP_PASS.
    console.error(`❌ Contact email failed (code: ${err.code || 'unknown'}, command: ${err.command || 'n/a'}):`, err.message);
    return false;
  }
};

export const createMessage = async (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ message: 'All contact fields are required' });
  }

  const saved = await Message.create({ name, email, subject, message });
  const emailDelivered = await sendContactEmail(saved);

  // The message is always saved successfully at this point, so this stays a
  // 201. `emailDelivered` reports the real, separate status of the email
  // notification instead of silently claiming it was sent either way.
  res.status(201).json({
    message: emailDelivered
      ? 'Message sent successfully'
      : 'Your message was received and saved. The email notification could not be delivered right now, but nothing was lost.',
    emailDelivered
  });
};

export const getMessages = async (_req, res) => {
  const messages = await Message.find().sort({ createdAt: -1 });
  res.json(messages);
};
