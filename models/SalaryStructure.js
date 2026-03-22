const mongoose = require("mongoose");

const salaryStructureSchema = new mongoose.Schema({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    basic: { type: Number, required: true },
    hra: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    effectiveFrom: { type: Date, required: true },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

salaryStructureSchema.index({ employeeId: 1, isActive: 1 });

module.exports = mongoose.model("SalaryStructure", salaryStructureSchema);
