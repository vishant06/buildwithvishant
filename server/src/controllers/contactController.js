import nodemailer from 'nodemailer';
import Message from '../models/Message.js';

const sendContactEmail = async (payload) => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('SMTP env vars missing; message saved without email delivery.');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });

  try {
  await transporter.verify();
  console.log("✅ SMTP Connected");
} catch (err) {
  console.error("❌ SMTP Verify Error:", err);
}

const info = await transporter.sendMail({
  from: `"Portfolio Contact" <${process.env.SMTP_USER}>`,
  to: process.env.CONTACT_RECEIVER_EMAIL || 'kumarvishant602@gmail.com',
  replyTo: payload.email,
  subject: `Portfolio inquiry: ${payload.subject}`,
  text: `Name: ${payload.name}\nEmail: ${payload.email}\n\n${payload.message}`
});

console.log("Email sent:", info);
};

export const createMessage = async (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ message: 'All contact fields are required' });
  }

  const saved = await Message.create({ name, email, subject, message });
  try {
  await sendContactEmail(saved);
  console.log("✅ Email sent");
} catch (err) {
  console.error("❌ SMTP Error:", err);
}
  res.status(201).json({ message: 'Message sent successfully' });
};

export const getMessages = async (_req, res) => {
  const messages = await Message.find().sort({ createdAt: -1 });
  res.json(messages);
};
