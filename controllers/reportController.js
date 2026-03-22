const Attendance = require("../models/attendance");
const PerformanceMetric = require("../models/PerformanceMetric");
const Project = require("../models/Project");
const { Task } = require("../models/Task");
const EmployeeTask = require("../models/EmployeeTask");
const User = require("../models/user");
const Team = require("../models/Team");

// 1️⃣ Attendance Report
exports.getAttendanceReport = async (req, res) => {
    try {
        const { month, year } = req.query;
        
        if (!month || !year) {
            return res.status(400).json({ 
                success: false, 
                message: "Month and year are required" 
            });
        }

        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        const attendanceRecords = await Attendance.aggregate([
            {
                $match: {
                    date: { $gte: startDate, $lte: endDate },
                    checkIn: { $ne: null }
                }
            },
            {
                $group: {
                    _id: "$employeeId",
                    presentDays: { $sum: 1 }
                }
            }
        ]);

        const totalDays = endDate.getDate();
        const employees = await User.find({ isDeleted: false }).select("_id firstName lastName username");

        const report = employees.map(emp => {
            const record = attendanceRecords.find(r => r._id.toString() === emp._id.toString());
            const present = record ? record.presentDays : 0;
            const absent = totalDays - present;

            return {
                employeeId: emp._id,
                employee: `${emp.firstName} ${emp.lastName}`,
                username: emp.username,
                present,
                absent
            };
        });

        res.json({
            success: true,
            month: parseInt(month),
            year: parseInt(year),
            totalDays,
            data: report
        });
    } catch (error) {
        console.error("Attendance Report Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// 2️⃣ Productivity Report
exports.getProductivityReport = async (req, res) => {
    try {
        // Exclude admin, hr, and manager roles
        const employees = await User.find({ 
            isDeleted: false,
            role: { $nin: ['admin', 'hr', 'manager'] }
        }).select("_id firstName lastName username role");

        const report = await Promise.all(employees.map(async (emp) => {
            // Use .find() like performanceController
            const completedTasks = await Task.find({
                assigned_to: emp.username,
                status: "completed"
            }).select("_id");

            const completedEmployeeTasks = await EmployeeTask.find({
                assignedTo: emp._id,
                status: "completed"
            }).select("_id");

            const totalCompleted = completedTasks.length + completedEmployeeTasks.length;

            return {
                employeeId: emp._id,
                employee: `${emp.firstName} ${emp.lastName}`,
                username: emp.username,
                role: emp.role,
                tasksCompleted: totalCompleted
            };
        }));

        report.sort((a, b) => b.tasksCompleted - a.tasksCompleted);

        res.json({
            success: true,
            data: report
        });
    } catch (error) {
        console.error("Productivity Report Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// 3️⃣ Project Progress Report
exports.getProjectProgressReport = async (req, res) => {
    try {
        const projects = await Project.find().populate("teams").lean();

        const report = await Promise.all(projects.map(async (project) => {
            // Get all team members from the project's teams
            let allTeamMembers = [];
            
            if (project.teams && project.teams.length > 0) {
                project.teams.forEach(team => {
                    if (team.members && team.members.length > 0) {
                        allTeamMembers.push(...team.members);
                    }
                    if (team.teamLead) {
                        allTeamMembers.push(team.teamLead);
                    }
                });
            }

            // Remove duplicates
            allTeamMembers = [...new Set(allTeamMembers)];

            let totalTasks = 0;
            let completedTasks = 0;

            if (allTeamMembers.length > 0) {
                // Get tasks assigned to team members (Task model uses username)
                const tasks = await Task.find({ 
                    assigned_to: { $in: allTeamMembers }
                }).select("status");

                totalTasks += tasks.length;
                completedTasks += tasks.filter(task => task.status === "completed").length;

                // Get User IDs for EmployeeTask query
                const users = await User.find({ 
                    username: { $in: allTeamMembers },
                    isDeleted: false 
                }).select("_id");
                
                const userIds = users.map(u => u._id);

                if (userIds.length > 0) {
                    // Get EmployeeTask assigned to team members
                    const employeeTasks = await EmployeeTask.find({ 
                        assignedTo: { $in: userIds }
                    }).select("status");

                    totalTasks += employeeTasks.length;
                    completedTasks += employeeTasks.filter(task => task.status === "completed").length;
                }
            }

            const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

            return {
                projectId: project.projectId,
                project: project.projectName,
                status: project.status,
                startDate: project.startDate,
                endDate: project.endDate,
                assignedManager: project.assignedManager,
                teamsCount: project.teams ? project.teams.length : 0,
                teamMembersCount: allTeamMembers.length,
                totalTasks,
                completedTasks,
                progress: `${progress}%`
            };
        }));

        res.json({
            success: true,
            data: report
        });
    } catch (error) {
        console.error("Project Progress Report Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// 4️⃣ Employee Performance Report
exports.getEmployeePerformanceReport = async (req, res) => {
    try {
        // Exclude admin, hr, and manager roles
        const employees = await User.find({ 
            isDeleted: false,
            role: { $nin: ['admin', 'hr', 'manager'] }
        }).select("_id firstName lastName username role");

        const report = await Promise.all(employees.map(async (emp) => {
            // Get all assigned tasks (using .find() like performanceController)
            const assignedTasks = await Task.find({ assigned_to: emp.username }).select("_id");
            const assignedEmployeeTasks = await EmployeeTask.find({ assignedTo: emp._id }).select("_id");
            const totalAssigned = assignedTasks.length + assignedEmployeeTasks.length;

            // Get completed tasks with deadline info
            const completedTasks = await Task.find({
                assigned_to: emp.username,
                status: "completed"
            }).select("deadline completedOn");
            
            const completedEmployeeTasks = await EmployeeTask.find({
                assignedTo: emp._id,
                status: "completed"
            }).select("deadline completedOn");

            const totalCompleted = completedTasks.length + completedEmployeeTasks.length;

            const completionRate = totalAssigned > 0 
                ? Math.round((totalCompleted / totalAssigned) * 100) 
                : 0;

            // Count late tasks and deadlines met
            let lateTasksCount = 0;
            let deadlinesMet = 0;
            let totalWithDeadlines = 0;

            completedTasks.forEach(task => {
                if (task.deadline && task.completedOn) {
                    totalWithDeadlines++;
                    if (task.completedOn > task.deadline) {
                        lateTasksCount++;
                    } else {
                        deadlinesMet++;
                    }
                }
            });

            completedEmployeeTasks.forEach(task => {
                if (task.deadline && task.completedOn) {
                    totalWithDeadlines++;
                    if (task.completedOn > task.deadline) {
                        lateTasksCount++;
                    } else {
                        deadlinesMet++;
                    }
                }
            });

            const deadlineMetRate = totalWithDeadlines > 0 
                ? Math.round((deadlinesMet / totalWithDeadlines) * 100) 
                : 0;

            // Get performance metric from database
            const performanceMetric = await PerformanceMetric.findOne({ employeeId: emp._id });

            return {
                employeeId: emp._id,
                employee: `${emp.firstName} ${emp.lastName}`,
                username: emp.username,
                role: emp.role,
                tasksAssigned: totalAssigned,
                tasksCompleted: totalCompleted,
                completionRate: `${completionRate}%`,
                lateTasks: lateTasksCount,
                deadlinesMet: deadlinesMet,
                totalDeadlines: totalWithDeadlines,
                deadlineMetRate: `${deadlineMetRate}%`,
                productivityScore: performanceMetric ? performanceMetric.productivityScore : 0,
                activeHours: performanceMetric ? performanceMetric.activeHours : 0
            };
        }));

        report.sort((a, b) => b.productivityScore - a.productivityScore);

        res.json({
            success: true,
            data: report
        });
    } catch (error) {
        console.error("Employee Performance Report Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
