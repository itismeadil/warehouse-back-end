const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    // manager: same access as admin, except they can't see/reach Manage Users
    // or Accounting.
    // accountant: can see Accounting (and general item/floor access like
    // manager), but not Manage Users.
    role: {
      type: String,
      enum: ["admin", "manager", "accountant", "supplier"],
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("User", UserSchema);
