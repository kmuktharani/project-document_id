const payrollData = require("../data/payroll.data");

const getAllPayrolls = () => {
  return payrollData;
};

const getPayrollByMonth = (month) => {
  return payrollData.filter(
    (p) => p.month.toLowerCase() === month.toLowerCase()
  );
};

module.exports = {
  getAllPayrolls,
  getPayrollByMonth,
};
