const Item = require("../models/Item");
// Cloudinary is globally configured in config/upload.js (required by the
// routes at startup), so we can safely use it here to delete assets.
const cloudinary = require("cloudinary").v2;

// Create Item
exports.createItem = async (req, res) => {
  try {
    const {
      serialNumber,
      name,
      color,
      supplierId,
      stock,
      reserved,
      sold,
      parts,
    } = req.body;

    const item = await Item.create({
      serialNumber,
      name,
      color,
      supplierId: supplierId || null,
      stock: stock || 0,
      reserved: reserved || 0,
      sold: sold || 0,
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
// item.stock/reserved/sold ride along automatically since they're now
// top-level fields on the Item doc.
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

// Update Part: damaged count, location, and/or damage description.
// Damaged is fully independent of stock now — marking a part damaged is
// just a counter change on the part, it does NOT move any units in/out of
// item.stock.
exports.updatePartStock = async (req, res) => {
  try {
    const { itemId, partId } = req.params;
    const { field, change, floorId, area, damageDescription } = req.body;

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

    // Update the damage note the supplier sees. Sent on its own or alongside
    // a stock change — both work.
    if (damageDescription !== undefined) {
      part.damageDescription = damageDescription;
    }

    if (field) {
      if (field !== "damaged") {
        return res.status(400).json({
          message: "Invalid field",
        });
      }

      // Increase
      if (change > 0) {
        part.damaged += 1;
      }

      // Decrease
      if (change < 0) {
        if (part.damaged <= 0) {
          return res.status(400).json({
            message: "damaged cannot go below zero",
          });
        }

        // Guard: don't let `damaged` drop below the number of photos
        // already attached — remove photos first instead of silently
        // losing the ability to see them.
        const newDamaged = part.damaged - 1;
        if (newDamaged < part.photos.length) {
          return res.status(400).json({
            message:
              "Remove some damage photos before reducing damaged count below the photo count",
          });
        }

        part.damaged -= 1;
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
// Parts no longer carry a `stock` field, so it's dropped here; only
// location is set on creation.
exports.addPart = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { floorId, area } = req.body;

    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ message: "Item not found" });

    item.parts.push({
      floorId: floorId || null,
      area: area || null,
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
      // file.path = Cloudinary secure URL, file.filename = Cloudinary public_id
      part.photos.push({ url: file.path, publicId: file.filename || null });
    });

    await item.save();

    res.status(201).json(part);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// Delete a single damage photo — removes it from the DB and from Cloudinary.
exports.deletePartPhoto = async (req, res) => {
  try {
    const { itemId, partId, photoId } = req.params;

    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ message: "Item not found" });

    const part = item.parts.id(partId);
    if (!part) return res.status(404).json({ message: "Part not found" });

    const photo = part.photos.id(photoId);
    if (!photo) return res.status(404).json({ message: "Photo not found" });

    // Best-effort delete from Cloudinary; don't fail the request if the
    // remote delete errors (the DB record is what the UI relies on).
    if (photo.publicId) {
      try {
        await cloudinary.uploader.destroy(photo.publicId);
      } catch (cloudErr) {
        console.error("Cloudinary delete failed:", cloudErr.message);
      }
    }

    part.photos = part.photos.filter((p) => p._id.toString() !== photoId);
    await item.save();

    res.json(part);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};
