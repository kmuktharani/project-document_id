const Leave = require('../models/Leave');
const User = require('../models/user');

const applyLeave = async (req, res, next) => {
    try {
        const { start_date, end_date, reason, leave_type } = req.body;
        const employee_id = req.user.id;
        const role = req.user.role;

        if (role === 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Admin cannot apply for leave'
            });
        }

        const leave = await Leave.create({
            employee_id,
            start_date,
            end_date,
            leave_type: leave_type || 'Personal Leave',
            reason
        });

        res.status(201).json({
            success: true,
            message: 'Leave request submitted successfully',
            data: leave
        });
    } catch (error) {
        next(error);
    }
};

const getLeaveHistory = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;
        let query = {};

        if (role === 'manager') {
            const employees = await User.find({
                role: { $in: ['employee', 'team_lead'] },
                isDeleted: false
            }).select('_id');
            const employeeIds = employees.map(e => e._id);
            query = { employee_id: { $in: [...employeeIds, userId] } };
        } else if (role === 'hr') {
            const employees = await User.find({
                role: { $in: ['employee', 'team_lead', 'manager'] },
                isDeleted: false
            }).select('_id');
            const employeeIds = employees.map(e => e._id);
            query = { employee_id: { $in: [...employeeIds, userId] } };
        } else if (role === 'admin') {
            query = {};
        }

        const leaves = await Leave.find(query)
            .populate('employee_id', 'firstName lastName email role')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: leaves
        });
    } catch (error) {
        next(error);
    }
};

const getOwnLeaveHistory = async (req, res, next) => {
    try {
        const employee_id = req.user.id;
        const leaves = await Leave.find({ employee_id }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: leaves
        });
    } catch (error) {
        next(error);
    }
};

const updateLeaveStatus = async (req, res, next) => {
    try {
        const { leaveId } = req.params;
        const { status } = req.body;
        const approverRole = req.user.role;

        const leave = await Leave.findById(leaveId).populate('employee_id', 'role');

        if (!leave) {
            return res.status(404).json({
                success: false,
                message: 'Leave request not found'
            });
        }

        const employeeRole = leave.employee_id.role;
        let canApprove = false;

        if ((employeeRole === 'employee' || employeeRole === 'team_lead') && (approverRole === 'manager' || approverRole === 'hr')) {
            canApprove = true;
        } else if (employeeRole === 'manager' && approverRole === 'hr') {
            canApprove = true;
        } else if (employeeRole === 'hr' && approverRole === 'admin') {
            canApprove = true;
        }

        if (!canApprove) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to approve this leave request'
            });
        }

        leave.status = status;
        await leave.save();

        res.status(200).json({
            success: true,
            message: `Leave request ${status}`,
            data: leave
        });
    } catch (error) {
        next(error);
    }
};



module.exports = {
    applyLeave,
    getLeaveHistory,
    getOwnLeaveHistory,
    updateLeaveStatus
};
