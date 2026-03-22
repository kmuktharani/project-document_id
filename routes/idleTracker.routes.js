const express = require("express");
const router = express.Router();
const Attendance = require("../models/attendance"); // your mongoose model

router.post("/idle-event", async (req, res) => {
    try {
        const { employeeId, startTime, endTime, durationSeconds, reason } = req.body;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        console.log(employeeId, startTime, endTime, durationSeconds, reason);

        await Attendance.updateOne(
            { employeeId, date: today },
            {
                $push: {
                    idleEvents: {
                        startTime,
                        endTime,
                        durationSeconds,
                        reason,
                    },
                },
                $inc: { totalIdleTime: durationSeconds },
                $setOnInsert: { employeeId, date: today },
            },
            { upsert: true }
        );

        res.json({ success: true });
    } catch (error) {
        console.error("Idle Event Error:", error);
        res.status(500).json({ success: false });
    }
});

module.exports = router;