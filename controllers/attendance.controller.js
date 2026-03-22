const attendanceService = require('../services/attendance.service');

const checkIn = async (req, res, next) => {
    try {
        const employeeId = req.user.id;
        console.log("👤 Employee ID for Check-In:", employeeId);
        const attendance = await attendanceService.checkIn(employeeId);
        console.log("✅ Check-In Successful:", attendance);

        res.status(200).json({
            success: true,
            message: attendance.status === 'working' ? "Checked in successfully - Timer started" : "Resumed work - Timer resumed",
            data: {
                checkIn: attendance.checkIn,
                status: attendance.status,
                totalBreakTime: attendance.totalBreakTime,
                totalPausedTime: attendance.totalPausedTime
            }
        });
    } catch (error) {
        next(error);
    }
};

const checkOut = async (req, res, next) => {
    try {
        const employeeId = req.user.id;
        const attendance = await attendanceService.checkOut(employeeId);

        // Format times for display
        const checkInTime = attendance.checkIn.toLocaleTimeString('en-IN', { 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: true 
        });
        const checkOutTime = attendance.checkOut.toLocaleTimeString('en-IN', { 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: true 
        });

        // Format work hours as HH:MM:SS
        const totalHours = Math.floor(attendance.totalWorkHours);
        const totalMinutes = Math.floor((attendance.totalWorkHours - totalHours) * 60);
        const totalSeconds = Math.floor(((attendance.totalWorkHours - totalHours) * 60 - totalMinutes) * 60);
        const formattedWorkHours = `${totalHours.toString().padStart(2, '0')}:${totalMinutes.toString().padStart(2, '0')}:${totalSeconds.toString().padStart(2, '0')}`;

        res.status(200).json({
            success: true,
            message: "Attendance Completed for Today",
            data: {
                checkIn: checkInTime,
                checkOut: checkOutTime,
                breakTime: `${Math.floor(attendance.totalBreakTime)} minutes`,
                pausedTime: `${Math.floor(attendance.totalPausedTime)} minutes`,
                totalWorkingHours: formattedWorkHours,
                status: attendance.status
            }
        });
    } catch (error) {
        next(error);
    }
};

const startBreak = async (req, res, next) => {
    try {
        const employeeId = req.user.id;
        const attendance = await attendanceService.startBreak(employeeId);

        res.status(200).json({
            success: true,
            message: "Break started - Work timer paused",
            data: {
                status: attendance.status,
                breakStartTime: attendance.breaks[attendance.breaks.length - 1].startTime
            }
        });
    } catch (error) {
        next(error);
    }
};

const endBreak = async (req, res, next) => {
    try {
        const employeeId = req.user.id;
        const attendance = await attendanceService.endBreak(employeeId);
        const lastBreak = attendance.breaks[attendance.breaks.length - 1];

        res.status(200).json({
            success: true,
            message: "Break ended - Work timer resumed",
            data: {
                status: attendance.status,
                breakDuration: `${Math.floor(lastBreak.duration)} minutes`,
                totalBreakTime: `${Math.floor(attendance.totalBreakTime)} minutes`
            }
        });
    } catch (error) {
        next(error);
    }
};

const getCurrentSession = async (req, res, next) => {
    try {
        const employeeId = req.user.id;
        const session = await attendanceService.getCurrentSession(employeeId);
        
        return res.status(200).json({
            success: true,
            data: session || null
        });

    } catch (error) {
        next(error);
    }
};

const getMissingCheckouts = async (req, res, next) => {
    try {
        const { id: userId, role } = req.user;
        const missingSessions = await attendanceService.getMissingCheckoutsByRole(userId, role);
        
        res.status(200).json({
            success: true,
            message: missingSessions.length > 0 ? 
                `Found ${missingSessions.length} missing checkout(s)` : 
                'No missing checkouts found',
            data: {
                missingSessions: missingSessions,
                count: missingSessions.length
            }
        });
    } catch (error) {
        next(error);
    }
};

const getAttendance = async (req, res, next) => {
    try {
        const employeeId = req.query.employeeId || req.user.id;
        const { date, page = 1, limit = 10 } = req.query;

        const result = await attendanceService.getAttendanceRecords(
            employeeId,
            date,
            parseInt(page),
            parseInt(limit)
        );

        res.status(200).json({
            success: true,
            ...result
        });
    } catch (error) {
        next(error);
    }
};

const getTeamAttendance = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userRole = (req.user.role || '').toLowerCase().replace(/[\s]+/g, '_');
        const { date, page = 1, limit = 20 } = req.query;

        const result = await attendanceService.getAttendanceByRole(
            userId,
            userRole,
            { date, page: parseInt(page), limit: parseInt(limit) }
        );

        res.status(200).json({
            success: true,
            ...result
        });
    } catch (error) {
        next(error);
    }
};

const toggleAvailability = async (req, res, next) => {
    try {
        const User = require('../models/user');
        const userId = req.user.id;
        const user = await User.findById(userId).select('availability username');
        
        const newStatus = user.availability === 'available' ? 'not available' : 'available';
        await User.findByIdAndUpdate(userId, { availability: newStatus });
     // 🔴 SOCKET BROADCAST
        const io = req.app.get("io");

        io.emit("availabilityUpdated", {
            userId,
            username: user.username,
            availability: newStatus
        });


        res.status(200).json({
            success: true,
            message: `Availability set to ${newStatus}`,
            availability: newStatus
        });
    } catch (error) {
        next(error);
    }
};

const getAvailableMembers = async (req, res, next) => {
    try {
        const User = require('../models/user');
        const Team = require('../models/Team');
        const userId = req.user.id;
        const userRole = req.user.role;

        const currentUser = await User.findById(userId).select('firstName lastName username email role teams availability');

        let filter = { isDeleted: false, _id: { $ne: userId } };

        if (userRole === 'employee' || userRole === 'team_lead') {
            const teams = await Team.find({ 
                $or: [
                    { members: currentUser.username },
                    { teamLead: currentUser.username }
                ]
            }).select('members teamLead manager name');
            
            const allUsernames = [...new Set(teams.flatMap(t => [
                ...t.members,
                t.teamLead,
                t.manager
            ].filter(Boolean)))];
            
            filter.username = { $in: allUsernames };
        } else if (userRole === 'manager') {
            const teams = await Team.find({ manager: currentUser.username }).select('members teamLead manager name');
            
            const allUsernames = [...new Set(teams.flatMap(t => [
                ...t.members,
                t.teamLead
            ].filter(Boolean)))];
            
            filter.username = { $in: allUsernames };
        }

        const [available, notAvailable] = await Promise.all([
            User.find({ ...filter, $or: [{ availability: 'available' }, { availability: { $exists: false } }] })
                .select('firstName lastName username email role teams availability')
                .lean(),
            User.find({ ...filter, availability: 'not available' })
                .select('firstName lastName username email role teams availability')
                .lean()
        ]);

        res.status(200).json({
            success: true,
            myAvailability: currentUser.availability || 'not available',
            available: { count: available.length, members: available },
            notAvailable: { count: notAvailable.length, members: notAvailable }
        });
    } catch (error) {
        console.error('Get available members error:', error);
        next(error);
    }
};

module.exports = {
    checkIn,
    checkOut,
    startBreak,
    endBreak,
    getCurrentSession,
    getMissingCheckouts,
    getAttendance,
    getTeamAttendance,
    toggleAvailability,
    getAvailableMembers
};