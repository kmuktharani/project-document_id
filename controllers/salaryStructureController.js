const SalaryStructure = require("../models/SalaryStructure");
const User = require("../models/user");

exports.createSalaryStructure = async (req, res) => {
    try {
        const { username, basic, hra = 0, bonus = 0, deductions = 0, effectiveFrom } = req.body;

        const employee = await User.findOne({ username: username.toUpperCase() });
        if (!employee) {
            return res.status(404).json({ message: "Employee not found" });
        }

        await SalaryStructure.updateMany(
            { employeeId: employee._id, isActive: true },
            { isActive: false }
        );

        const salary = await SalaryStructure.create({
            employeeId: employee._id,
            basic,
            hra,
            bonus,
            deductions,
            effectiveFrom
        });

        res.status(201).json({
            message: "Salary structure created",
            salary
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateSalaryStructure = async (req, res) => {
    try {
        const { username } = req.params;
        const { basic, hra = 0, bonus = 0, deductions = 0, effectiveFrom } = req.body;

        const employee = await User.findOne({ username: username.toUpperCase() });
        if (!employee) {
            return res.status(404).json({ message: "Employee not found" });
        }

        await SalaryStructure.updateMany(
            { employeeId: employee._id, isActive: true },
            { isActive: false }
        );

        const newSalary = await SalaryStructure.create({
            employeeId: employee._id,
            basic,
            hra,
            bonus,
            deductions,
            effectiveFrom
        });

        res.json({
            message: "Salary structure updated",
            salary: newSalary
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getCurrentSalaryStructure = async (req, res) => {
    try {
        const { username } = req.params;

        const employee = await User.findOne({ username: username.toUpperCase() });
        if (!employee) {
            return res.status(404).json({ message: "Employee not found" });
        }

        const salary = await SalaryStructure.findOne({
            employeeId: employee._id,
            isActive: true
        });

        if (!salary) {
            return res.status(404).json({ message: "No active salary structure found" });
        }

        res.json(salary);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
