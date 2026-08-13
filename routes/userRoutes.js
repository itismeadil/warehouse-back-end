const express = require("express");
const router = express.Router();

const {
  createUser,
  getUsers,
  deleteUser,
} = require("../controllers/userController");

const { requireAuth, requireRole } = require("../middleware/auth");

router.use(requireAuth, requireRole("admin", "manager"));

router.post("/", createUser);
router.get("/", getUsers);
router.delete("/:id", deleteUser);

module.exports = router;
