const express = require("express");

const router = express.Router();

const {
  createItem,
  getItems,
  deleteItem,
  updatePartStock,
  searchItems,
} = require("../controllers/itemController");

router.post("/", createItem);

router.get("/", getItems);

router.get("/search", searchItems);

router.patch("/:itemId/parts/:partId", updatePartStock);

router.delete("/:id", deleteItem);

module.exports = router;
