const mongoose = require("mongoose");

const FloorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // Bounding size of the dot canvas this floor was drawn on (30, 60, or 100).
    rows: {
      type: Number,
      required: true,
      min: 1,
    },
    cols: {
      type: Number,
      required: true,
      min: 1,
    },

    // The drawn shape, packed as 1 bit per dot and base64-encoded. A fully
    // painted 100x100 floor is always ~1.25KB this way — bounded regardless
    // of how detailed the drawing is, unlike an array of {row,col} objects.
    // Decoded/encoded entirely on the frontend; the backend just stores it.
    shape: {
      type: String,
      required: true,
    },

    // Soft delete fields
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Floor", FloorSchema);
