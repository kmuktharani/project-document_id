const { Task, TaskFile } = require("../models/Task");
const Team = require("../models/Team");
const User = require("../models/user");
const Project = require("../models/Project");
const fs = require("fs");
const path = require("path");
const { createNotification } = require("./notificationController");

// Admin can see all tasks
exports.getAllTasks = async (req, res) => {
  try {

    const tasks = await Task.find()
      .populate("team_id", "name")
      .populate("project_id", "name")

      .sort({ created_at: -1 });

    res.json({
      success: true,
      total: tasks.length,
      data: tasks
    });

  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// Completed tasks
exports.getCompletedTasks = async (req, res) => {
  try {

    const tasks = await Task.find({ status: "completed" })
      .populate("team_id", "name")
      .populate("project_id", "name");


    res.json({
      success: true,
      count: tasks.length,
      data: tasks
    });

  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// Assigned tasks
exports.getAssignedTasks = async (req, res) => {
  try {

    const tasks = await Task.find({
      status: { $ne: "completed" }
    }).populate("team_id", "name")
      .populate("project_id", "name");



    res.json({
      success: true,
      count: tasks.length,
      data: tasks
    });

  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// Overdue tasks
exports.getOverdueTasks = async (req, res) => {
  try {

    const today = new Date();

    const tasks = await Task.find({
      deadline: { $lt: today },
      status: { $ne: "completed" }
    })

    res.json({
      success: true,
      count: tasks.length,
      data: tasks
    });

  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// Task statistics
exports.getTaskStats = async (req, res) => {
  try {

    const totalTasks = await Task.countDocuments();

    const completedTasks = await Task.countDocuments({
      status: "completed"
    });

    const assignedTasks = await Task.countDocuments({
      status: { $ne: "completed" }
    });

    const today = new Date();

    const overdueTasks = await Task.countDocuments({
      deadline: { $lt: today },
      status: { $ne: "completed" }
    })
          


    res.json({
      success: true,
      data: {
        totalTasks,
        assignedTasks,
        completedTasks,
        overdueTasks
      }
    });

  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// Assign Task
exports.assignTask = async (req, res) => {
  try {

    const currentUser = await User.findById(req.user.id);

    const { title, description, assigned_to, priority, deadline, team_id ,project_id} = req.body;

    if (!assigned_to) {
      return res.status(400).json({
        success: false,
        message: "assigned_to required"
      });
    }
    const project = await Project.findById(project_id);



    if (!team_id) {
      return res.status(400).json({
        success: false,
        message: "team_id required"
      });
    }
    if (!project) {
  return res.status(404).json({
    success:false,
    message:"Project not found"
  });
}

    // Check team exists
    const team = await Team.findById(team_id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found"
      });
    }

    const assignee = await User.findOne({ username: assigned_to });

    if (!assignee) {
      return res.status(404).json({
        success: false,
        message: "Assignee not found"
      });
    }

    // Manager assigns to team lead
    if (currentUser.role === "manager") {
      const managerTeam = await Team.findOne({
        manager: currentUser._id,
        teamLead: assignee._id
      });

      if (!managerTeam) {
        return res.status(403).json({
          success: false,
          message: "You can only assign tasks to your team leads"
        });
      }
    }

    // Team lead assigns to members
    if (currentUser.role === "team_lead") {
      const teamLeadTeam = await Team.findOne({
        teamLead: currentUser._id,
        members: assignee._id
      });

      if (!teamLeadTeam) {
        return res.status(403).json({
          success: false,
          message: "You can only assign tasks to your team members"
        });
      }
    }

    // Generate task id
    const lastTask = await Task.findOne().sort({ _id: -1 }).select("task_id");

    let taskNumber = 1;

    if (lastTask && lastTask.task_id) {
      const match = lastTask.task_id.match(/^T(\d+)$/);
      if (match) {
        taskNumber = parseInt(match[1]) + 1;
      }
    }

    const task_id = `T${taskNumber}`;

    const task = await Task.create({
      task_id,
      title,
      description,
      project_id,
      assigned_by: currentUser._id,
      assigned_to: assignee._id,
      team_id,
      priority,
      deadline
    });

    res.status(201).json({
      success: true,
      data: task
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// Team Lead - see team members' task progress
exports.getTeamTasks = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    const teams = await Team.find({ teamLead: currentUser._id });
    const teamIds = teams.map(t => t._id);
    const tasks = await Task.find({ team_id: { $in: teamIds } })
      .populate("assigned_to", "username")
      .populate("assigned_by", "username")
      .populate("team_id", "name")
      .populate("project_id", "projectName")
      .sort({ created_at: -1 });
    res.json({ success: true, total: tasks.length, data: tasks });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Manager - see all tasks under their teams
exports.getManagerTasks = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    const teams = await Team.find({ manager: currentUser._id });
    const teamIds = teams.map(t => t._id);
    const tasks = await Task.find({ team_id: { $in: teamIds } })
      .populate("assigned_to", "username")
      .populate("assigned_by", "username")
      .populate("team_id", "name")
      .populate("project_id", "projectName")
      .sort({ created_at: -1 });
    res.json({ success: true, total: tasks.length, data: tasks });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Employee tasks
exports.getMyTasks = async (req, res) => {
  try {

    const currentUser = await User.findById(req.user.id);

    const tasks = await Task.find({
      assigned_to: currentUser._id

    })    .populate("assigned_to", "username") 
     .populate("assigned_by", "username")
      .populate("team_id", "name")
      .populate("project_id", "name")
      .sort({ created_at: -1 });

    res.json({
      success: true,
      data: tasks
    });

  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// Update task status
exports.updateTaskStatus = async (req, res) => {
  try {

    const { task_id } = req.params;
    const { status } = req.body;

    const currentUser = await User.findById(req.user.id);

    const task = await Task.findOne({ task_id });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found"
      });
    }

   if (task.assigned_to.toString() !== currentUser._id.toString()) {
  return res.status(403).json({
    success: false,
    message: "You can only update your own tasks"
  });
}

    if (task.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Task is already completed"
      });
    }

    task.status = status;

    if (status === "completed" && !task.completedOn) {
      task.completedOn = new Date();

      // notify assigned_by
      await createNotification(
        task.assigned_by,
        "Task Completed",
        `Task "${task.title}" has been marked as completed`,
        "task",
        task._id
      );

      // notify team manager and team lead
      const team = await Team.findById(task.team_id);
      if (team) {
        if (team.manager) {
          await createNotification(
            team.manager,
            "Task Completed",
            `Task "${task.title}" has been marked as completed`,
            "task",
            task._id
          );
        }
        if (team.teamLead && team.teamLead.toString() !== task.assigned_by.toString()) {
          await createNotification(
            team.teamLead,
            "Task Completed",
            `Task "${task.title}" has been marked as completed`,
            "task",
            task._id
          );
        }
      }
    }

    await task.save();

    res.json({
      success: true,
      data: task
    });

  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// Upload task file
exports.uploadTaskFile = async (req, res) => {
  try {

    const { task_id } = req.params;

    const currentUser = await User.findById(req.user.id);

    const task = await Task.findOne({ task_id });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found"
      });
    }

    if (task.assigned_to.toString() !== currentUser._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only upload files for your own tasks"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "File required"
      });
    }

    const uploadDir = path.join(__dirname, "../uploads/tasks");

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const fileName = Date.now() + "-" + req.file.originalname;

    const filePath = path.join(uploadDir, fileName);

    fs.writeFileSync(filePath, req.file.buffer);

    const taskFile = await TaskFile.create({
      task_id: task._id,
      employee_id: currentUser._id,
      file_path: `/uploads/tasks/${fileName}`
    });

    res.status(201).json({
      success: true,
      data: taskFile
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: e.message || "Server error" });
  }
};

exports.getTaskFiles = async (req, res) => {
  try {
    const { task_id } = req.params;
    const task = await Task.findOne({ task_id });
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }
    const files = await TaskFile.find({ task_id: task._id }).sort({ uploaded_at: -1 });
    res.json({ success: true, data: files });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.deleteTaskFile = async (req, res) => {
  try {
    const { file_id } = req.params;
    const currentUser = await User.findById(req.user.id);
    const file = await TaskFile.findById(file_id);
    if (!file) {
      return res.status(404).json({ success: false, message: "File not found" });
    }
    if (file.employee_id.toString() !== currentUser._id.toString()) {
      return res.status(403).json({ success: false, message: "You can only delete your own files" });
    }
    const filePath = path.join(__dirname, "..", file.file_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    await TaskFile.findByIdAndDelete(file_id);
    res.json({ success: true, message: "File deleted" });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};