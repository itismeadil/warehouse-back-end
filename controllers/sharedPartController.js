const mongoose = require("mongoose");
const SharedPart = require("../models/SharedPart");
const Item = require("../models/Item");
const cloudinary = require("cloudinary").v2;

// Attaches a `combinedStock` field to a (lean) SharedPart doc = the sum of
// item.stock across every linked item. This is the number of physical
// units of the shared part that must exist — one per unit of any linked
// item, regardless of which color that unit is. It is always derived, never
// stored, so it can never drift out of sync with the items' real stock.
const withComputedStock = async (sharedPartsLean) => {
  const allItemIds = [
    ...new Set(
      sharedPartsLean.flatMap((sp) => sp.items.map((i) => i.toString())),
    ),
  ];

  const items = await Item.find({ _id: { $in: allItemIds } })
    .select("name color serialNumber stock")
    .lean();
  const itemsById = new Map(items.map((i) => [i._id.toString(), i]));

  return sharedPartsLean.map((sp) => {
    const linkedItems = sp.items
      .map((id) => itemsById.get(id.toString()))
      .filter(Boolean);

    return {
      ...sp,
      linkedItems,
      combinedStock: linkedItems.reduce((sum, i) => sum + (i.stock || 0), 0),
    };
  });
};

// List all shared parts, or only the ones linked to a given item
// (?itemId=...) — used by ItemDetail to render an item's shared parts.
exports.getSharedParts = async (req, res) => {
  try {
    const { itemId } = req.query;
    const filter = itemId ? { items: itemId } : {};

    const sharedParts = await SharedPart.find(filter)
      .populate("floorId", "name")
      .sort({ createdAt: -1 })
      .lean();

    res.json(await withComputedStock(sharedParts));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a brand new shared part, linked to one or more items from the
// start (usually just the item the admin is currently on).
exports.createSharedPart = async (req, res) => {
  try {
    const { name, items, floorId, areas } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: "A shared part must be linked to at least one item",
      });
    }

    const foundItems = await Item.find({ _id: { $in: items } }).select(
      "_id",
    );
    if (foundItems.length !== items.length) {
      return res.status(404).json({ message: "One or more items not found" });
    }

    const sharedPart = await SharedPart.create({
      name: name || "",
      items,
      floorId: floorId || null,
      areas: areas || [],
    });

    await sharedPart.populate("floorId", "name");
    const [withStock] = await withComputedStock([sharedPart.toObject()]);

    res.status(201).json(withStock);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Link an already-existing shared part to another item — this is the
// operation that solves the "gold table needs the same legs as the silver
// table" problem: no new location is created, the gold item just starts
// pointing at the same SharedPart document.
exports.linkItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { itemId } = req.body;

    if (!itemId) {
      return res.status(400).json({ message: "itemId is required" });
    }

    const item = await Item.findById(itemId).select("_id");
    if (!item) return res.status(404).json({ message: "Item not found" });

    const sharedPart = await SharedPart.findByIdAndUpdate(
      id,
      { $addToSet: { items: itemId } },
      { new: true },
    ).populate("floorId", "name");

    if (!sharedPart) {
      return res.status(404).json({ message: "Shared part not found" });
    }

    const [withStock] = await withComputedStock([sharedPart.toObject()]);
    res.json(withStock);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Unlink an item from a shared part. If that was the last item linked, the
// shared part is deleted outright — a shared part with nothing sharing it
// is just an ordinary orphaned location and shouldn't linger.
exports.unlinkItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { itemId } = req.body;

    const sharedPart = await SharedPart.findById(id);
    if (!sharedPart) {
      return res.status(404).json({ message: "Shared part not found" });
    }

    sharedPart.items = sharedPart.items.filter(
      (existing) => existing.toString() !== itemId,
    );

    if (sharedPart.items.length === 0) {
      await sharedPart.deleteOne();
      return res.json({ deleted: true });
    }

    await sharedPart.save();
    await sharedPart.populate("floorId", "name");
    const [withStock] = await withComputedStock([sharedPart.toObject()]);
    res.json(withStock);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update location, damaged count, and/or damage description — mirrors
// itemController.updatePartStock, but the damaged cap is checked against
// the COMBINED stock of every linked item, since one damaged shared part
// affects every color variant that relies on it.
exports.updateSharedPart = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, floorId, areas, field, change, damageDescription } =
      req.body;

    const sharedPart = await SharedPart.findById(id);
    if (!sharedPart) {
      return res.status(404).json({ message: "Shared part not found" });
    }

    if (
      req.user.role === "worker" &&
      (floorId !== undefined || areas !== undefined || name !== undefined)
    ) {
      return res.status(403).json({
        message:
          "Workers cannot update location directly. Use location change request instead.",
      });
    }

    if (name !== undefined) sharedPart.name = name;
    if (floorId !== undefined) sharedPart.floorId = floorId || null;
    if (areas !== undefined) sharedPart.areas = areas;
    if (damageDescription !== undefined) {
      sharedPart.damageDescription = damageDescription;
    }

    if (field) {
      if (field !== "damaged") {
        return res.status(400).json({ message: "Invalid field" });
      }

      const linkedItems = await Item.find({
        _id: { $in: sharedPart.items },
      }).select("stock");
      const combinedStock = linkedItems.reduce(
        (sum, i) => sum + (i.stock || 0),
        0,
      );
      const availableForDamage = combinedStock - sharedPart.damaged;

      if (change > 0) {
        if (availableForDamage < 1) {
          return res.status(400).json({
            message: `Cannot mark more units as damaged. Only ${availableForDamage} units available across all linked items.`,
            availableForDamage,
            combinedStock,
          });
        }
        sharedPart.damaged += 1;
      }

      if (change < 0) {
        if (sharedPart.damaged <= 0) {
          return res
            .status(400)
            .json({ message: "damaged cannot go below zero" });
        }
        const newDamaged = sharedPart.damaged - 1;
        if (newDamaged < sharedPart.photos.length) {
          return res.status(400).json({
            message:
              "Remove some damage photos before reducing damaged count below the photo count",
          });
        }
        sharedPart.damaged -= 1;
      }
    }

    await sharedPart.save();
    await sharedPart.populate("floorId", "name");
    const [withStock] = await withComputedStock([sharedPart.toObject()]);
    res.json(withStock);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.uploadSharedPartPhotos = async (req, res) => {
  try {
    const { id } = req.params;
    const sharedPart = await SharedPart.findById(id);
    if (!sharedPart) {
      return res.status(404).json({ message: "Shared part not found" });
    }

    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const remainingSlots = sharedPart.damaged - sharedPart.photos.length;
    if (remainingSlots <= 0) {
      return res.status(400).json({
        message: `Photo limit reached (${sharedPart.damaged} max, tied to damaged count)`,
      });
    }

    const accepted = files.slice(0, remainingSlots);
    accepted.forEach((file) => {
      sharedPart.photos.push({
        url: file.path,
        publicId: file.filename || null,
      });
    });

    await sharedPart.save();
    const [withStock] = await withComputedStock([sharedPart.toObject()]);
    res.status(201).json(withStock);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteSharedPartPhoto = async (req, res) => {
  try {
    const { id, photoId } = req.params;
    const sharedPart = await SharedPart.findById(id);
    if (!sharedPart) {
      return res.status(404).json({ message: "Shared part not found" });
    }

    const photo = sharedPart.photos.id(photoId);
    if (!photo) return res.status(404).json({ message: "Photo not found" });

    if (photo.publicId) {
      try {
        await cloudinary.uploader.destroy(photo.publicId);
      } catch (cloudErr) {
        console.error("Cloudinary delete failed:", cloudErr.message);
      }
    }

    sharedPart.photos = sharedPart.photos.filter(
      (p) => p._id.toString() !== photoId,
    );
    await sharedPart.save();
    const [withStock] = await withComputedStock([sharedPart.toObject()]);
    res.json(withStock);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteSharedPart = async (req, res) => {
  try {
    await SharedPart.findByIdAndDelete(req.params.id);
    res.json({ message: "Shared part deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Exported for other controllers (itemController, floorController) that
// need to fold shared parts into an item's part list or a floor's
// occupancy view without duplicating the population logic.
exports.withComputedStock = withComputedStock;
