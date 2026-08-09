const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["location_change_request"],
      required: true,
    },
    // For location change requests
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      required: function() {
        return this.type === "location_change_request";
      },
    },
    partId: {
      type: mongoose.Schema.Types.ObjectId,
      required: function() {
        return this.type === "location_change_request";
      },
    },
    // Worker who requested the change
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Manager assigned to handle this request
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed"],
      default: "pending",
    },
    // Additional notes from worker
    notes: {
      type: String,
      default: "",
    },
    // Manager's response/notes
    response: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Notification", NotificationSchema);
