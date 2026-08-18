const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");

dotenv.config();

const connectDB = require("./config/db");
const Floor = require("./models/Floor");

connectDB();

const itemRoutes = require("./routes/itemRoutes");
const floorRoutes = require("./routes/floorRoutes");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const sharedPartRoutes = require("./routes/sharedPartRoutes");

const app = express();

// AUTH_MODE controls how the auth token is transported:
// - "bearer" (default): token returned in JSON body, client sends it via
//   Authorization header. No cookies involved, works without HTTPS/a real domain.
// - "cookie": token sent via httpOnly cookie. Requires HTTPS in production
//   (secure: true + sameSite: "none") and credentials: true on both CORS
//   and the frontend's fetch/axios config.
console.log("AUTH_MODE:", process.env.AUTH_MODE || "bearer (default)");
console.log("CORS origin set to:", process.env.FRONTEND_URL);

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: process.env.AUTH_MODE === "cookie",
  }),
);

app.use(express.json());

if (process.env.AUTH_MODE === "cookie") {
  app.use(cookieParser());
}

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/floors", floorRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/shared-parts", sharedPartRoutes);

app.get("/", (req, res) => {
  res.send("Warehouse API Running");
});

const PORT = process.env.PORT || 5000;

// Cleanup job to permanently delete floors after 3 days
const cleanupDeletedFloors = async () => {
  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const result = await Floor.deleteMany({
      deletedAt: { $lt: threeDaysAgo },
    });
    if (result.deletedCount > 0) {
      console.log(
        `Cleanup: Permanently deleted ${result.deletedCount} floors older than 3 days`,
      );
    }
  } catch (error) {
    console.error("Cleanup job error:", error);
  }
};

// Run cleanup job every hour
setInterval(cleanupDeletedFloors, 60 * 60 * 1000);

// Run cleanup once on server start
cleanupDeletedFloors();

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
