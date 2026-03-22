const mongoose = require("mongoose");

const idleTimeSchema = new mongoose.Schema({
  employee_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employee",
    required: true,
    index: true
  },
  idle_duration: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

idleTimeSchema.index({ employee_id: 1, timestamp: -1 });

module.exports = mongoose.model("IdleTime", idleTimeSchema);