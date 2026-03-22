const mongoose = require("mongoose");

const payrollRunSchema = new mongoose.Schema({
    month: { type: String, required: true, unique: true },
    status: {
        type: String,
        enum: ["DRAFT", "APPROVED", "RELEASED"],
        default: "DRAFT"
    },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    releasedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

module.exports = mongoose.model("PayrollRun", payrollRunSchema);
