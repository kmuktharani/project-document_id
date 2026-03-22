const express = require('express');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { checkIn, checkOut, startBreak, endBreak, getAttendance, getCurrentSession, getMissingCheckouts, getTeamAttendance, toggleAvailability, getAvailableMembers } = require('../controllers/attendance.controller');

const router = express.Router();

router.post('/checkin', authenticate, authorize('hr', 'manager', 'team_lead', 'employee'), checkIn);
router.post('/checkout', authenticate, authorize('hr', 'manager', 'team_lead', 'employee'), checkOut);
router.post('/break/start', authenticate, authorize('hr', 'manager', 'team_lead', 'employee'), startBreak);
router.post('/break/end', authenticate, authorize('hr', 'manager', 'team_lead', 'employee'), endBreak);
router.get('/records', authenticate, getAttendance);
router.get('/session', authenticate, getCurrentSession);
router.get('/missing-checkouts', authenticate, getMissingCheckouts);
router.get('/team-records', authenticate, getTeamAttendance);
router.patch('/toggle-availability', authenticate, toggleAvailability);
router.get('/available', authenticate, getAvailableMembers);

module.exports = router;
