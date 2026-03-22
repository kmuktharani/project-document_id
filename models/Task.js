const mongoose = require("mongoose");

const taskFileSchema = new mongoose.Schema({
  task_id: { type: mongoose.Schema.Types.ObjectId, ref: "Task", required: true, index: true },
employee_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  file_path: { type: String, required: true },
  uploaded_at: { type: Date, default: Date.now }
}, { timestamps: true });

const taskSchema = new mongoose.Schema({
  task_id: { type: String, unique: true, required: true },
  title: { type: String, required: true },
  description: String,
  assigned_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  assigned_to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    team_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Team",
    required: true,
    index: true
  },
project_id: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Project",
  required: true,
  index: true
},

  priority: { type: String, enum: ["low", "medium", "high", "urgent"], default: "medium", index: true },
  deadline: Date,
  status: { type: String, enum: ["assigned", "on hold", "started", "pending", "in_progress", "completed"], default: "assigned", index: true },
  completedOn: Date,
  created_at: { type: Date, default: Date.now }
}, { timestamps: true });

const TaskFile = mongoose.model("TaskFile", taskFileSchema);
const Task = mongoose.model("Task", taskSchema);

module.exports = { Task, TaskFile };