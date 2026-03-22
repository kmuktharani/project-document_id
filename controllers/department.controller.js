const Department = require('../models/Department');
const User = require('../models/user');
const Team = require('../models/Team');
const mongoose = require('mongoose');

exports.createDepartment = async (req, res, next) => {
    try {
        const { name, code, description, headOfDepartment } = req.body;

        if (!name || !code) {
            return res.status(400).json({ message: 'Name and code are required' });
        }

        const existingDept = await Department.findOne({ 
            $or: [{ name }, { code: code.toUpperCase() }] 
        });

        if (existingDept) {
            return res.status(400).json({ 
                message: 'Department with this name or code already exists' 
            });
        }

        let hodId = null;
        if (headOfDepartment) {
            const hodUser = await User.findById(headOfDepartment);
            if (!hodUser) {
                return res.status(404).json({ message: 'Head of Department not found' });
            }
            hodId = hodUser._id;
        }

        const department = await Department.create({
            name,
            code: code.toUpperCase(),
            description,
            headOfDepartment: hodId,
            createdBy: req.user.id
        });

        const populatedDept = await Department.findById(department._id)
            .populate('headOfDepartment', 'username firstName lastName email')
            .populate('createdBy', 'username firstName lastName');

        res.status(201).json({
            success: true,
            message: 'Department created successfully',
            data: populatedDept
        });
    } catch (error) {
        next(error);
    }
};

exports.getAllDepartments = async (req, res, next) => {
    try {
        const { isActive } = req.query;
        const filter = {};
        
        if (isActive !== undefined) {
            filter.isActive = isActive === 'true';
        }

        const departments = await Department.find(filter)
            .populate('headOfDepartment', 'username firstName lastName email')
            .populate('employees', 'username firstName lastName email role')
            .populate('teams', 'name description')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: departments.length,
            data: departments
        });
    } catch (error) {
        next(error);
    }
};

exports.getDepartmentById = async (req, res, next) => {
    try {
        const department = await Department.findById(req.params.id)
            .populate('headOfDepartment', 'username firstName lastName email phone')
            .populate('employees', 'username firstName lastName email role status')
            .populate('teams', 'name description teamLead members')
            .populate('createdBy', 'username firstName lastName')
            .populate('updatedBy', 'username firstName lastName');

        if (!department) {
            return res.status(404).json({ 
                success: false,
                message: 'Department not found' 
            });
        }

        res.json({
            success: true,
            data: department
        });
    } catch (error) {
        next(error);
    }
};

exports.updateDepartment = async (req, res, next) => {
    try {
        const { name, code, description, headOfDepartment, isActive } = req.body;

        const department = await Department.findById(req.params.id);
        if (!department) {
            return res.status(404).json({ 
                success: false,
                message: 'Department not found' 
            });
        }

        if (name && name !== department.name) {
            const existingName = await Department.findOne({ name, _id: { $ne: req.params.id } });
            if (existingName) {
                return res.status(400).json({ message: 'Department name already exists' });
            }
            department.name = name;
        }

        if (code && code.toUpperCase() !== department.code) {
            const existingCode = await Department.findOne({ 
                code: code.toUpperCase(), 
                _id: { $ne: req.params.id } 
            });
            if (existingCode) {
                return res.status(400).json({ message: 'Department code already exists' });
            }
            department.code = code.toUpperCase();
        }

        if (description !== undefined) department.description = description;
        if (isActive !== undefined) department.isActive = isActive;

        if (headOfDepartment !== undefined) {
            if (headOfDepartment) {
                const hodUser = await User.findById(headOfDepartment);
                if (!hodUser) {
                    return res.status(404).json({ message: 'Head of Department not found' });
                }
                department.headOfDepartment = hodUser._id;
            } else {
                department.headOfDepartment = null;
            }
        }

        department.updatedBy = req.user.id;
        await department.save();

        const updatedDept = await Department.findById(department._id)
            .populate('headOfDepartment', 'username firstName lastName email')
            .populate('employees', 'username firstName lastName email role')
            .populate('updatedBy', 'username firstName lastName');

        res.json({
            success: true,
            message: 'Department updated successfully',
            data: updatedDept
        });
    } catch (error) {
        next(error);
    }
};

exports.deleteDepartment = async (req, res, next) => {
    try {
        const department = await Department.findById(req.params.id);
        
        if (!department) {
            return res.status(404).json({ 
                success: false,
                message: 'Department not found' 
            });
        }

        const employeeCount = await User.countDocuments({ 
            department: department.code,
            isDeleted: false 
        });

        if (employeeCount > 0) {
            return res.status(400).json({ 
                success: false,
                message: `Cannot delete department. ${employeeCount} employee(s) are assigned to this department. Please reassign them first.` 
            });
        }

        await Department.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Department deleted successfully',
            data: department
        });
    } catch (error) {
        next(error);
    }
};

exports.assignEmployees = async (req, res, next) => {
    try {
        const { employeeIds } = req.body;

        if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
            return res.status(400).json({ 
                message: 'employeeIds array is required' 
            });
        }

        const invalidIds = employeeIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
        if (invalidIds.length > 0) {
            return res.status(400).json({ 
                success: false,
                message: 'Invalid employee ID(s) provided',
                invalidIds: invalidIds
            });
        }

        const department = await Department.findById(req.params.id);
        if (!department) {
            return res.status(404).json({ 
                success: false,
                message: 'Department not found' 
            });
        }

        const employees = await User.find({ 
            _id: { $in: employeeIds },
            isDeleted: false 
        });

        if (employees.length !== employeeIds.length) {
            const foundIds = employees.map(e => e._id.toString());
            const notFoundIds = employeeIds.filter(id => !foundIds.includes(id));
            return res.status(404).json({ 
                success: false,
                message: 'One or more employees not found',
                notFoundIds: notFoundIds
            });
        }

        await User.updateMany(
            { _id: { $in: employeeIds } },
            { $set: { department: department.code } }
        );

        department.employees = [...new Set([...department.employees.map(e => e.toString()), ...employeeIds])];
        department.updatedBy = req.user.id;
        await department.save();

        const updatedDept = await Department.findById(department._id)
            .populate('employees', 'username firstName lastName email role');

        res.json({
            success: true,
            message: `${employees.length} employee(s) assigned successfully`,
            data: updatedDept
        });
    } catch (error) {
        next(error);
    }
};

exports.removeEmployees = async (req, res, next) => {
    try {
        const { employeeIds } = req.body;

        if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
            return res.status(400).json({ 
                message: 'employeeIds array is required' 
            });
        }

        const department = await Department.findById(req.params.id);
        if (!department) {
            return res.status(404).json({ 
                success: false,
                message: 'Department not found' 
            });
        }

        department.employees = department.employees.filter(
            empId => !employeeIds.includes(empId.toString())
        );
        department.updatedBy = req.user.id;
        await department.save();

        const updatedDept = await Department.findById(department._id)
            .populate('employees', 'username firstName lastName email role');

        res.json({
            success: true,
            message: `Employee(s) removed from department successfully`,
            data: updatedDept
        });
    } catch (error) {
        next(error);
    }
};
