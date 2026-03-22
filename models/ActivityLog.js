const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema(
    {
        employee_id: {
            type: String,
            required: true,
            index: true
        },
        app_name: {
            type: String,
            required: true,
            index: true
        },
        window_title: {
            type: String,
            required: true
        },

        // 🔥 Used for deduplication (daily aggregation)
        day: {
            type: Date,
            required: true,
            index: true
        },

        start_time: {
            type: Date,
            required: true
        },

        end_time: {
            type: Date,
            required: true
        },

        duration_seconds: {
            type: Number,
            default: 0
        },

        created_at: {
            type: Date,
            default: Date.now
        },

        updated_at: {
            type: Date,
            default: Date.now
        }
    },
    { versionKey: false }
);

// 🚀 COMPOUND INDEX (Prevents duplicates at DB level)
activityLogSchema.index({
    employee_id: 1,
    app_name: 1,
    window_title: 1,
    day: 1
}, { unique: true });

module.exports = mongoose.model("ActivityLog", activityLogSchema);