const mongoose = require("mongoose");

const AreaSchema = new mongoose.Schema(
  {
    rowStart: Number,
    rowEnd: Number,
    colStart: Number,
    colEnd: Number,
  },
  { _id: false },
);

const PhotoSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      default: null,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true },
);

// A SharedPart represents a physical part that is IDENTICAL across two or
// more Items (color variants of the same product) — e.g. table legs that
// look the same whether the top is silver or gold. It therefore has:
//   - no serial number of its own (it isn't a sellable SKU by itself)
//   - exactly ONE physical location (floorId + areas), instead of one per item
//   - no independent stock field — how many exist is always the sum of the
//     `stock` of every Item listed in `items` (computed on read, see
//     sharedPartController#withComputedStock), because every unit of any
//     linked item needs exactly one of this part.
//
// Example: item "1622-Silver" (stock 25) and item "1622-Gold" (stock 25)
// both link to the same SharedPart "Bottom" → combined stock is 50, one
// location, no duplicate space booked for what is physically one pile of
// identical bottoms.
const SharedPartSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: "",
      trim: true,
    },

    // Every Item (color variant) that uses this part. Must have at least
    // one — a SharedPart with zero linked items is meaningless and is
    // deleted automatically (see controller) rather than left orphaned.
    items: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Item",
        },
      ],
      default: [],
    },

    floorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Floor",
      default: null,
    },
    areas: {
      type: [AreaSchema],
      default: [],
    },

    damaged: {
      type: Number,
      default: 0,
    },
    damageDescription: {
      type: String,
      default: "",
      trim: true,
    },
    photos: {
      type: [PhotoSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("SharedPart", SharedPartSchema);
