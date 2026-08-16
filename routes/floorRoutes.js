const express = require("express");

const router = express.Router();

const {
  createFloor,
  getFloors,
  getFloorOccupancy,
  deleteFloor,
  restoreFloor,
  permanentlyDeleteFloor,
} = require("../controllers/floorController");

const { requireAuth, requireRole } = require("../middleware/auth");

router.use(requireAuth);

router.get("/", getFloors);
router.get("/:id/occupancy", getFloorOccupancy);

router.post("/", requireRole("admin", "manager"), createFloor);
router.delete("/:id", requireRole("admin", "manager"), deleteFloor);
router.post("/:id/restore", requireRole("admin", "manager"), restoreFloor);
router.delete("/:id/permanent", requireRole("admin"), permanentlyDeleteFloor);

module.exports = router;
