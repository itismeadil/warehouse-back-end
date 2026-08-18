const express = require("express");

const router = express.Router();

const {
  getSharedParts,
  createSharedPart,
  linkItem,
  unlinkItem,
  updateSharedPart,
  uploadSharedPartPhotos,
  deleteSharedPartPhoto,
  deleteSharedPart,
} = require("../controllers/sharedPartController");

const { requireAuth, requireRole } = require("../middleware/auth");
const upload = require("../config/upload");

router.use(requireAuth);

// Reads: any authenticated user
router.get("/", getSharedParts);

// Writes: admin or manager
router.post("/", requireRole("admin", "manager"), createSharedPart);
router.post("/:id/link", requireRole("admin", "manager"), linkItem);
router.post("/:id/unlink", requireRole("admin", "manager"), unlinkItem);

// Damaged count/description: admin, manager, worker (location changes are
// blocked for workers inside the controller, same as regular parts)
router.patch(
  "/:id",
  requireRole("admin", "manager", "worker"),
  updateSharedPart,
);

router.post(
  "/:id/photos",
  requireRole("admin", "manager", "worker"),
  upload.array("photos", 20),
  uploadSharedPartPhotos,
);

router.delete(
  "/:id/photos/:photoId",
  requireRole("admin", "manager"),
  deleteSharedPartPhoto,
);

router.delete("/:id", requireRole("admin", "manager"), deleteSharedPart);

module.exports = router;
