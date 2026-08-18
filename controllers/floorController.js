const Floor = require("../models/Floor");
const Item = require("../models/Item");
const SharedPart = require("../models/SharedPart");

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
    const { includeDeleted } = req.query;
    const query = includeDeleted === "true" ? {} : { deletedAt: null };
    const floors = await Floor.find(query).sort({ createdAt: 1 });

    res.json(floors);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

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
      item.parts.forEach((part, index) => {
        if (part.floorId && part.floorId.toString() === floor._id.toString()) {
          // Handle multiple areas (new) or single area (backward compatibility)
          const areas =
            part.areas && part.areas.length > 0
              ? part.areas
              : part.area
                ? [part.area]
                : [];

          areas.forEach((area) => {
            occupied.push({
              itemId: item._id,
              itemName: item.name,
              serialNumber: item.serialNumber,
              partId: part._id,
              partName: `${item.parts.length}/${index + 1}`,
              area,
              stock: item.stock,
            });
          });
        }
      });
    });

    // Shared parts (e.g. legs/top-holder that are physically identical
    // across two or more color variants of the same item) occupy their
    // space exactly ONCE, even though several items link to them — this is
    // what prevents the same square being booked twice (once per color)
    // for a part that only physically exists in one place.
    const sharedParts = await SharedPart.find({ floorId: floor._id }).populate(
      "items",
      "name serialNumber color",
    );

    sharedParts.forEach((sharedPart) => {
      const areas = sharedPart.areas || [];
      const linkedItems = sharedPart.items || [];
      const itemNames = linkedItems
        .map((i) => `${i.name} (${i.color})`)
        .join(", ");

      areas.forEach((area) => {
        occupied.push({
          sharedPartId: sharedPart._id,
          itemName: sharedPart.name || "Shared part",
          serialNumber: null,
          partName: `Shared${itemNames ? ` — used by ${itemNames}` : ""}`,
          area,
          stock: null,
          linkedItemIds: linkedItems.map((i) => i._id),
        });
      });
    });

    res.json({ floor, occupied });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// Delete Floor (soft delete)
exports.deleteFloor = async (req, res) => {
  try {
    const floor = await Floor.findById(req.params.id);

    if (!floor) {
      return res.status(404).json({
        message: "Floor not found",
      });
    }

    if (floor.deletedAt) {
      return res.status(400).json({
        message: "Floor is already deleted",
      });
    }

    floor.deletedAt = new Date();
    floor.deletedBy = req.user._id;
    await floor.save();

    res.json({
      message:
        "Floor deleted successfully. You can undo this action within 3 days.",
      floor,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// Restore Floor (undo delete)
exports.restoreFloor = async (req, res) => {
  try {
    const floor = await Floor.findById(req.params.id);

    if (!floor) {
      return res.status(404).json({
        message: "Floor not found",
      });
    }

    if (!floor.deletedAt) {
      return res.status(400).json({
        message: "Floor is not deleted",
      });
    }

    // Check if 3 days have passed
    const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;
    const timeSinceDeletion = Date.now() - floor.deletedAt.getTime();

    if (timeSinceDeletion > threeDaysInMs) {
      return res.status(400).json({
        message:
          "Cannot restore floor. More than 3 days have passed since deletion.",
      });
    }

    floor.deletedAt = null;
    floor.deletedBy = null;
    await floor.save();

    res.json({
      message: "Floor restored successfully",
      floor,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// Permanently delete floor (for cleanup job)
exports.permanentlyDeleteFloor = async (req, res) => {
  try {
    const floor = await Floor.findById(req.params.id);

    if (!floor) {
      return res.status(404).json({
        message: "Floor not found",
      });
    }

    await Floor.findByIdAndDelete(req.params.id);

    res.json({
      message: "Floor permanently deleted",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
