const payrollService = require("../services/payroll.service");

const getPayrolls = (req, res) => {
    try {
        const payrolls = payrollService.getAllPayrolls();
        res.status(200).json(payrolls);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch payrolls" });
    }
};

module.exports = {
    getPayrolls,
};