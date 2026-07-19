// Run once to create the first admin account, since there's no public
// sign-up page — every other account gets created by an admin afterward
// through the Manage Users page.
//
// Usage:
//   node scripts/createAdmin.js "Admin Name" admin@example.com yourpassword

const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");

dotenv.config();

const run = async () => {
  const [, , name, email, password] = process.argv;

  if (!name || !email || !password) {
    console.error(
      "Usage: node scripts/createAdmin.js \"Admin Name\" admin@example.com yourpassword",
    );
    process.exit(1);
  }

  await connectDB();

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    console.error(`A user with email ${email} already exists.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash,
    role: "admin",
  });

  console.log(`Admin created: ${user.email}`);
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
