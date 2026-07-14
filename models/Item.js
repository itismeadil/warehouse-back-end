const mongoose = require("mongoose");

const PartSchema = new mongoose.Schema({
  name: String,
  location: String,

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
