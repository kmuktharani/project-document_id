const express = require("express");
const router = express.Router();
const { trackActivity, getActivityLogs } = require("../controllers/activityController");
const { authenticate } = require("../middleware/auth.middleware");

// POST /api/activity  (this matches your .NET service)
router.post("/activity", trackActivity);
router.get("/activity/logs", authenticate, getActivityLogs);

module.exports = router;