const Floor = require("../models/Floor");
const Item = require("../models/Item");

// Create Floor
exports.createFloor = async (req, res) => {
  try {
    const { name, rows, cols, shape } = req.body;

    if (!name || !rows || !cols) {
      return res.status(400).json({
        message: "name, rows, and cols are required",
      });
    }

    if (!shape) {
      return res.status(400).json({
        message: "Draw the floor shape first",
      });
    }

    const floor = await Floor.create({ name, rows, cols, shape });

    res.status(201).json(floor);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// Get All Floors
exports.getFloors = async (req, res) => {
  try {
    const floors = await Floor.find().sort({ createdAt: 1 });

    res.json(floors);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// Get a single floor plus which parts are placed on it (as rectangles, not
// individual cells — the frontend expands each rectangle into dots itself).
exports.getFloorOccupancy = async (req, res) => {
  try {
    const floor = await Floor.findById(req.params.id);

    if (!floor) {
      return res.status(404).json({
        message: "Floor not found",
      });
    }

    const items = await Item.find({ "parts.floorId": floor._id });

    const occupied = [];

    items.forEach((item) => {
      item.parts.forEach((part) => {
        if (
          part.floorId &&
          part.floorId.toString() === floor._id.toString() &&
          part.area
        ) {
          occupied.push({
            itemId: item._id,
            itemName: item.name,
            serialNumber: item.serialNumber,
            partId: part._id,
            partName: part.name,
            area: part.area,
            stock: part.stock,
          });
        }
      });
    });

    res.json({ floor, occupied });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// Delete Floor
exports.deleteFloor = async (req, res) => {
  try {
    await Floor.findByIdAndDelete(req.params.id);

    res.json({
      message: "Floor deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
