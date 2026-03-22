const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/auth.middleware");
//
// const payrollController = require("../controllers/payroll.controller");
//
// // GET /api/payroll
// router.get("/",authenticate, payrollController.getPayrolls);

module.exports = router;
