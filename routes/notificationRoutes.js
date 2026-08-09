const express = require("express");

const router = express.Router();

const {
  createLocationChangeRequest,
  getNotifications,
  updateNotificationStatus,
  deleteNotification,
} = require("../controllers/notificationController");

const { requireAuth } = require("../middleware/auth");

router.use(requireAuth);

// Create location change request - workers and above
router.post("/location-change", createLocationChangeRequest);

// Get notifications for current user
router.get("/", getNotifications);

// Update notification status - managers and above
router.patch("/:notificationId", updateNotificationStatus);

// Delete notification
router.delete("/:notificationId", deleteNotification);

module.exports = router;
