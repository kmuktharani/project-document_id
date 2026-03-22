const dashboardService = require("../services/dashboard.service");
const User = require("../models/user");

exports.getRoleDashboard = async (req, res, next) => {
    const role = (req.user.role || '').toLowerCase().replace(/[_\s]+/g, '');
    
    switch(role) {
        case "admin": return exports.getAdminDashboard(req, res);
        case "hr": return exports.getHrDashboard(req, res);
        case "manager": return exports.getManagerDashboard(req, res);
        case "teamlead": return exports.getTeamLeadDashboard(req, res);
        case "projectmanager": return exports.getProjectManagerDashboard(req, res);
        case "employee": return exports.getEmployeeDashboard(req, res);
        default: return res.status(403).json({ success: false, message: "Invalid role" });
    }
};

exports.getAdminDashboard = async (req, res, next) => {
    try {

        const [
            employeeCounts,
            taskStats,
            attendanceSummary,
            monitoringSummary,
            projectStats,
            systemAlerts,
            completionRate
        ] = await Promise.all([
            dashboardService.getEmployeeCounts(),
            dashboardService.getTaskStats(),
            dashboardService.getAttendanceSummary(),
            dashboardService.getMonitoringSummary(),
            dashboardService.getProjectStats(),
            dashboardService.getSystemAlerts(),
            dashboardService.getTaskCompletionRate()
        ]);

        res.json({
            success: true,
            role: "Admin",
            data: {
                employeeCounts,
                projectStats,
                taskStats,
                completionRate,
                attendanceSummary,
                monitoringSummary,
                systemAlerts
            }
        });

    } catch (err) {
        next(err);
    }
};
exports.getHrDashboard = async (req, res, next) => {
    try {
        const [employeeCounts, taskStats, attendanceSummary, monitoringSummary] = await Promise.all([
            dashboardService.getEmployeeCounts(),
            dashboardService.getTaskStats(),
            dashboardService.getAttendanceSummary(),
            dashboardService.getMonitoringSummary()
        ]);
        res.json({ success: true, role: "HR", data: { employeeCounts, taskStats, attendanceSummary, monitoringSummary } });
    } catch (err) {
        next(err);
    }
};

exports.getManagerDashboard = async (req, res, next) => {
    try {
        const manager = await User.findById(req.user.id).select("department");
        if (!manager) return res.status(404).json({ success: false, message: "Manager not found" });

        const [employeeCounts, taskStats, attendanceSummary, monitoringSummary] = 
            await dashboardService.getDashboardDataByRole(req.user.id, { department: manager.department });

        res.json({ success: true, role: "Manager", department: manager.department, data: { employeeCounts, taskStats, attendanceSummary, monitoringSummary } });
    } catch (err) {
        next(err);
    }
};

exports.getTeamLeadDashboard = async (req, res, next) => {
    try {
        const teamLead = await User.findById(req.user.id).select("team department");
        if (!teamLead) return res.status(404).json({ success: false, message: "Team Lead not found" });

        const teamFilter = teamLead.team ? { team: teamLead.team } : { department: teamLead.department };
        const [employeeCounts, taskStats, attendanceSummary, monitoringSummary] = 
            await dashboardService.getDashboardDataByRole(req.user.id, teamFilter);

        res.json({ success: true, role: "Team Lead", team: teamLead.team || teamLead.department, data: { employeeCounts, taskStats, attendanceSummary, monitoringSummary } });
    } catch (err) {
        next(err);
    }
};

exports.getProjectManagerDashboard = async (req, res, next) => {
    try {
        const pm = await User.findById(req.user.id).select("department");
        if (!pm) return res.status(404).json({ success: false, message: "Project Manager not found" });

        const [employeeCounts, taskStats, attendanceSummary, monitoringSummary] = 
            await dashboardService.getDashboardDataByRole(req.user.id, { department: pm.department });

        res.json({ success: true, role: "Project Manager", department: pm.department, data: { employeeCounts, taskStats, attendanceSummary, monitoringSummary } });
    } catch (err) {
        next(err);
    }
};

