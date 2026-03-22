const express = require("express");
const router = express.Router();
const trackerController = require("../controllers/tracker.controller");
const { authenticate } = require("../middleware/auth.middleware");

router.post("/status", trackerController.updateStatus);
router.post("/heartbeat", trackerController.heartbeat);
router.post(
    "/screenshot",
    trackerController.upload.single("screenshot"),
    trackerController.uploadScreenshot
);
router.get("/logs", authenticate, trackerController.getMonitoringLogs);

module.exports = router;
