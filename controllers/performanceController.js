const { Task } = require("../models/Task");
const EmployeeTask = require("../models/EmployeeTask");
const Attendance = require("../models/attendance");
const PerformanceMetric = require("../models/PerformanceMetric");
const User = require("../models/user");
const PerformanceSettings = require("../models/PerformanceSettings");

exports.getMyPerformance = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const employeeId = req.user.id;
        const username = user.username;

        console.log("📊 Fetching performance for employee:", employeeId);

        // Get completed tasks with deadline info
        const completedTasks = await Task.find({
            assigned_to: username,
            status: "completed"
        }).select('deadline completedOn');
        
        const completedEmployeeTasks = await EmployeeTask.find({
            assignedTo: employeeId,
            status: "completed"
        }).select('deadline completedOn');

        // Count tasks and check for late completions
        let tasksCompleted = completedTasks.length;
        let lateTasksCount = 0;
        
        completedTasks.forEach(task => {
            if (task.deadline && task.completedOn && task.completedOn > task.deadline) {
                lateTasksCount++;
            }
        });
        
        completedEmployeeTasks.forEach(task => {
            if (task.deadline && task.completedOn && task.completedOn > task.deadline) {
                lateTasksCount++;
            }
        });
        
        const totalTasksCompleted = tasksCompleted + completedEmployeeTasks.length;
        
        console.log("✅ Tasks completed:", totalTasksCompleted);
        console.log("⏰ Late tasks:", lateTasksCount);

        // Get attendance records
        const attendanceRecords = await Attendance.find({
            employeeId: employeeId,
            checkIn: { $ne: null }
        });
        console.log("📅 Attendance records found:", attendanceRecords.length);

        let totalActiveHours = 0;

        attendanceRecords.forEach(record => {
            console.log("📊 Record:", {
                date: record.date,
                totalWorkHours: record.totalWorkHours
            });
            
            if (record.totalWorkHours && record.totalWorkHours > 0) {
                totalActiveHours += record.totalWorkHours;
            }
        });

        console.log("⏱️ Total work hours:", totalActiveHours);

        // totalWorkHours is already stored in HOURS in the database
        const activeHours = Math.round(totalActiveHours * 100) / 100;
        console.log("⏱️ Active hours:", activeHours);

        // Get minimum work hours setting
        let settings = await PerformanceSettings.findOne();
        if (!settings) {
            settings = await PerformanceSettings.create({ minimumWorkHours: 5 });
        }
        const minimumWorkHours = settings.minimumWorkHours;

        // Calculate productivity score with deadline penalty (out of 100)
        let productivityScore = 0;
        if (activeHours >= minimumWorkHours && totalTasksCompleted > 0) {
            // Realistic target: 1 task per hour = 100%
            // So for 5 hours minimum, 5 tasks = 100%
            const targetTasks = minimumWorkHours * 1; // 1 task per hour
            let baseScore = (totalTasksCompleted / targetTasks) * 100;
            
            // Cap base score at 100
            baseScore = Math.min(baseScore, 100);
            
            // Apply penalty for late tasks: -10 points per late task
            const penalty = lateTasksCount * 10;
            
            productivityScore = Math.max(0, Math.round((baseScore - penalty) * 100) / 100);
        }

        // Update or create performance metric record
        await PerformanceMetric.findOneAndUpdate(
            { employeeId: employeeId },
            {
                tasksCompleted: totalTasksCompleted,
                activeHours: activeHours,
                productivityScore: productivityScore,
                minimumWorkHours: minimumWorkHours,
                lateTasksCount: lateTasksCount,
                lastCalculated: new Date()
            },
            { upsert: true, new: true }
        );

        const response = {
            metric_id: employeeId,
            employee_id: employeeId,
            tasks_completed: totalTasksCompleted,
            late_tasks: lateTasksCount,
            active_hours: activeHours,
            minimum_work_hours: minimumWorkHours,
            productivity_score: productivityScore,
            meets_minimum_hours: activeHours >= minimumWorkHours
        };

        console.log("📤 Response:", response);

        res.json(response);

    } catch (error) {
        console.error("❌ Error:", error);
        res.status(500).json({ message: error.message });
    }
};

exports.getPerformanceSettings = async (req, res) => {
    try {
        let settings = await PerformanceSettings.findOne();
        if (!settings) {
            settings = await PerformanceSettings.create({ minimumWorkHours: 5 });
        }
        res.json({ success: true, data: settings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updatePerformanceSettings = async (req, res) => {
    try {
        const { minimumWorkHours } = req.body;
        const currentUser = await User.findById(req.user.id);

        if (!minimumWorkHours || minimumWorkHours <= 0) {
            return res.status(400).json({ success: false, message: "Invalid minimum work hours" });
        }

        let settings = await PerformanceSettings.findOne();
        if (!settings) {
            settings = await PerformanceSettings.create({
                minimumWorkHours,
                updatedBy: currentUser.username
            });
        } else {
            settings.minimumWorkHours = minimumWorkHours;
            settings.updatedBy = currentUser.username;
            settings.updatedAt = new Date();
            await settings.save();
        }

        res.json({ success: true, data: settings, message: "Settings updated successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
