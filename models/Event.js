const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    title: { type: String, required: true },
    event_type: { type: String, enum: ['meeting', 'company_event', 'holiday', 'personal', 'festival', 'training', 'workshop', 'celebration'], required: true },
    date: { type: Date, required: true, index: true },
    time: { type: String },
    end_date: Date,
    participants: [{ type: String }],
    created_by: { type: String, required: true },
    // For yearly recurring events
    is_yearly: { type: Boolean, default: false },
    year: { type: Number, index: true },
    // Event scope
    scope: { 
        type: String, 
        enum: ['company', 'teams', 'managers', 'personal'], 
        default: 'personal' 
    },
    target_teams: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }]
}, { timestamps: true });

module.exports = mongoose.model('Event', eventSchema);
