const Tracker = require("../models/Tracker");
const TrackerLog = require("../models/TrackerLog");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

exports.updateStatus = async (req, res) => {
    try {
        const { employeeId, status, activeApp, keyboardActive } = req.body;

        let tracker = await Tracker.findOne({ UserID: employeeId });

        if (!tracker) {
            tracker = new Tracker({ UserID: employeeId });
        }

        tracker.status = status;
        tracker.activeApp = activeApp;
        tracker.keyboardActive = keyboardActive;
        tracker.lastStatusUpdate = new Date();

        await tracker.save();

        res.json({ message: "Status updated" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Status update failed" });
    }
};

// HEARTBEAT
exports.heartbeat = async (req, res) => {
    try {
        const { employeeId, activeApp, keyboardActive } = req.body;

        let tracker = await Tracker.findOne({ UserID: employeeId });

        if (!tracker) {
            tracker = new Tracker({ UserID: employeeId });
        }

        const status = keyboardActive ? "active" : "idle";
        
        await TrackerLog.create({
            employeeId,
            status,
            activeApp,
            keyboardActive,
            timestamp: new Date()
        });

        tracker.lastHeartbeat = new Date();
        tracker.activeApp = activeApp;
        tracker.keyboardActive = keyboardActive;
        tracker.status = status;

        await tracker.save();

        res.json({ message: "Heartbeat received" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Heartbeat failed" });
    }
};

// Setup storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, "../screenshots");
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + "-" + file.originalname);
    },
});

exports.upload = multer({ storage });

exports.uploadScreenshot = async (req, res) => {
    try {
        const { employeeId } = req.body;

        res.json({ message: "Screenshot saved" });
    } catch (err) {
        res.status(500).json({ error: "Screenshot upload failed" });
    }
};

exports.getMonitoringLogs = async (req, res) => {
    try {
        const { employeeId, date } = req.query;
        const targetEmployeeId = employeeId || req.user?.id;

        if (!targetEmployeeId) {
            return res.status(400).json({ error: "employeeId is required" });
        }

        if (!mongoose.Types.ObjectId.isValid(targetEmployeeId)) {
            return res.status(400).json({ error: "Invalid employeeId format" });
        }

        const startDate = date ? new Date(date) : new Date();
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);

        const logs = await TrackerLog.aggregate([
            {
                $match: {
                    employeeId: new mongoose.Types.ObjectId(targetEmployeeId),
                    timestamp: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $sort: { timestamp: 1 }
            },
            {
                $group: {
                    _id: "$employeeId",
                    logs: { $push: "$$ROOT" },
                    totalActive: {
                        $sum: {
                            $cond: [{ $eq: ["$status", "active"] }, 1, 0]
                        }
                    },
                    totalIdle: {
                        $sum: {
                            $cond: [{ $eq: ["$status", "idle"] }, 1, 0]
                        }
                    }
                }
            }
        ]);

        if (!logs.length) {
            return res.json({
                total_active_time: 0,
                total_idle_time: 0,
                app_usage: []
            });
        }

        const result = logs[0];
        const appUsageMap = {};

        result.logs.forEach(log => {
            if (log.activeApp) {
                if (!appUsageMap[log.activeApp]) {
                    appUsageMap[log.activeApp] = { active: 0, idle: 0 };
                }
                if (log.status === "active") {
                    appUsageMap[log.activeApp].active++;
                } else if (log.status === "idle") {
                    appUsageMap[log.activeApp].idle++;
                }
            }
        });

        const appUsage = Object.entries(appUsageMap).map(([app, counts]) => ({
            app_name: app,
            active_count: counts.active,
            idle_count: counts.idle,
            total_count: counts.active + counts.idle
        })).sort((a, b) => b.total_count - a.total_count);

        res.json({
            total_active_time: result.totalActive,
            total_idle_time: result.totalIdle,
            app_usage: appUsage
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch monitoring logs" });
    }
};
