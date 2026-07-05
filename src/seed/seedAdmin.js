"use strict";

/**
 * Creates (or updates the password of) the initial superadmin from env vars.
 * Idempotent: safe to run multiple times.
 *   npm run seed:admin
 */

const mongoose = require("mongoose");
const env = require("../config/env");
const { connectDB } = require("../config/db");
const AdminUser = require("../models/AdminUser");

(async () => {
  await connectDB();
  try {
    const { email, password, name } = env.seedAdmin;
    const [firstName, ...rest] = name.split(" ");
    const lastName = rest.join(" ");

    let user = await AdminUser.findOne({ email });
    if (user) {
      await user.setPassword(password);
      user.isActive = true;
      user.role = "superadmin";
      await user.save();
      console.log(`[seed:admin] updated existing admin: ${email}`);
    } else {
      user = new AdminUser({
        email,
        firstName: firstName || "Voof",
        lastName: lastName || "Admin",
        role: "superadmin",
      });
      await user.setPassword(password);
      await user.save();
      console.log(`[seed:admin] created superadmin: ${email}`);
    }
    console.log("[seed:admin] done. Remember to change this password after first login.");
  } catch (err) {
    console.error("[seed:admin] failed:", err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
