"use strict";

const { mongoose } = require("../config/db");
const bcrypt = require("bcryptjs");

const adminUserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    firstName: { type: String, default: "" },
    lastName: { type: String, default: "" },
    // Role is stored for forward-compatibility. Phase 1 does not enforce a
    // granular permission matrix (advanced RBAC is a later phase); any active
    // admin may perform product/category operations.
    role: {
      type: String,
      enum: ["superadmin", "editor", "viewer"],
      default: "superadmin",
    },
    isActive: { type: Boolean, default: true },
    // Bumped to invalidate all previously issued refresh tokens for this user.
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

adminUserSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, 12);
};

adminUserSchema.methods.verifyPassword = function verifyPassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

adminUserSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id,
    email: this.email,
    firstName: this.firstName,
    lastName: this.lastName,
    role: this.role,
    isActive: this.isActive,
    lastLoginAt: this.lastLoginAt,
  };
};

module.exports = mongoose.model("AdminUser", adminUserSchema);
