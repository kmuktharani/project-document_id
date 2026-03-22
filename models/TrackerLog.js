const mongoose = require("mongoose");

const trackerLogSchema = new mongoose.Schema({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: ["active", "idle", "offline"],
        required: true
    },
    activeApp: String,
    keyboardActive: Boolean,
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    duration: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

trackerLogSchema.index({ employeeId: 1, timestamp: -1 });

module.exports = mongoose.model("TrackerLog", trackerLogSchema);
