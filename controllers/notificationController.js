const Notification = require("../models/Notification");
const Item = require("../models/Item");
const User = require("../models/User");

// Create a location change request
exports.createLocationChangeRequest = async (req, res) => {
  try {
    const { itemId, partId, notes } = req.body;

    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    const part = item.parts.id(partId);
    if (!part) {
      return res.status(404).json({ message: "Part not found" });
    }

    // Find a manager to assign the request to
    const manager = await User.findOne({ role: "manager" });
    if (!manager) {
      return res.status(404).json({ message: "No manager found to assign request" });
    }

    const notification = await Notification.create({
      type: "location_change_request",
      itemId,
      partId,
      requestedBy: req.user._id,
      assignedTo: manager._id,
      notes: notes || "",
    });

    await notification.populate("requestedBy", "name email");
    await notification.populate("assignedTo", "name email");
    await notification.populate("itemId", "serialNumber name");

    res.status(201).json(notification);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// Get notifications for the current user
exports.getNotifications = async (req, res) => {
  try {
    const filter = {
      $or: [
        { requestedBy: req.user._id },
        { assignedTo: req.user._id },
      ],
    };

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .populate("requestedBy", "name email")
      .populate("assignedTo", "name email")
      .populate("itemId", "serialNumber name")
      .lean();

    res.json(notifications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// Update notification status (for managers to handle requests)
exports.updateNotificationStatus = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const { status, response } = req.body;

    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    // Only the assigned manager can update status
    if (notification.assignedTo.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You are not authorized to update this notification" });
    }

    if (status) notification.status = status;
    if (response !== undefined) notification.response = response;

    await notification.save();
    await notification.populate("requestedBy", "name email");
    await notification.populate("assignedTo", "name email");
    await notification.populate("itemId", "serialNumber name");

    res.json(notification);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// Delete notification
exports.deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    // Only the requester or assigned manager can delete
    if (
      notification.requestedBy.toString() !== req.user._id.toString() &&
      notification.assignedTo.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "You are not authorized to delete this notification" });
    }

    await Notification.findByIdAndDelete(notificationId);

    res.json({ message: "Notification deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};
