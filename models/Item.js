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

// A single damage photo. Kept as its own schema (with _id) so each photo
// can be individually deleted via its own id.
const PhotoSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
    },
    // Cloudinary public_id — needed to actually delete the file from
    // Cloudinary (not just from the DB). Optional so older photos that
    // predate this field still work.
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

// Parts no longer carry stock/reserved/sold — those are tracked once, at
// the item level (see ItemSchema below). A part only tracks its own
// damage (count + photos + description) and its physical location.
const PartSchema = new mongoose.Schema({
  name: String,

  // Where this part physically sits: a floor + a rectangular area on it.
  // Since the picker always produces a filled rectangle, 4 numbers fully
  // describe the area — no array needed, no growth risk.
  floorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Floor",
    default: null,
  },
  area: {
    type: AreaSchema,
    default: null,
  },

  // Independent of item.stock/reserved/sold — this is purely a count of
  // how many units of THIS part are damaged.
  damaged: {
    type: Number,
    default: 0,
  },

  // Optional note about the damage, written by admin/manager and shown to
  // the assigned supplier alongside the photos.
  damageDescription: {
    type: String,
    default: "",
    trim: true,
  },

  // Damage evidence photos — capped at `damaged` (one photo per damaged
  // unit, enforced in the controller, not here).
  photos: {
    type: [PhotoSchema],
    default: [],
  },
});

const ItemSchema = new mongoose.Schema(
  {
    serialNumber: {
      type: String,
      required: true,
      unique: true,
    },

    name: {
      type: String,
      required: true,
    },

    color: {
      type: String,
      required: true,
      trim: true,
    },

    // Which supplier this item is assigned to, if any. Suppliers only ever
    // see items where this matches their own account.
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Item-level inventory pool, shared across all parts. Only sold/reserved
    // draw down `stock` — damaged is tracked separately per-part (see
    // PartSchema.damaged) and never affects this number.
    stock: {
      type: Number,
      default: 0,
    },

    reserved: {
      type: Number,
      default: 0,
    },

    sold: {
      type: Number,
      default: 0,
    },

    parts: [PartSchema],
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Item", ItemSchema);
