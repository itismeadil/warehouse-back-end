const jwt = require("jsonwebtoken");
const User = require("../models/User");

const COOKIE_NAME = "token";

// Cross-site cookies (frontend and backend on different domains, e.g.
// vercel.app talking to onrender.com) require both of these:
// - secure: true     -> cookie only sent over HTTPS
// - sameSite: "none" -> allows the cookie to be sent on cross-site requests
// "lax" silently blocks the cookie on cross-site XHR/fetch, which is why
// login succeeded but every following request came back 401.
const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

// Reads the token cookie, verifies it, and attaches the user to req.user.
// Every route that needs a logged-in user of any role uses this first.
const requireAuth = async (req, res, next) => {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id).select("-passwordHash");
    if (!user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: "Not authenticated" });
  }
};

// Use after requireAuth to restrict a route to specific roles, e.g.
// requireRole("admin") or requireRole("admin", "supplier").
const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };

module.exports = {
  COOKIE_NAME,
  cookieOptions,
  signToken,
  requireAuth,
  requireRole,
};
