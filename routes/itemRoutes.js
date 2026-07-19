const express = require("express");

const router = express.Router();

const {
  createItem,
  getItems,
  deleteItem,
  updatePartStock,
  searchItems,
  addPart,
} = require("../controllers/itemController");

const { requireAuth, requireRole } = require("../middleware/auth");

router.use(requireAuth);

// Reads: any authenticated user (filtered per role in the controller)
router.get("/", getItems);
router.get("/search", searchItems);

// Writes: admin or manager
router.post("/", requireRole("admin", "manager"), createItem);
router.post("/:itemId/parts", requireRole("admin", "manager"), addPart);
router.patch(
  "/:itemId/parts/:partId",
  requireRole("admin", "manager"),
  updatePartStock,
);
router.delete("/:id", requireRole("admin", "manager"), deleteItem);

module.exports = router;
