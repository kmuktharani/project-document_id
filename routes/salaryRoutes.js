const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/auth.middleware");
const salaryController = require("../controllers/salaryController");

router.use(authenticate);

// Employee Routes
router.get("/employee/my-salary", salaryController.viewMySalary);
router.get("/employee/payslip/:month", salaryController.viewMyPayslip);
router.get("/employee/payslip/:month/download", salaryController.downloadPayslip);

// Admin Routes
router.use(authorize("admin"));
router.post("/generate", salaryController.generatePayroll);
router.get("/:month", salaryController.viewSalaries);
router.put("/modify/:recordId", salaryController.modifySalary);
router.put("/approve/:month", salaryController.approvePayroll);
router.put("/release/:month", salaryController.releasePayroll);
router.get("/history/:username", salaryController.salaryHistory);

module.exports = router;
