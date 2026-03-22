const ActivityLog = require("../models/ActivityLog");
const User = require("../models/user");

exports.trackActivity = async (req, res) => {
    try {
        const {
            employee_id,
            app_name,
            window_title,
            start_time,
            end_time,
            duration_seconds
        } = req.body;
        console.log(req.body);

        if (!employee_id || !app_name || !window_title) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields",
            });
        }

        const start = new Date(start_time);
        const end = new Date(end_time);

        const day = new Date(start);
        day.setHours(0, 0, 0, 0);

        const filter = {
            employee_id,
            app_name,
            window_title,
            day
        };

        const update = {
            $setOnInsert: {
                employee_id,
                app_name,
                window_title,
                start_time: start,
                day,
                created_at: new Date()
            },
            $set: {
                end_time: end,
                updated_at: new Date()
            },
            $inc: {
                duration_seconds: Math.max(1, duration_seconds || 1)
            }
        };

        const options = { upsert: true };

        const result = await ActivityLog.updateOne(filter, update, options);

        res.status(200).json({
            success: true,
            message: result.upsertedCount
                ? "New session created"
                : "Session updated (duration incremented)",
        });

    } catch (error) {
        console.error("Activity tracking error:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
        });
    }
};

exports.getActivityLogs = async (req, res) => {
    try {
        const { employee_id, start_date, end_date } = req.query;
        const userRole = req.user.role;
        const userId = req.user.id;

        const filter = {};

        if (userRole === 'employee' || userRole === 'team_lead') {
            filter.employee_id = userId;
        } else if (userRole === 'manager') {
            const manager = await User.findById(userId).select('teams');
            const teamMembers = await User.find({ teams: { $in: manager.teams }, isDeleted: false }).select('_id');
            const memberIds = teamMembers.map(m => m._id.toString());
            filter.employee_id = { $in: [...memberIds, userId] };
        } else if (employee_id) {
            filter.employee_id = employee_id;
        }

        if (start_date || end_date) {
            filter.day = {};
            if (start_date) filter.day.$gte = new Date(start_date);
            if (end_date) filter.day.$lte = new Date(end_date);
        }

        const logs = await ActivityLog.find(filter).sort({ day: -1, created_at: -1 });

        res.status(200).json({
            success: true,
            count: logs.length,
            data: logs
        });
    } catch (error) {
        console.error("Get activity logs error:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};