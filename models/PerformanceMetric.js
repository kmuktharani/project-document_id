const mongoose = require("mongoose");

const performanceMetricSchema = new mongoose.Schema({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,
        index: true
    },
    tasksCompleted: {
        type: Number,
        default: 0
    },
    activeHours: {
        type: Number,
        default: 0
    },
    idleHours: {
        type: Number,
        default: 0
    },
    productivityScore: {
        type: Number,
        default: 0
    },
    lastCalculated: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model("PerformanceMetric", performanceMetricSchema);
