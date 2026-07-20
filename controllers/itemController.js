const Item = require("../models/Item");

// Create Item
exports.createItem = async (req, res) => {
  try {
    const { serialNumber, name, color, supplierId, parts } = req.body;

    const item = await Item.create({
      serialNumber,
      name,
      color,
      supplierId: supplierId || null,
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
// Response shape UNCHANGED (still a plain array) — perf fixes kept as-is:
// - .lean() removes Mongoose document overhead
// - populate only pulls floor "name", not the whole Floor doc (which was
//   dragging along the huge base64 "shape" field on every single item)
// Suppliers only ever get items assigned to them; admins get everything.
exports.getItems = async (req, res) => {
  try {
    const filter =
      req.user.role === "supplier" ? { supplierId: req.user._id } : {};

    const items = await Item.find(filter)
      .sort({ createdAt: -1 })
      .populate("parts.floorId", "name")
      .populate("supplierId", "name email")
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
// Response shape UNCHANGED — same perf fixes as getItems, same supplier
// filtering.
exports.searchItems = async (req, res) => {
  try {
    const keyword = req.query.keyword;

    const filter = {
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
    };

    if (req.user.role === "supplier") {
      filter.supplierId = req.user._id;
    }

    const items = await Item.find(filter)
      .populate("parts.floorId", "name")
      .populate("supplierId", "name email")
      .lean();

    res.json(items);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// Update Part Stock and/or Location
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

        // Guard: don't let `damaged` drop below the number of photos
        // already attached — remove photos first instead of silently
        // losing the ability to see them.
        if (field === "damaged") {
          const newDamaged = part.damaged - 1;
          if (newDamaged < part.photos.length) {
            return res.status(400).json({
              message:
                "Remove some damage photos before reducing damaged count below the photo count",
            });
          }
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
    console.error(error);
    res.status(500).json({
      message: error.message,
    });
  }
};

// Add a part to an existing item — admin-only, enforced in the routes.
exports.addPart = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { floorId, area, stock } = req.body;

    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ message: "Item not found" });

    item.parts.push({
      floorId: floorId || null,
      area: area || null,
      stock: parseInt(stock) || 0,
    });

    await item.save();
    await item.populate("parts.floorId", "name");

    res.status(201).json(item.parts[item.parts.length - 1]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Upload one or more damage photos to a part — capped at part.damaged
exports.uploadPartPhotos = async (req, res) => {
  try {
    const { itemId, partId } = req.params;

    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ message: "Item not found" });

    const part = item.parts.id(partId);
    if (!part) return res.status(404).json({ message: "Part not found" });

    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const remainingSlots = part.damaged - part.photos.length;
    if (remainingSlots <= 0) {
      return res.status(400).json({
        message: `Photo limit reached (${part.damaged} max, tied to damaged count)`,
      });
    }

    const accepted = files.slice(0, remainingSlots);
    accepted.forEach((file) => {
      part.photos.push({ url: file.path }); // file.path = Cloudinary URL
    });

    await item.save();

    res.status(201).json(part);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// Delete a single damage photo
exports.deletePartPhoto = async (req, res) => {
  try {
    const { itemId, partId, photoId } = req.params;

    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ message: "Item not found" });

    const part = item.parts.id(partId);
    if (!part) return res.status(404).json({ message: "Part not found" });

    part.photos = part.photos.filter((p) => p._id.toString() !== photoId);
    await item.save();

    res.json(part);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};
