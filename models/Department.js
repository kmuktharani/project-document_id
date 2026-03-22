const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true,
        minlength: 2,
        maxlength: 5
    },
    description: {
        type: String,
        trim: true
    },
    headOfDepartment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    employees: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    teams: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team'
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { timestamps: true });

departmentSchema.index({ isActive: 1 });
departmentSchema.index({ code: 1 });

module.exports = mongoose.model('Department', departmentSchema);
