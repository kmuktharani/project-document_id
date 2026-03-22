const express = require("express");
const { getSentMails, getDrafts, getNotifications, sendMail, getIdleAlerts, sendWarningToEmployee } = require("../controllers/mailController");
const { authenticate, authorize } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/sent", authenticate, getSentMails);
router.get("/drafts", authenticate, getDrafts);
router.get("/notifications", authenticate, getNotifications);
router.post("/send", authenticate, sendMail);
router.get("/idle-alerts", authenticate, authorize('manager'), getIdleAlerts);
router.post("/send-warning", authenticate, authorize('manager'), sendWarningToEmployee);

module.exports = router;
