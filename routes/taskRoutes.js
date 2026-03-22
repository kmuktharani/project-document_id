const express = require("express");
const router = express.Router();
const taskController = require("../controllers/task.controller");
const taskFileUpload = require("../middleware/taskFileUpload");
const { authenticate, authorize } = require("../middleware/auth.middleware");

router.get("/admin/tasks", authenticate, authorize("admin"), taskController.getAllTasks);

router.get("/admin/tasks/completed", authenticate, authorize("admin"), taskController.getCompletedTasks);

router.get("/admin/tasks/assigned", authenticate, authorize("admin"), taskController.getAssignedTasks);

router.get("/admin/tasks/overdue", authenticate, authorize("admin"), taskController.getOverdueTasks);

router.get("/admin/tasks/stats", authenticate, authorize("admin"), taskController.getTaskStats);

router.get("/team-tasks", authenticate, authorize("team_lead"), taskController.getTeamTasks);
router.get("/manager-tasks", authenticate, authorize("manager"), taskController.getManagerTasks);
router.post("/assign", authenticate, authorize("manager", "team_lead"), taskController.assignTask);
router.get("/my-tasks", authenticate, taskController.getMyTasks);
router.delete("/files/:file_id", authenticate, taskController.deleteTaskFile);
router.put("/:task_id", authenticate, taskController.updateTaskStatus);
router.post("/:task_id/files", authenticate, taskFileUpload.single("file"), taskController.uploadTaskFile);
router.get("/:task_id/files", authenticate, taskController.getTaskFiles);

module.exports = router;