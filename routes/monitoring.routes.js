const express = require("express");
const router = express.Router();
const monitoringController = require("../controllers/monitoring.controller");
const { authenticate, authorize } = require("../middleware/auth.middleware");

router.get("/employees", authenticate, authorize("manager"), monitoringController.getEmployeeMonitoring);

module.exports = router;
