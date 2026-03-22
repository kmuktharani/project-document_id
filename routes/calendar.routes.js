const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { createEvent, getCalendarEvents, createYearlyEvents, getYearlyEvents } = require('../controllers/calendar.controller');

const router = express.Router();

router.post('/calendar/events', authenticate, createEvent);
router.get('/calendar/events', authenticate, getCalendarEvents);
router.post('/calendar/yearly-events', authenticate, createYearlyEvents);
router.get('/calendar/yearly-events', authenticate, getYearlyEvents);

module.exports = router;
