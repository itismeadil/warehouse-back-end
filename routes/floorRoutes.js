const express = require("express");

const router = express.Router();

const {
  createFloor,
  getFloors,
  getFloorOccupancy,
  deleteFloor,
} = require("../controllers/floorController");

const { requireAuth, requireRole } = require("../middleware/auth");

router.use(requireAuth);

router.get("/", getFloors);
router.get("/:id/occupancy", getFloorOccupancy);

router.post("/", requireRole("admin", "manager"), createFloor);
router.delete("/:id", requireRole("admin", "manager"), deleteFloor);

module.exports = router;
