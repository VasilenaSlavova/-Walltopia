// Public: the Walltopia preliminary-load tables (wall + boulder, EU + US) + metadata.
// Same data the calculator needs on web and mobile. Static reference data — cached hard.
const express = require("express");
const path = require("path");
const fs = require("fs");

const router = express.Router();
const LOADS = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "loads.json"), "utf8"));

router.get("/", (req, res) => {
  res.set("Cache-Control", "public, max-age=86400");
  res.json(LOADS);
});

module.exports = router;
