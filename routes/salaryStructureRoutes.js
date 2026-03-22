const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/auth.middleware");
const controller = require("../controllers/salaryStructureController");

router.use(authenticate);
router.use(authorize("admin"));

router.post("/", controller.createSalaryStructure);
router.put("/:username", controller.updateSalaryStructure);
router.get("/:username", controller.getCurrentSalaryStructure);

module.exports = router;
