const express = require("express");
const { login, changePassword, logout } = require("../controllers/auth.controller");
const { authenticate } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/login", login);
router.post("/logout", authenticate, logout);
router.put("/change-password", authenticate, changePassword);

module.exports = router;