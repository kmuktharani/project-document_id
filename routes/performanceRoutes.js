const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/auth.middleware");
const performanceController = require("../controllers/performanceController");

router.use(authenticate);

router.get("/my-performance", performanceController.getMyPerformance);
router.get("/settings", authorize("admin", "manager"), performanceController.getPerformanceSettings);
router.put("/settings", authorize("admin", "manager"), performanceController.updatePerformanceSettings);

module.exports = router;
