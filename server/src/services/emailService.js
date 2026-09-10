import nodemailer from 'nodemailer';

const isSmtpConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const getTransporter = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });

const clientUrl = () => (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');

/**
 * Sends the email-verification link for normal (email/password) signups.
 * OAuth users never go through this path since their provider already
 * verifies the email address.
 */
export const sendVerificationEmail = async (user, rawToken) => {
  if (!isSmtpConfigured()) {
    console.warn('SMTP env vars missing; verification email not sent for', user.email);
    return false;
  }

  const expiresMinutes = Number(process.env.EMAIL_VERIFICATION_EXPIRES_MINUTES || 60);
  const verifyLink = `${clientUrl()}/verify-email/${rawToken}`;
  const transporter = getTransporter();

  await transporter.sendMail({
    from: `"BuildWithVishant" <${process.env.SMTP_USER}>`,
    to: user.email,
    subject: 'Verify your email address',
    text: `Hi ${user.name},\n\nPlease verify your email address by visiting the link below:\n${verifyLink}\n\nThis link expires in ${expiresMinutes} minutes. If you did not create this account, you can safely ignore this email.`,
    html: `<p>Hi ${user.name},</p><p>Please verify your email address by clicking the link below:</p><p><a href="${verifyLink}">Verify my email</a></p><p>This link expires in ${expiresMinutes} minutes.</p><p>If you did not create this account, you can safely ignore this email.</p>`
  });

  return true;
};

export default { sendVerificationEmail };
