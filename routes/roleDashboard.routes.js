const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/auth.middleware");
const dashboardController = require("../controllers/roleDashboard.controller");

router.get("/admin", authenticate, authorize("admin"), dashboardController.getAdminDashboard);
router.get("/hr", authenticate, authorize("hr"), dashboardController.getHrDashboard);
router.get("/manager", authenticate, authorize("manager"), dashboardController.getManagerDashboard);
router.get("/team-lead", authenticate, authorize("team_lead"), dashboardController.getTeamLeadDashboard);
router.get("/project-manager", authenticate, authorize("project_manager"), dashboardController.getProjectManagerDashboard);
router.get("/employee", authenticate, authorize("employee"), dashboardController.getEmployeeDashboard);

module.exports = router;