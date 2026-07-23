const jwt = require("jsonwebtoken");
const User = require("../models/User");

const COOKIE_NAME = "token";

// Only used when AUTH_MODE === "cookie".
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

// Sends the token back to the client using whichever transport AUTH_MODE
// specifies. Switching modes later = change one env var, nothing else.
const sendAuthToken = (res, token, user) => {
  if (process.env.AUTH_MODE === "cookie") {
    res.cookie(COOKIE_NAME, token, cookieOptions);
    return res.json({ user }); // token stays server-side, not in body
  }
  return res.json({ token, user });
};

const clearAuthToken = (res) => {
  if (process.env.AUTH_MODE === "cookie") {
    res.clearCookie(COOKIE_NAME, cookieOptions);
  }
  // bearer mode: nothing to clear server-side, client deletes localStorage
};

// Reads the token from a cookie OR an Authorization header, whichever is
// present. This means requireAuth doesn't change when you flip AUTH_MODE.
const getToken = (req) => {
  if (req.cookies?.[COOKIE_NAME]) return req.cookies[COOKIE_NAME];
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) return authHeader.split(" ")[1];
  return null;
};

// Reads the token, verifies it, and attaches the user to req.user.
// Every route that needs a logged-in user of any role uses this first.
const requireAuth = async (req, res, next) => {
  try {
    const token = getToken(req);
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
  sendAuthToken,
  clearAuthToken,
  requireAuth,
  requireRole,
};