exports.getEmployeeDashboard = async (req, res, next) => {
    try {
        const { Task } = require('../models/Task');
        const Attendance = require('../models/attendance');
        const Event = require('../models/Event');
        const Team = require('../models/Team');
        const employeeId = req.user.id;

        const employee = await User.findById(employeeId).select('username firstName lastName email department role availability').lean();
        if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

        const now = new Date();
        const todayStart = new Date(now.setHours(0, 0, 0, 0));
        const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
        const next30Days = new Date(todayStart.getTime() + 30 * 86400000);

        const [allTasks, todayAttendance, upcomingEvents, teamMembers, last7DaysAttendance, totalTaskCount] = await Promise.all([
            Task.find({ assigned_to: employee.username }).select('task_id title status deadline updatedAt').lean(),
            Attendance.findOne({ employeeId, date: todayStart }).lean(),
            Event.find({ participants: employee.username, date: { $gte: now, $lte: next30Days } }).sort({ date: 1 }).limit(5).select('title event_type date time').lean(),
            Team.find({ $or: [{ members: employee.username }, { teamLead: employee.username }] }).select('members teamLead manager').lean(),
            Attendance.find({ employeeId, date: { $gte: sevenDaysAgo } }).select('totalWorkHours totalIdleTime').lean(),
            Task.countDocuments({ assigned_to: employee.username })
        ]);

        const todayEnd = new Date(todayStart.getTime() + 86400000);
        const todayTasksList = allTasks.filter(t => t.deadline >= todayStart && t.deadline < todayEnd);
        const completedTasksList = allTasks.filter(t => t.status === 'completed');
        const pendingTasksList = allTasks.filter(t => ['assigned', 'started', 'in_progress', 'pending', 'on hold'].includes(t.status));
        const overdueTasks = allTasks.filter(t => t.deadline < now && t.status !== 'completed');

        const teamUsernames = [...new Set(teamMembers.flatMap(t => [t.teamLead, t.manager, ...t.members].filter(Boolean)))];
        const teamOnlineStatus = teamUsernames.length ? await User.find({ username: { $in: teamUsernames }, _id: { $ne: employeeId } })
            .select('firstName lastName username availability').lean() : [];

        const totalWorkHours = last7DaysAttendance.reduce((sum, att) => sum + (att.totalWorkHours || 0), 0);
        const totalIdleTime = last7DaysAttendance.reduce((sum, att) => sum + (att.totalIdleTime || 0), 0);
        const activeWorkHours = totalWorkHours - (totalIdleTime / 60);
        const totalTasks = completedTasksList.length + pendingTasksList.length;
        const taskCompletionRate = totalTasks > 0 ? completedTasksList.length / totalTasks : 0;
        const productivityScore = Math.min(100, Math.round((totalWorkHours > 0 ? activeWorkHours / totalWorkHours : 0) * 50 + taskCompletionRate * 50));

        res.json({
            success: true,
            role: 'Employee',
            data: {
                profile: {
                    name: `${employee.firstName} ${employee.lastName}`,
                    email: employee.email,
                    username: employee.username,
                    department: employee.department,
                    role: employee.role,
                    availability: employee.availability || 'not available'
                },
                taskSummary: {
                    today: { count: todayTasksList.length, tasks: todayTasksList },
                    completed: { count: completedTasksList.length, tasks: completedTasksList },
                    pending: { count: pendingTasksList.length, tasks: pendingTasksList },
                    overdue: { count: overdueTasks.length, tasks: overdueTasks },
                    total: totalTaskCount
                },
                attendanceStatus: todayAttendance ? {
                    checkedIn: !!todayAttendance.checkIn,
                    checkInTime: todayAttendance.checkIn,
                    checkOutTime: todayAttendance.checkOut,
                    status: todayAttendance.status,
                    totalWorkHours: todayAttendance.totalWorkHours || 0
                } : { checkedIn: false },
                productivityScore,
                upcomingEvents,
                teamOnlineStatus: {
                    available: teamOnlineStatus.filter(u => u.availability === 'available'),
                    notAvailable: teamOnlineStatus.filter(u => u.availability !== 'available')
                }
            }
        });
    } catch (err) {
        next(err);
    }
};

exports.getDashboardStats = (req, res) => {
  const data = dashboardService.getStats();
  res.json(data);
};

exports.getTaskData = (req, res) => {
  const data = dashboardService.getTaskData();
  res.json(data);
};

exports.getProductivityData = (req, res) => {
  const data = dashboardService.getProductivityData();
  res.json(data);
};

exports.getTaskDistribution = (req, res) => {
  const data = dashboardService.getTaskDistribution();
  res.json(data);
};

exports.getAdvancedAdminMetrics = async (req, res, next) => {
  try {
    const metrics = await dashboardService.getAdvancedAdminMetrics();
    res.json({ success: true, data: metrics });
  } catch (error) {
    next(error);
  }
};