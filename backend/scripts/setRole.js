// Change one account's role from the command line. Used to create the FIRST admin (nobody can
// sign up as admin, and only admins can change roles in the app).
//
// Usage (from backend/):  node scripts/setRole.js <email> <participant|organizer|admin>
// The change applies immediately; the user does not need to log in again.
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const ROLES = ['participant', 'organizer', 'admin'];

async function main() {
  const [email, role] = process.argv.slice(2);
  if (!email || !ROLES.includes(role)) {
    console.error(`Usage: node scripts/setRole.js <email> <${ROLES.join('|')}>`);
    process.exitCode = 1;
    return;
  }
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOneAndUpdate({ email: email.trim().toLowerCase() }, { role }, { new: true });
  if (!user) {
    console.error(`No account with email ${email}. Sign up first, then run this again.`);
    process.exitCode = 1;
  } else {
    console.log(`${user.name} (${user.email}) is now ${user.role}.`);
  }
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
