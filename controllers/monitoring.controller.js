const TrackerLog = require("../models/TrackerLog");
const User = require("../models/user");
const mongoose = require("mongoose");

exports.getEmployeeMonitoring = async (req, res) => {
    try {
        const { date } = req.query;

        const startDate = date ? new Date(date) : new Date();
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);

        const employees = await User.find({ role: "employee", isDeleted: false });

        const monitoringData = await Promise.all(
            employees.map(async (emp) => {
                const logs = await TrackerLog.find({
                    employeeId: emp._id,
                    timestamp: { $gte: startDate, $lte: endDate }
                }).sort({ timestamp: 1 });

                if (logs.length === 0) {
                    return {
                        id: emp._id,
                        name: `${emp.firstName} ${emp.lastName}`,
                        loginTime: "-",
                        activeHours: "-",
                        screenshots: 0,
                        idleTime: "-",
                        status: "inactive",
                        screenshotUrls: [],
                        logs: []
                    };
                }

                const loginTime = logs[0].timestamp;
                const activeLogs = logs.filter(l => l.status === "active");
                const idleLogs = logs.filter(l => l.status === "idle");

                const activeMinutes = activeLogs.length * 0.5;
                const idleMinutes = idleLogs.length * 0.5;

                const activeHours = Math.floor(activeMinutes / 60);
                const activeMins = Math.floor(activeMinutes % 60);
                const idleHrs = Math.floor(idleMinutes / 60);
                const idleMins = Math.floor(idleMinutes % 60);

                const activityLogs = [];
                const appMap = {};
                
                logs.forEach(log => {
                    if (log.activeApp && !appMap[log.activeApp]) {
                        appMap[log.activeApp] = true;
                        activityLogs.push({
                            time: log.timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }),
                            activity: `Working on ${log.activeApp}`
                        });
                    }
                });

                return {
                    id: emp._id,
                    name: `${emp.firstName} ${emp.lastName}`,
                    loginTime: loginTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }),
                    activeHours: `${activeHours}h ${activeMins}m`,
                    screenshots: 0,
                    idleTime: idleHrs > 0 ? `${idleHrs}h ${idleMins}m` : `${idleMins}m`,
                    status: logs[logs.length - 1].status,
                    screenshotUrls: [],
                    logs: activityLogs.slice(0, 10)
                };
            })
        );

        res.json(monitoringData);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch monitoring data" });
    }
};
