const mongoose = require("mongoose");

const trackerSchema = new mongoose.Schema({
    UserID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true
    },
    status: {
        type: String,
        enum: ["active", "idle", "offline"],
        default: "offline",
        index: true
    },
    activeApp: String,
    keyboardActive: Boolean,
    lastHeartbeat: {
        type: Date,
        default: Date.now,
        index: true
    },
    lastStatusUpdate: Date,
}, { timestamps: true });

trackerSchema.index({ status: 1, lastHeartbeat: -1 });

module.exports = mongoose.model("Tracker", trackerSchema);