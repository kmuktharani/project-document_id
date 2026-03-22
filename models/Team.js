const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    description: {
        type: String,
        trim: true
    },
      teamLead: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Project",
        required: true,
        index: true
    },

    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],

    manager: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },


    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Team', teamSchema);