const employeeService = require('../services/employee.service');
const User = require('../models/user');

const createEmployee = async (req, res, next) => {
    try {
        const employee = await employeeService.createEmployee(req.body);
        res.status(201).json({ message: "Employee created successfully", employee });
    } catch (error) {
        next(error);
    }
};

const getAllEmployees = async (req, res, next) => {
    try {
        const employees = await employeeService.getAllEmployees();
        res.status(200).json({ count: employees.length, employees });
    } catch (error) {
        next(error);
    }
};

const updateEmployee = async (req, res, next) => {
    try {
        const employee = await employeeService.updateEmployee(req.params.id, req.body);
        res.status(200).json({ message: "Employee updated successfully", employee });
    } catch (error) {
        next(error);
    }
};

const deleteEmployee = async (req, res, next) => {
    try {
        await employeeService.deleteEmployee(req.params.id);
        res.status(200).json({ message: "Employee deleted successfully" });
    } catch (error) {
        next(error);
    }
};

const SENSITIVE_FIELDS = ['salary', 'bankDetails', 'address'];

function stripSensitive(employee) {
    const obj = employee.toObject ? employee.toObject() : { ...employee };
    SENSITIVE_FIELDS.forEach(f => delete obj[f]);
    return obj;
}

// GET /api/employee/directory
const getDirectory = async (req, res, next) => {
    try {
        const { name, team, role } = req.query;
        const viewerRole = req.user.role;
        const filter = { isDeleted: false };

        if (name) {
            filter.$or = [
                { firstName: { $regex: name, $options: 'i' } },
                { lastName: { $regex: name, $options: 'i' } },
                { username: { $regex: name, $options: 'i' } }
            ];
        }
        if (team) filter.team = { $regex: team, $options: 'i' };
        if (role) filter.role = role.toLowerCase();

        const privileged = ['admin', 'hr', 'manager'];
        const isPrivileged = privileged.includes(viewerRole);
        const projection = isPrivileged
            ? '-password'
            : '-password -salary -bankDetails.bankName -bankDetails.ifscCode -address';

        const employees = await User.find(filter).select(projection).lean();

        return res.status(200).json({ count: employees.length, employees });
    } catch (error) {
        next(error);
    }
};

const getDirectoryById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const viewerRole = req.user.role;
        const viewerId = req.user.id || req.user._id;

        const employee = await User.findOne({ _id: id, isDeleted: false }).lean();
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const privileged = ['admin', 'hr', 'manager'];
        const isPrivileged = privileged.includes(viewerRole);
        const isSelf = String(employee._id) === String(viewerId);

        if (isPrivileged || isSelf) {
            const { password, ...safeEmployee } = employee;
            return res.status(200).json({ employee: safeEmployee });
        }
        return res.status(200).json({ employee: stripSensitive(employee) });
    } catch (error) {
        next(error);
    }
};

const getEmployeeList = async (req, res, next) => {
    try {
        const employees = await User.find({ isDeleted: false })
            .select('_id firstName lastName department')
            .populate('department', 'name code')
            .lean();

        const formattedEmployees = employees.map(emp => ({
            id: emp._id,
            name: `${emp.firstName} ${emp.lastName}`,
            department: emp.department
        }));

        res.status(200).json({ count: formattedEmployees.length, employees: formattedEmployees });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createEmployee,
    getAllEmployees,
    updateEmployee,
    deleteEmployee,
    getDirectory,
    getDirectoryById,
    getEmployeeList,
};