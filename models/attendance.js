const mongoose = require('mongoose');

const idleEventSchema = new mongoose.Schema({
    startTime: { type: Date, required: true },
    endTime: { type: Date, default: null },
    duration: { type: Number, default: 0 } // in seconds
}, { _id: false });

const screenshotSchema = new mongoose.Schema({
    image: {
        type: Buffer, // 🔥 Stores binary image
        required: true
    },
    contentType: {
        type: String,
        default: "image/jpeg"
    },
    size: {
        type: Number, // optional (for analytics)
        default: 0
    },
    timestamp: {
        type: Date,
        required: true
    }
}, { _id: false });

const attendanceSchema = new mongoose.Schema({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // 🔥 IMPORTANT: Store normalized date (start of day)
    date: {
        type: Date,
        required: true,
        index: true
    },

    checkIn: {
        type: Date,
        default: null
    },

    checkOut: {
        type: Date,
        default: null
    },

    // 🔥 LIVE STATUS (used by dashboard + idle API)
    status: {
        type: String,
        enum: ['checked-in', 'on-break', 'idle', 'active', 'checked-out', 'absent', 'working', 'paused', 'completed', 'missing_checkout'],
        default: 'absent'
    },

    // 🔥 IDLE TRACKING (VERY IMPORTANT)
    isIdle: {
        type: Boolean,
        default: false
    },

    lastIdleStatusUpdate: {
        type: Date,
        default: null
    },

    // 🔥 Idle timeline (for reports & analytics)
    idleEvents: [idleEventSchema],

    totalIdleTime: {
        type: Number,
        default: 0 // in seconds
    },

    // Existing break system (keep this)
    breaks: [{
        startTime: { type: Date, required: true },
        endTime: { type: Date, default: null },
        duration: { type: Number, default: 0 }
    }],

    totalWorkHours: {
        type: Number,
        default: 0
    },

    totalBreakTime: {
        type: Number,
        default: 0
    },

    // 🔥 Paused time tracking (when user logs out during work)
    pausedEvents: [{
        startTime: { type: Date, required: true },
        endTime: { type: Date, default: null },
        duration: { type: Number, default: 0 } // in minutes
    }],

    totalPausedTime: {
        type: Number,
        default: 0 // in minutes
    },

    // 🔥 Screenshots every 3 min (from .NET tracker)
    screenshots: [screenshotSchema]

}, { timestamps: true });


// 🔥 CRITICAL: Prevent duplicate attendance per day per employee
attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

const Attendance =
    mongoose.models.Attendance ||
    mongoose.model('Attendance', attendanceSchema);

module.exports = Attendance;