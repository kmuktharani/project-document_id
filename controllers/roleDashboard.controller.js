const dashboardService = require("../services/dashboard.service");
const User = require("../models/user");

/**
 * Admin Dashboard - Full access to all data
 * GET /api/dashboard/admin
 */
exports.getAdminDashboard = async (req, res) => {
    try {
        const [employeeCounts, taskStats, attendanceSummary, monitoringSummary] = await Promise.all([
            dashboardService.getEmployeeCounts(),
            dashboardService.getTaskStats(),
            dashboardService.getAttendanceSummary(),
            dashboardService.getMonitoringSummary()
        ]);

        res.json({
            success: true,
            role: "admin",
            data: { employeeCounts, taskStats, attendanceSummary, monitoringSummary }
        });
    } catch (err) {
        console.error("Admin Dashboard Error:", err.message);
        res.status(500).json({ success: false, message: "Failed to fetch admin dashboard data" });
    }
};

/**
 * HR Dashboard - Full access to all data (HR perspective)
 * GET /api/dashboard/hr
 */
exports.getHrDashboard = async (req, res) => {
    try {
        const [employeeCounts, taskStats, attendanceSummary, monitoringSummary] = await Promise.all([
            dashboardService.getEmployeeCounts(),
            dashboardService.getTaskStats(),
            dashboardService.getAttendanceSummary(),
            dashboardService.getMonitoringSummary()
        ]);

        res.json({
            success: true,
            role: "hr",
            data: { employeeCounts, taskStats, attendanceSummary, monitoringSummary }
        });
    } catch (err) {
        console.error("HR Dashboard Error:", err.message);
        res.status(500).json({ success: false, message: "Failed to fetch HR dashboard data" });
    }
};

/**
 * Manager Dashboard - Only their department's data
 * GET /api/dashboard/manager
 */
exports.getManagerDashboard = async (req, res) => {
    try {
        // Get the manager's department
        const manager = await User.findById(req.user.id).select("department team");
        if (!manager) {
            return res.status(404).json({ success: false, message: "Manager not found" });
        }

        const department = manager.department;

        // Filter employees by department
        const employeeCounts = await dashboardService.getEmployeeCounts({ department });

        // Get employee IDs in this department for task/attendance filtering
        const deptEmployees = await User.find({ department, isDeleted: false }).select("_id username");
        const employeeNames = deptEmployees.map(e => e.username);
        const employeeIds = deptEmployees.map(e => e._id);

        const [taskStats, attendanceSummary, monitoringSummary] = await Promise.all([
            dashboardService.getTaskStats({ employee: { $in: employeeNames } }),
            dashboardService.getAttendanceSummary({ employeeId: { $in: employeeIds } }),
            dashboardService.getMonitoringSummary({ UserID: { $in: employeeIds } })
        ]);

        res.json({
            success: true,
            role: "manager",
            department,
            data: { employeeCounts, taskStats, attendanceSummary, monitoringSummary }
        });
    } catch (err) {
        console.error("Manager Dashboard Error:", err.message);
        res.status(500).json({ success: false, message: "Failed to fetch manager dashboard data" });
    }
};

/**
 * Team Lead Dashboard - Only their team's data
 * GET /api/dashboard/team-lead
 */
exports.getTeamLeadDashboard = async (req, res) => {
    try {
        const teamLead = await User.findById(req.user.id).select("team department");
        if (!teamLead) {
            return res.status(404).json({ success: false, message: "Team Lead not found" });
        }

        const team = teamLead.team;
        const department = teamLead.department;

        // Filter by team (and department as fallback)
        const teamFilter = team ? { team } : { department };
        const employeeCounts = await dashboardService.getEmployeeCounts(teamFilter);

        const teamEmployees = await User.find({ ...teamFilter, isDeleted: false }).select("_id username");
        const employeeNames = teamEmployees.map(e => e.username);
        const employeeIds = teamEmployees.map(e => e._id);

        const [taskStats, attendanceSummary, monitoringSummary] = await Promise.all([
            dashboardService.getTaskStats({ employee: { $in: employeeNames } }),
            dashboardService.getAttendanceSummary({ employeeId: { $in: employeeIds } }),
            dashboardService.getMonitoringSummary({ UserID: { $in: employeeIds } })
        ]);

        res.json({
            success: true,
            role: "team_lead",
            team: team || department,
            data: { employeeCounts, taskStats, attendanceSummary, monitoringSummary }
        });
    } catch (err) {
        console.error("Team Lead Dashboard Error:", err.message);
        res.status(500).json({ success: false, message: "Failed to fetch team lead dashboard data" });
    }
};

/**
 * Project Manager Dashboard - All project tasks and assigned employees
 * GET /api/dashboard/project-manager
 */
exports.getProjectManagerDashboard = async (req, res) => {
    try {
        const pm = await User.findById(req.user.id).select("department team");
        if (!pm) {
            return res.status(404).json({ success: false, message: "Project Manager not found" });
        }

        // Project Managers see all tasks and employees in their department
        const department = pm.department;
        const employeeCounts = await dashboardService.getEmployeeCounts({ department });

        const deptEmployees = await User.find({ department, isDeleted: false }).select("_id username");
        const employeeNames = deptEmployees.map(e => e.username);
        const employeeIds = deptEmployees.map(e => e._id);

        const [taskStats, attendanceSummary, monitoringSummary] = await Promise.all([
            dashboardService.getTaskStats({ employee: { $in: employeeNames } }),
            dashboardService.getAttendanceSummary({ employeeId: { $in: employeeIds } }),
            dashboardService.getMonitoringSummary({ UserID: { $in: employeeIds } })
        ]);

        res.json({
            success: true,
            role: "project_manager",
            department,
            data: { employeeCounts, taskStats, attendanceSummary, monitoringSummary }
        });
    } catch (err) {
        console.error("Project Manager Dashboard Error:", err.message);
        res.status(500).json({ success: false, message: "Failed to fetch project manager dashboard data" });
    }
};

/**
 * Employee Dashboard - Only their own personal data
 * GET /api/dashboard/employee
 */
exports.getEmployeeDashboard = async (req, res) => {
    try {
        const employee = await User.findById(req.user.id).select("username firstName lastName department team role status");
        if (!employee) {
            return res.status(404).json({ success: false, message: "Employee not found" });
        }

        const userId = req.user.id;
        const username = employee.username;

        // Employee sees only their own data
        const [taskStats, attendanceSummary, monitoringSummary] = await Promise.all([
            dashboardService.getTaskStats({ employee: username }),
            dashboardService.getAttendanceSummary({ employeeId: userId }),
            dashboardService.getMonitoringSummary({ UserID: userId })
        ]);

        res.json({
            success: true,
            role: "employee",
            data: {
                profile: {
                    name: `${employee.firstName} ${employee.lastName}`,
                    department: employee.department,
                    team: employee.team,
                    status: employee.status
                },
                taskStats,
                attendanceSummary,
                monitoringSummary
            }
        });
    } catch (err) {
        console.error("Employee Dashboard Error:", err.message);
        res.status(500).json({ success: false, message: "Failed to fetch employee dashboard data" });
    }
};