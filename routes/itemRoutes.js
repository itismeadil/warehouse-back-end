const express = require("express");

const router = express.Router();

const {
  createItem,
  getItems,
  deleteItem,
  updatePartStock,
  searchItems,
  addPart,
  uploadPartPhotos,
  deletePartPhoto,
} = require("../controllers/itemController");

const { requireAuth, requireRole } = require("../middleware/auth");
const upload = require("../config/upload");

router.use(requireAuth);

// Reads: any authenticated user (filtered per role in the controller)
router.get("/", getItems);
router.get("/search", searchItems);

// Writes: admin or manager
router.post("/", requireRole("admin", "manager"), createItem);
router.post("/:itemId/parts", requireRole("admin", "manager"), addPart);

// Part-level: damaged count, location, damage description
router.patch(
  "/:itemId/parts/:partId",
  requireRole("admin", "manager"),
  updatePartStock,
);

router.post(
  "/:itemId/parts/:partId/photos",
  requireRole("admin", "manager"),
  upload.array("photos", 20), // "photos" = form field name, 20 = hard upper cap per request
  uploadPartPhotos,
);

router.delete(
  "/:itemId/parts/:partId/photos/:photoId",
  requireRole("admin", "manager"),
  deletePartPhoto,
);

router.delete("/:id", requireRole("admin", "manager"), deleteItem);

module.exports = router;
