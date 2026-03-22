const mongoose = require("mongoose");

const performanceSettingsSchema = new mongoose.Schema({
  minimumWorkHours: { type: Number, default: 5, required: true },
  updatedBy: { type: String },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model("PerformanceSettings", performanceSettingsSchema);
