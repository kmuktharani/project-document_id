const { generateToken } = require("../utils/jwt");
const User = require("../models/user");
const bcrypt = require("bcrypt");
const attendanceService = require('../services/attendance.service');

const login = async (req, res, next) => {
    try {
        const { email, username, password } = req.body;
        console.log(username, email, password);

        const user = await User.findOne({ 
            $or: [{ email }, { username }],
            isDeleted: false 
        }).select('+password');
        console.log(user);

        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }

        await User.findByIdAndUpdate(user._id, { lastActive: new Date() });

        // Resume work if user was in paused state
        try {
            await attendanceService.resumeWork(user._id);
        } catch (error) {
            console.log('No paused work session to resume');
        }

        const token = generateToken({ id: user._id, role: user.role, email: user.email });

        res.status(200).json({
            success: true,
            message: 'Login successful',
            email: user.email,
            username: user.username,
            role: user.role,
            token,
            userId: user._id
        });
    } catch (error) {
        next(error);
    }
};

const changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword,confirmPassword} = req.body;
                // check new and confirm password
        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "New password and confirm password do not match"
            });
        }

        const user = await User.findById(req.user.id).select('+password');


         if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
                if (!(await user.comparePassword(currentPassword))) {
            return res.status(401).json({
                success: false,
                message: "Current password is incorrect"
            });
        }


        const hashedPassword = await bcrypt.hash(newPassword, 12);

        await User.findByIdAndUpdate(req.user.id, {
            password: hashedPassword
        });

        res.status(200).json({
            success: true,
            message: "Password changed successfully"
        });


    
    } catch (error) {
        next(error);
    }
};

const logout = async (req, res, next) => {
    try {
        // Pause work if user is currently working
        if (req.user && req.user.id) {
            try {
                await attendanceService.pauseWork(req.user.id);
            } catch (error) {
                console.log('No active work session to pause');
            }
        }

        res.status(200).json({
            success: true,
            message: 'Logout successful'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { login, changePassword, logout };
