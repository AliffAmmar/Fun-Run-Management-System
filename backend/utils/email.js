// The one shared email helper (CLAUDE.md §4.6). Everything that sends email calls sendEmail().
//
// EMAIL_MODE (backend .env):
//   console  (default) print a summary to the terminal; nothing is sent. Needs no account.
//   ethereal send to a free fake inbox from nodemailer; the terminal prints a link where you
//            can view the real email (HTML + attachments). Nothing reaches real people.
//   smtp     really send, via any SMTP provider. Currently Brevo (free, 300/day):
//              SMTP_HOST=smtp-relay.brevo.com  SMTP_PORT=587
//              SMTP_USER=<Brevo SMTP login>    SMTP_PASS=<Brevo SMTP key>
//              EMAIL_FROM="Run4Fun <your-verified-sender@example.com>"
//            Switching provider = changing these values only.
// In tests (NODE_ENV=test) emails are kept in memory: see sentEmails / clearSentEmails.
const nodemailer = require('nodemailer');

const sentEmails = []; // test mode only
let transporterPromise = null;

const mode = () => (process.env.NODE_ENV === 'test' ? 'test' : (process.env.EMAIL_MODE || 'console').toLowerCase());
const fromAddress = () => process.env.EMAIL_FROM || 'Run4Fun <no-reply@run4fun.local>';

// Base URL of the frontend, for links inside emails.
const appUrl = () => (process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');

async function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = (async () => {
      if (mode() === 'ethereal') {
        const account = await nodemailer.createTestAccount();
        console.log(`[email] Ethereal inbox: https://ethereal.email/login  user=${account.user}  pass=${account.pass}`);
        return nodemailer.createTransport({
          host: account.smtp.host,
          port: account.smtp.port,
          secure: account.smtp.secure,
          auth: { user: account.user, pass: account.pass },
        });
      }
      const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
      if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
        throw new Error('EMAIL_MODE=smtp needs SMTP_HOST, SMTP_USER and SMTP_PASS in backend .env');
      }
      const port = Number(SMTP_PORT) || 587;
      return nodemailer.createTransport({
        host: SMTP_HOST,
        port,
        secure: port === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });
    })().catch((err) => {
      transporterPromise = null; // allow a retry after fixing config
      throw err;
    });
  }
  return transporterPromise;
}

// sendEmail({ to, subject, text, html?, attachments? }) → { mode, messageId?, previewUrl? }
// Throws on failure: callers decide whether a failed email matters (e.g. never undo a payment).
async function sendEmail({ to, subject, text, html, attachments = [] }) {
  if (!to) throw new Error('sendEmail: "to" is required');
  const message = { from: fromAddress(), to, subject, text, html, attachments };

  switch (mode()) {
    case 'test':
      sentEmails.push(message);
      return { mode: 'test' };
    case 'console':
      console.log(
        `[email] (EMAIL_MODE=console, not sent) To: ${to} | Subject: ${subject}` +
          (attachments.length ? ` | ${attachments.length} attachment(s)` : '') +
          `\n${text}\n[email] ---`
      );
      return { mode: 'console' };
    default: {
      const transporter = await getTransporter();
      const info = await transporter.sendMail(message);
      const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
      if (previewUrl) console.log(`[email] Preview "${subject}" → ${previewUrl}`);
      return { mode: mode(), messageId: info.messageId, previewUrl };
    }
  }
}

// Minimal escaping for values inserted into email HTML (names, group names, etc.).
const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = {
  sendEmail,
  appUrl,
  escapeHtml,
  sentEmails,
  clearSentEmails: () => sentEmails.splice(0, sentEmails.length),
};
