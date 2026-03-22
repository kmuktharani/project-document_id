const Attendance = require("../models/attendance");

exports.addIdleEvent = async (req, res) => {
    try {
        const {
            employeeId,
            attendanceId,
            startTime,
            endTime,
            durationSeconds
        } = req.body;

        console.log(
            "Idle event add",
            employeeId,
            startTime,
            endTime,
            durationSeconds,
            attendanceId
        );

        if (!attendanceId || !startTime || !endTime) {
            return res.status(400).json({
                message: "attendanceId, startTime, endTime required"
            });
        }

        const attendance = await Attendance.findById(attendanceId);

        if (!attendance) {
            return res.status(404).json({
                message: "Attendance record not found"
            });
        }

        const duration = Number(durationSeconds) || 0;

        // 🔥 Push correct schema field (duration NOT durationSeconds)
        attendance.idleEvents.push({
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            duration: duration
        });

        // 🔥 Accumulate properly
        attendance.totalIdleTime =
            (attendance.totalIdleTime || 0) + duration;

        // 🔥 If user just finished idle, mark active
        attendance.status = "active";
        attendance.isIdle = false;
        attendance.lastIdleStatusUpdate = new Date(endTime);

        await attendance.save();

        res.json({
            success: true,
            message: "Idle event recorded",
            totalIdleTime: attendance.totalIdleTime
        });

    } catch (error) {
        console.error("Idle Event Error:", error);
        res.status(500).json({ message: "Server error" });
    }
};