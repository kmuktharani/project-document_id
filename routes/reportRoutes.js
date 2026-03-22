const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/auth.middleware");
const reportController = require("../controllers/reportController");

router.use(authenticate);
router.use(authorize("admin", "hr", "manager"));

router.get("/attendance", reportController.getAttendanceReport);
router.get("/productivity", reportController.getProductivityReport);
router.get("/projects", reportController.getProjectProgressReport);
router.get("/performance", reportController.getEmployeePerformanceReport);

module.exports = router;
