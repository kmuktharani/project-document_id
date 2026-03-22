const express = require('express');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { applyLeave, getLeaveHistory, getOwnLeaveHistory, updateLeaveStatus } = require('../controllers/leave.controller');

const router = express.Router();

router.post('/apply', authenticate, authorize('employee', 'team_lead', 'manager', 'hr'), applyLeave);
router.get('/history', authenticate, authorize('manager', 'hr','admin'), getLeaveHistory);
router.get('/my-history', authenticate, getOwnLeaveHistory);
router.patch('/:leaveId', authenticate, authorize('manager', 'hr', 'admin'), updateLeaveStatus);

module.exports = router;
