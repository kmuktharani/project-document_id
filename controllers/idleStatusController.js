const Attendance = require("../models/attendance");
const User = require("../models/user");
const { sentMails } = require("../data/mailData");

exports.updateIdleStatus = async (req, res) => {
    try {
        const { employeeId, attendanceId, idleSeconds, isIdle, timestamp } = req.body;

        if (!employeeId) {
            return res.status(400).json({ message: "employeeId is required" });
        }

        let attendance = await Attendance.findById(attendanceId);

        if (!attendance) {
            return res.status(404).json({ message: "Attendance record not found"});
        }

        attendance.status = isIdle ? "idle" : "active";
        attendance.lastIdleStatusUpdate = timestamp;
        await attendance.save();

        if (isIdle && idleSeconds > 900) {
            const employee = await User.findById(employeeId).select('firstName lastName username email team');
            const manager = await User.findOne({ team: employee.team, role: 'manager' }).select('email firstName lastName');

            if (manager) {
                const idleMinutes = Math.floor(idleSeconds / 60);
                const notification = {
                    id: sentMails.length + 1,
                    to: manager.email,
                    subject: `Idle Alert: ${employee.firstName} ${employee.lastName} (${employee.username})`,
                    message: `Employee ${employee.firstName} ${employee.lastName} (${employee.username}) has been idle for ${idleMinutes} minutes. Team: ${employee.team || 'N/A'}`,
                    date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
                    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                    senderId: 'system',
                    senderRole: 'system',
                    type: 'idle-alert',
                    employeeId: employeeId,
                    employeeName: `${employee.firstName} ${employee.lastName}`,
                    employeeUsername: employee.username,
                    idleDuration: idleMinutes
                };
                sentMails.push(notification);
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error("Idle Status Error:", error);
        res.status(500).json({ message: "Server error" });
    }
};