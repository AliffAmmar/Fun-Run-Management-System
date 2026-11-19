// Accounts listed in ADMIN_EMAILS (backend .env, comma-separated) become admins automatically:
// at sign-up, or at their next login if the account already exists. Server configuration only,
// so nobody can make themselves admin through the website.
const adminEmails = () =>
  String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

const isAdminEmail = (email) => adminEmails().includes(String(email || '').trim().toLowerCase());

module.exports = { isAdminEmail, adminEmails };
