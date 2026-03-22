const mongoose = require("mongoose");

const employeeTaskSchema = new mongoose.Schema({
  taskId: { type: String, unique: true },
  title: { type: String, required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  team: { type: String, enum: ["frontend", "backend", "fullstack", "design", "qa"], required: true, index: true },
  priority: { type: String, enum: ["low", "medium", "high", "urgent"], default: "medium", index: true },
  deadline: Date,
  status: {
    type: String,
    enum: ["pending", "in_progress", "completed"],
    default: "pending",
    index: true
  },
  completedOn: Date,
  description: String,
  assignedOn: {
    type: Date,
    default: Date.now,
  }
}, { timestamps: true });

employeeTaskSchema.index({ assignedTo: 1, status: 1 });
employeeTaskSchema.index({ team: 1, status: 1 });
employeeTaskSchema.index({ assignedBy: 1, status: 1 });

// Auto-set completedOn when status changes to completed
employeeTaskSchema.pre('save', async function() {
  if (this.isModified('status') && this.status === 'completed' && !this.completedOn) {
    this.completedOn = new Date();
  }
});

module.exports = mongoose.model("EmployeeTask", employeeTaskSchema);
