const cron = require("node-cron");
const { Task } = require("../models/Task");
const Project = require("../models/Project");
const User = require("../models/user");
const Team = require("../models/Team");
const Event = require("../models/Event");
const { createNotification } = require("../controllers/notificationController");

// Runs every day at 8:00 AM
const startTaskScheduler = () => {

  cron.schedule("0 8 * * *", async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // OVERDUE TASKS
    try {
      const overdueTasks = await Task.find({
        deadline: { $lt: today },
        status: { $ne: "completed" }
      });

      for (const task of overdueTasks) {
        // notify assigned_by
        await createNotification(
          task.assigned_by,
          "Task Overdue",
          `Task "${task.title}" is overdue`,
          "deadline",
          task._id
        );

        // notify team manager and team lead
        const team = await Team.findById(task.team_id);
        if (team) {
          if (team.manager) {
            await createNotification(
              team.manager,
              "Task Overdue",
              `Task "${task.title}" is overdue`,
              "deadline",
              task._id
            );
          }
          if (team.teamLead && team.teamLead.toString() !== task.assigned_by.toString()) {
            await createNotification(
              team.teamLead,
              "Task Overdue",
              `Task "${task.title}" is overdue`,
              "deadline",
              task._id
            );
          }
        }
      }

      console.log(`[Scheduler] Overdue tasks checked: ${overdueTasks.length} found`);
    } catch (err) {
      console.error("[Scheduler] Overdue task error:", err.message);
    }

    // PROJECT DEADLINE ALERTS (within 3 days)
    try {
      const in3Days = new Date();
      in3Days.setDate(in3Days.getDate() + 3);
      in3Days.setHours(23, 59, 59, 999);

      const projects = await Project.find({
        endDate: { $gte: today, $lte: in3Days },
        status: "active"
      });

      for (const project of projects) {
        const manager = await User.findOne({ username: project.assignedManager });
        if (manager) {
          await createNotification(
            manager._id,
            "Project Deadline Soon",
            `Project "${project.projectName}" deadline is on ${project.endDate.toDateString()}`,
            "deadline",
            project._id
          );
        }
      }

      console.log(`[Scheduler] Project deadlines checked: ${projects.length} found`);
    } catch (err) {
      console.error("[Scheduler] Project deadline error:", err.message);
    }

    // MEETING REMINDERS (tomorrow's meetings)
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const tomorrowEnd = new Date(tomorrow);
      tomorrowEnd.setHours(23, 59, 59, 999);

      const meetings = await Event.find({
        event_type: "meeting",
        date: { $gte: tomorrow, $lte: tomorrowEnd }
      });

      for (const meeting of meetings) {
        const users = await User.find({ username: { $in: meeting.participants }, isDeleted: false }).select('_id');
        for (const user of users) {
          await createNotification(
            user._id,
            "Meeting Reminder",
            `Reminder: You have a meeting "${meeting.title}" tomorrow on ${new Date(meeting.date).toDateString()}`,
            "meeting",
            meeting._id
          );
        }
      }

      console.log(`[Scheduler] Meeting reminders sent: ${meetings.length} meetings tomorrow`);
    } catch (err) {
      console.error("[Scheduler] Meeting reminder error:", err.message);
    }
  });

  console.log("[Scheduler] Task scheduler started");
};

module.exports = startTaskScheduler;
