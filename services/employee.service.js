const User = require('../models/user');
const { hashPassword } = require('../utils/password');

const createEmployee = async (employeeData) => {
    const existingEmployee = await User.findOne({ 
        $or: [{ email: employeeData.email }, { username: employeeData.username }],
        isDeleted: false
    });
    
    if (existingEmployee) {
        throw new Error('Employee already exists');
    }

    return await User.create(employeeData);
};

const getAllEmployees = async (filters = {}) => {
    return await User.find({ ...filters, isDeleted: false });
};

const getEmployeeById = async (id) => {
    const employee = await User.findOne({ _id: id, isDeleted: false });
    if (!employee) {
        throw new Error('Employee not found');
    }
    return employee;
};

const updateEmployee = async (id, updateData) => {
    if (updateData.password) {
        updateData.password = await hashPassword(updateData.password);
    }

    if (updateData.$push?.team) {
        const employee = await User.findOneAndUpdate(
            { _id: id, isDeleted: false },
            { $push: { team: updateData.$push.team } },
            { new: true, runValidators: true }
        );
        if (!employee) throw new Error('Employee not found');
        return employee;
    }

    if (updateData.$pull?.team) {
        const employee = await User.findOneAndUpdate(
            { _id: id, isDeleted: false },
            { $pull: { team: updateData.$pull.team } },
            { new: true, runValidators: true }
        );
        if (!employee) throw new Error('Employee not found');
        return employee;
    }

    const employee = await User.findOneAndUpdate(
        { _id: id, isDeleted: false },
        updateData,
        { new: true, runValidators: true }
    );

    if (!employee) {
        throw new Error('Employee not found');
    }

    return employee;
};

const deleteEmployee = async (id) => {
    const employee = await User.findOneAndUpdate(
        { _id: id, isDeleted: false },
        { isDeleted: true },
        { new: true }
    );
    if (!employee) {
        throw new Error('Employee not found');
    }
    return employee;
};

const searchEmployees = async (searchTerm) => {
    return await User.find({
        isDeleted: false,
        $or: [
            { firstName: { $regex: searchTerm, $options: 'i' } },
            { lastName: { $regex: searchTerm, $options: 'i' } },
            { email: { $regex: searchTerm, $options: 'i' } },
            { username: { $regex: searchTerm, $options: 'i' } }
        ]
    });
};

const getEmployeesByDepartment = async (department) => {
    return await User.find({ department, isDeleted: false });
};

const getEmployeesByTeam = async (teamName) => {
    return await User.find({ team: teamName, isDeleted: false });
};

module.exports = {
    createEmployee,
    getAllEmployees,
    getEmployeeById,
    updateEmployee,
    deleteEmployee,
    searchEmployees,
    getEmployeesByDepartment,
    getEmployeesByTeam
};