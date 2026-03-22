const mongoose = require("mongoose");

const payrollRecordSchema = new mongoose.Schema({
    payrollRunId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PayrollRun",
        required: true,
        index: true
    },
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    breakdown: {
        basic: Number,
        hra: Number,
        bonus: Number,
        deductions: Number
    },
    grossSalary: Number,
    netSalary: Number,
    status: {
        type: String,
        enum: ["PENDING", "APPROVED", "PAID"],
        default: "PENDING"
    },
    paidDate: Date
}, { timestamps: true });

payrollRecordSchema.index({ employeeId: 1 });

module.exports = mongoose.model("PayrollRecord", payrollRecordSchema);
