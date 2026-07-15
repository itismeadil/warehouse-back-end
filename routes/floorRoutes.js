const express = require("express");

const router = express.Router();

const {
  createFloor,
  getFloors,
  getFloorOccupancy,
  deleteFloor,
} = require("../controllers/floorController");

router.post("/", createFloor);

router.get("/", getFloors);

router.get("/:id/occupancy", getFloorOccupancy);

router.delete("/:id", deleteFloor);

module.exports = router;
