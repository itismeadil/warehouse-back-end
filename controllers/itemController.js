const Item = require("../models/Item");

// Create Item
exports.createItem = async (req, res) => {
  try {
    const { serialNumber, name, color, parts } = req.body;

    const item = await Item.create({
      serialNumber,
      name,
      color,
      parts,
    });

    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// Get All Items
// Response shape UNCHANGED (still a plain array) — only perf fixes applied:
// - .lean() removes Mongoose document overhead
// - populate only pulls floor "name", not the whole Floor doc (which was
//   dragging along the huge base64 "shape" field on every single item)
exports.getItems = async (req, res) => {
  try {
    const items = await Item.find()
      .sort({ createdAt: -1 })
      .populate("parts.floorId", "name")
      .lean();

    res.json(items);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// Delete Item
exports.deleteItem = async (req, res) => {
  try {
    await Item.findByIdAndDelete(req.params.id);

    res.json({
      message: "Item deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// Search
// Response shape UNCHANGED — same perf fixes as getItems.
exports.searchItems = async (req, res) => {
  try {
    const keyword = req.query.keyword;

    const items = await Item.find({
      $or: [
        {
          name: {
            $regex: keyword,
            $options: "i",
          },
        },
        {
          serialNumber: {
            $regex: keyword,
            $options: "i",
          },
        },
        {
          color: {
            $regex: keyword,
            $options: "i",
          },
        },
      ],
    })
      .populate("parts.floorId", "name")
      .lean();

    res.json(items);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// Update Part Stock and/or Location
// Unchanged from your original — kept as a hydrated document since it needs
// .id() and .save(), which .lean() docs don't support.
exports.updatePartStock = async (req, res) => {
  try {
    const { itemId, partId } = req.params;
    const { field, change, floorId, area } = req.body;

    const item = await Item.findById(itemId);

    if (!item) {
      return res.status(404).json({
        message: "Item not found",
      });
    }

    const part = item.parts.id(partId);

    if (!part) {
      return res.status(404).json({
        message: "Part not found",
      });
    }

    // Update location (floor + area) only
    if (floorId !== undefined) part.floorId = floorId || null;
    if (area !== undefined) part.area = area;

    // Allowed inventory fields
    const allowedFields = ["reserved", "damaged", "sold"];

    if (field) {
      if (!allowedFields.includes(field)) {
        return res.status(400).json({
          message: "Invalid field",
        });
      }

      // Increase
      if (change > 0) {
        if (part.stock <= 0) {
          return res.status(400).json({
            message: "No stock available",
          });
        }

        part[field] += 1;
        part.stock -= 1;
      }

      // Decrease
      if (change < 0) {
        if (part[field] <= 0) {
          return res.status(400).json({
            message: `${field} cannot go below zero`,
          });
        }

        part[field] -= 1;
        part.stock += 1;
      }
    }

    await item.save();
    await item.populate("parts.floorId", "name");

    const updatedPart = item.parts.id(partId);

    res.json(updatedPart);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
