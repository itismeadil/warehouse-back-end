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

  stock: {
    type: Number,
    default: 0,
  },

  reserved: {
    type: Number,
    default: 0,
  },

  damaged: {
    type: Number,
    default: 0,
  },

  sold: {
    type: Number,
    default: 0,
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

    parts: [PartSchema],
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Item", ItemSchema);
