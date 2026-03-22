const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");
const { authenticate, authorize } = require("../middleware/auth.middleware");

router.get("/", authenticate, dashboardController.getRoleDashboard);

router.get("/admin", authenticate, authorize("Admin"), dashboardController.getAdminDashboard);
router.get("/hr", authenticate, authorize("HR"), dashboardController.getHrDashboard);
router.get("/manager", authenticate, authorize("Manager"), dashboardController.getManagerDashboard);
router.get("/team-lead", authenticate, authorize("Team Lead"), dashboardController.getTeamLeadDashboard);
router.get("/project-manager", authenticate, authorize("Project Manager"), dashboardController.getProjectManagerDashboard);
router.get("/employee", authenticate, authorize("Employee"), dashboardController.getEmployeeDashboard);

router.get("/stats", dashboardController.getDashboardStats);
router.get("/tasks", dashboardController.getTaskData);
router.get("/productivity", dashboardController.getProductivityData);
router.get("/distribution", dashboardController.getTaskDistribution);
router.get("/admin/metrics", dashboardController.getAdvancedAdminMetrics);

module.exports = router;