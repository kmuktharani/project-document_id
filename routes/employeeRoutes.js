const express = require("express");
const { createEmployee, getAllEmployees, updateEmployee, deleteEmployee, getDirectory, getDirectoryById, getEmployeeList } = require("../controllers/employeeController.js");
const { authenticate, authorize } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/", authenticate, getEmployeeList);
router.get("/all", authenticate, getAllEmployees);
router.get("/directory", authenticate, getDirectory);
router.get("/directory/:id", authenticate, getDirectoryById);
router.post("/create", authenticate, authorize('admin', 'manager'), createEmployee);
router.put("/update/:id", authenticate, authorize('admin', 'manager'), updateEmployee);
router.delete("/delete/:id", authenticate, authorize('admin', 'manager'), deleteEmployee);

module.exports = router;