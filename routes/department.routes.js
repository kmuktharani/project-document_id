const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const departmentController = require('../controllers/department.controller');

// All routes require authentication and admin role ONLY
router.use(authenticate);
router.use(authorize('admin'));

// POST   /api/departments              - Create department
router.post('/', departmentController.createDepartment);

// GET    /api/departments              - Get all departments
router.get('/', departmentController.getAllDepartments);

// GET    /api/departments/:id          - Get department by ID
router.get('/:id', departmentController.getDepartmentById);

// PUT    /api/departments/:id          - Update department
router.put('/:id', departmentController.updateDepartment);

// DELETE /api/departments/:id          - Delete department
router.delete('/:id', departmentController.deleteDepartment);

// POST   /api/departments/:id/assign   - Assign employees to department
router.post('/:id/assign', departmentController.assignEmployees);

// POST   /api/departments/:id/remove   - Remove employees from department
router.post('/:id/remove', departmentController.removeEmployees);

module.exports = router;
