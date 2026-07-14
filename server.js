const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const connectDB = require("./config/db");

connectDB();

const itemRoutes = require("./routes/itemRoutes");

const app = express();

app.use(cors());

app.use(express.json());

app.use("/api/items", itemRoutes);

app.get("/", (req, res) => {
  res.send("Warehouse API Running");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
