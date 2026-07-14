const Item = require("../models/Item");

// Create Item
exports.createItem = async (req, res) => {
  try {
    const { serialNumber, name, parts } = req.body;

    const item = await Item.create({
      serialNumber,
      name,
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
exports.getItems = async (req, res) => {
  try {
    const items = await Item.find().sort({
      createdAt: -1,
    });

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
      ],
    });

    res.json(items);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// Update Part Stock
exports.updatePartStock = async (req, res) => {
  try {
    const { itemId, partId } = req.params;
    const { field, change, location } = req.body;

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

    // Update location only
    if (location !== undefined) {
      part.location = location;
    }

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

    res.json(part);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
