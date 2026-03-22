const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    projectId: {
        type: String,
        required: true,
        unique: true
    },
    projectName: {
        type: String,
        required: true
    },
    description: String,
    startDate: {
        type: Date,
        required: true
    },
    endDate: Date,
    assignedManager: {
        type: String,
        required: true
    },
    teams: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team'
    }],
    status: {
        type: String,
        enum: ['active', 'paused', 'completed'],
        default: 'active'
    }
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);