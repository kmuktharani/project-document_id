const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
    employee_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    start_date: {
        type: Date,
        required: true
    },
    end_date: {
        type: Date,
        required: true
    },
    leave_type: {
        type: String,
        enum: ['Personal Leave', 'Sick Leave', 'Casual Leave', 'Annual Leave'],
        default: 'Personal Leave'
    },
    reason: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
        index: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Leave', leaveSchema);
