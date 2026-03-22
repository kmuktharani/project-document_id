const express = require("express");
const router = express.Router();
const { blockedAppsHandler , blockedSiteHandler} = require("../controllers/blockedController");

// GET /api/blocked-apps?employeeId=EMP123
router.get("/apps/", blockedAppsHandler);
router.get("/sites/", blockedSiteHandler);

module.exports = router;