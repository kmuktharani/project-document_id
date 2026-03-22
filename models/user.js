const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const departmentCodes = {
    developer: "DEV",
    manager: "MNG",
    employee: "EMP",
    hr: "HR",
    admin: "ADM",
    tester: "TST"
};

function getDepartmentCode(department) {
    return departmentCodes[department.toLowerCase()] || "GEN";
}

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        unique: true,
        uppercase: true,
        trim: true
    },
    firstName: {
        type: String,
        required: true,
        trim: true,
        minlength: 2
    },
    lastName: {
        type: String,
        required: true,
        trim: true,
        minlength: 2
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'Please use a valid email address']
    },
    password: {
        type: String,
        required: true,
        minlength: 6,
        select: false
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'idle', 'banned'],
        default: 'active',
        lowercase: true,
        index: true
    },
    role: {
        type: String,
        enum: ['admin', 'manager', 'employee', 'hr', 'team_lead', 'project_manager'],
        default: 'employee',
        lowercase: true,
        index: true
    },
    department: {
        type: String,
        required: true,
        uppercase: true,
        trim: true,
        index: true
    },
    teams: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: 'Team',
        default: [],
        validate: {
            validator: function (value) {
                // HR and Admin should not have teams
                if (this.role === 'hr' || this.role === 'admin') {
                    return value.length === 0;
                }

                // Employee & team_lead should have exactly ONE team
                if (this.role === 'employee' || this.role === 'team_lead') {
                    return value.length === 1;
                }

                // Manager can have one or more teams
                if (this.role === 'manager') {
                    return value.length >= 1;
                }

                return true;
            },
            message: 'Invalid number of teams assigned for this role'
        }
    },
    phone: {
        type: String,
        default: null
    },
    joiningDate: {
        type: Date,
        default: null
    },
    profilePic: {
        type: String,
        default: null
    },
    salary: {
        base: { type: Number, default: 0 },
        bonus: { type: Number, default: 0 },
        deductions: { type: Number, default: 0 },
        currency: { type: String, default: 'INR' }
    },
    bankDetails: {
        bankName: { type: String },
        accountNumber: { type: String, select: false },
        ifscCode: { type: String }
    },
    address: {
        current: {
            street: String,
            city: String,
            state: String,
            country: String,
            postalCode: String
        },
        permanent: {
            street: String,
            city: String,
            state: String,
            country: String,
            postalCode: String
        },
        workLocation: {
            type: String,
            enum: ['Office', 'Remote', 'Hybrid'],
            default: 'Office'
        }
    },
    availability: {
        type: String,
        enum: ['available', 'not available'],
        default: 'not available',
        index: true
    },
    lastActive: {
        type: Date,
        default: Date.now
    },
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
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

userSchema.index({ isDeleted: 1, status: 1 });
userSchema.index({ isDeleted: 1, role: 1 });
userSchema.index({ isDeleted: 1, department: 1 });

userSchema.pre('save', async function () {
    if (this.isNew && !this.username) {
        const deptCode = getDepartmentCode(this.department);
        const year = new Date().getFullYear();

        const lastEmployee = await mongoose.model('User').findOne({
            username: new RegExp(`^${deptCode}-${year}-`)
        }).sort({ username: -1 });

        let sequence = 1;
        if (lastEmployee && lastEmployee.username) {
            const lastSeq = parseInt(lastEmployee.username.split('-')[2]);
            sequence = lastSeq + 1;
        }

        this.username = `${deptCode}-${year}-${String(sequence).padStart(3, '0')}`;
    }

    if (this.isModified('password')) {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
    }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

userSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        delete ret.password;
        delete ret.id; // Remove duplicate _id field
        return ret;
    }
});

userSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`;
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;