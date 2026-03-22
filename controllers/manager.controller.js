const User = require("../models/user");

exports.createManager = async (req, res, next) => {
    try {
        const { firstName, lastName, email, phone, department } = req.body;

        if (!firstName || !email || !department) {
            return res.status(400).json({
                success: false,
                message: "Required fields missing"
            });
        }

        const newManager = await User.create({
            firstName,
            lastName,
            email,
            phone,
            department,
            role: 'manager',
            password: 'defaultPassword123'
        });

        res.status(201).json({
            success: true,
            message: "Manager created successfully",
            data: newManager
        });
    } catch (error) {
        next(error);
    }
};

exports.getAllManagers = async (req, res, next) => {
    try {
        const managers = await User.find({ role: 'manager', isDeleted: false });
        res.status(200).json({
            success: true,
            data: managers
        });
    } catch (error) {
        next(error);
    }
};