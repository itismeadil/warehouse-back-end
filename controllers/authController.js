const bcrypt = require("bcryptjs");
const User = require("../models/User");
const {
  signToken,
  sendAuthToken,
  clearAuthToken,
} = require("../middleware/auth");

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
});

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = signToken(user);
    sendAuthToken(res, token, publicUser(user));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.logout = (req, res) => {
  clearAuthToken(res);
  res.json({ message: "Logged out" });
};

exports.me = async (req, res) => {
  res.json(publicUser(req.user));
};
