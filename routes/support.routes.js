const express = require("express");
const router = express.Router();
const supportController = require("../controllers/supportController");
const { authenticate } = require("../middleware/auth.middleware");

router.post("/tickets", authenticate, supportController.createTicket);
router.get("/tickets", authenticate, supportController.getTickets);

module.exports = router;
