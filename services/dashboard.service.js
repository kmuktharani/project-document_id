const User = require("../models/user");
const { Task } = require("../models/Task");
const Attendance = require("../models/attendance");
const Tracker = require("../models/Tracker");
const TrackerLog = require("../models/TrackerLog");
const IdleTime = require("../models/IdleTime");
const Project = require("../models/Project");

async function getProjectStats() {

    const [runningProjects, completedProjects] = await Promise.all([
        Project.countDocuments({ status: "active" }),
        Project.countDocuments({ status: "completed" })
    ]);

    return {
        runningProjects,
        completedProjects
    };
}
async function getSystemAlerts() {

    const overdueTasks = await Task.countDocuments({
        deadline: { $lt: new Date() },
        status: { $ne: "completed" }
    });

    const inactiveEmployees = await User.countDocuments({
        status: "inactive"
    });

    const idleEmployees = await Tracker.countDocuments({
        status: "idle"
    });

    return {
        overdueTasks,
        inactiveEmployees,
        idleEmployees
    };
}
async function getTaskCompletionRate() {

    const totalTasks = await Task.countDocuments();
    const completedTasks = await Task.countDocuments({ status: "completed" });

    return {
        totalTasks,
        completedTasks,
        completionRate:
            totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(2) : 0
    };
}
function getTodayRange() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
}

async function getEmployeesByFilter(filter) {
    return User.find({ isDeleted: false, ...filter }).select("_id username").lean();
}

async function getEmployeeIdsAndNames(filter) {
    const employees = await getEmployeesByFilter(filter);
    return {
        ids: employees.map(e => e._id),
        names: employees.map(e => e.username)
    };
}

async function getEmployeeCounts(filter = {}) {
    const baseFilter = { isDeleted: false, ...filter };

    const [total, active, inactive, byRole, byDepartment] = await Promise.all([
        User.countDocuments(baseFilter),
        User.countDocuments({ ...baseFilter, status: "active" }),
        User.countDocuments({ ...baseFilter, status: "inactive" }),
        User.aggregate([
            { $match: baseFilter },
            { $group: { _id: "$role", count: { $sum: 1 } } }
        ]),
        User.aggregate([
            { $match: baseFilter },
            { $group: { _id: "$department", count: { $sum: 1 } } }
        ])
    ]);

    return {
        total,
        active,
        inactive,
        byRole: byRole.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, {}),
        byDepartment: byDepartment.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, {})
    };
}

async function getTaskStats(filter = {}) {
    const [total, pending, completed, inProgress, byPriority] = await Promise.all([
        Task.countDocuments(filter),
        Task.countDocuments({ ...filter, status: "pending" }),
        Task.countDocuments({ ...filter, status: "completed" }),
        Task.countDocuments({ ...filter, status: "in_progress" }),
        Task.aggregate([
            { $match: filter },
            { $group: { _id: "$priority", count: { $sum: 1 } } }
        ])
    ]);

    return {
        total,
        pending,
        completed,
        inProgress,
        byPriority: byPriority.reduce((acc, item) => {
            acc[item._id || "unset"] = item.count;
            return acc;
        }, {})
    };
}

async function getAttendanceSummary(filter = {}) {
    const { start, end } = getTodayRange();
    const dateFilter = { date: { $gte: start, $lte: end }, ...filter };

    const [presentToday, absentToday, onBreak, checkedOut, avgResult] = await Promise.all([
        Attendance.countDocuments({ ...dateFilter, status: { $in: ["checked-in", "on-break", "checked-out"] } }),
        Attendance.countDocuments({ ...dateFilter, status: "absent" }),
        Attendance.countDocuments({ ...dateFilter, status: "on-break" }),
        Attendance.countDocuments({ ...dateFilter, status: "checked-out" }),
        Attendance.aggregate([
            { $match: { ...dateFilter, totalWorkHours: { $gt: 0 } } },
            { $group: { _id: null, avgHours: { $avg: "$totalWorkHours" } } }
        ])
    ]);

    return {
        presentToday,
        absentToday,
        onBreak,
        checkedOut,
        avgWorkHours: avgResult.length > 0 ? Math.round(avgResult[0].avgHours * 100) / 100 : 0
    };
}

async function getMonitoringSummary(filter = {}) {
    const [activeNow, idle, offline] = await Promise.all([
        Tracker.countDocuments({ ...filter, status: "active" }),
        Tracker.countDocuments({ ...filter, status: "idle" }),
        Tracker.countDocuments({ ...filter, status: "offline" })
    ]);

    return {
        activeNow,
        idle,
        offline,
        total: activeNow + idle + offline
    };
}

async function getAdvancedAdminMetrics() {
    const { start, end } = getTodayRange();

    const [activeUsersToday, monitoringHours, idleHours, taskCompletion, performanceRanking] = await Promise.all([
        Tracker.countDocuments({ lastHeartbeat: { $gte: start, $lte: end } }),
        TrackerLog.aggregate([
            { $match: { timestamp: { $gte: start, $lte: end }, status: "active" } },
            { $group: { _id: null, total: { $sum: "$duration" } } }
        ]),
        IdleTime.aggregate([
            { $match: { timestamp: { $gte: start, $lte: end } } },
            { $group: { _id: null, total: { $sum: "$idle_duration" } } }
        ]),
        Task.aggregate([
            { $group: { _id: "$status", count: { $sum: 1 } } }
        ]),
        Task.aggregate([
            { $match: { status: "Completed" } },
            { $group: { _id: "$employee", completedTasks: { $sum: 1 } } },
            { $sort: { completedTasks: -1 } },
            { $limit: 10 },
            { $lookup: { from: "users", localField: "_id", foreignField: "username", as: "userInfo" } },
            { $project: { employee: "$_id", completedTasks: 1, name: { $arrayElemAt: ["$userInfo.firstName", 0] } } }
        ])
    ]);

    const totalTasks = taskCompletion.reduce((sum, t) => sum + t.count, 0);
    const completedTasks = taskCompletion.find(t => t._id === "Completed")?.count || 0;

    return {
        totalActiveUsersToday: activeUsersToday,
        totalMonitoringHours: monitoringHours[0]?.total ? (monitoringHours[0].total / 3600).toFixed(2) : 0,
        totalIdleHours: idleHours[0]?.total ? (idleHours[0].total / 3600).toFixed(2) : 0,
        taskCompletionPercentage: totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(2) : 0,
        employeePerformanceRanking: performanceRanking
    };
}

async function getDashboardDataByRole(userId, filter) {
    const { ids, names } = await getEmployeeIdsAndNames(filter);
    
    return Promise.all([
        getEmployeeCounts(filter),
        getTaskStats({ employee: { $in: names } }),
        getAttendanceSummary({ employeeId: { $in: ids } }),
        getMonitoringSummary({ UserID: { $in: ids } })
    ]);
}

module.exports = {
    getEmployeeCounts,
    getTaskStats,
    getAttendanceSummary,
    getMonitoringSummary,
    getAdvancedAdminMetrics,
    getEmployeesByFilter,
    getEmployeeIdsAndNames,
    getDashboardDataByRole,
    getProjectStats,
    getSystemAlerts,
    getTaskCompletionRate
};