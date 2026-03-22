const Attendance = require('../models/attendance');

const getISTTime = () => {
    // Get current time in IST (UTC+5:30)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    return new Date(now.getTime() + istOffset - (now.getTimezoneOffset() * 60 * 1000));
};

const getISTDate = () => {
    // Get current date in IST timezone
    const istTime = getISTTime();
    return new Date(Date.UTC(
        istTime.getUTCFullYear(),
        istTime.getUTCMonth(),
        istTime.getUTCDate()
    ));
};

const checkIn = async (employeeId) => {
    const today = getISTDate();
    const now = getISTTime();

    let attendance = await Attendance.findOne({ employeeId, date: today });
    
    // If no attendance record exists, create new one
    if (!attendance) {
        const User = require('../models/user');
        await User.findByIdAndUpdate(employeeId, { availability: 'available' });

        return await Attendance.create({
            employeeId,
            date: today,
            checkIn: now,
            status: 'working'
        });
    }

    // If already checked in today
    if (attendance.checkIn && attendance.status !== 'paused') {
        throw new Error('Already checked in today');
    }

    // If resuming from paused state
    if (attendance.status === 'paused') {
        // End the last paused event
        const lastPausedEvent = attendance.pausedEvents[attendance.pausedEvents.length - 1];
        if (lastPausedEvent && !lastPausedEvent.endTime) {
            lastPausedEvent.endTime = now;
            lastPausedEvent.duration = (lastPausedEvent.endTime - lastPausedEvent.startTime) / (1000 * 60);
            attendance.totalPausedTime += lastPausedEvent.duration;
        }
        
        attendance.status = 'working';
        const User = require('../models/user');
        await User.findByIdAndUpdate(employeeId, { availability: 'available' });
        
        return await attendance.save();
    }

    // First check-in of the day
    if (!attendance.checkIn) {
        attendance.checkIn = now;
        attendance.status = 'working';
        
        const User = require('../models/user');
        await User.findByIdAndUpdate(employeeId, { availability: 'available' });
        
        return await attendance.save();
    }

    throw new Error('Invalid check-in state');
};

const checkOut = async (employeeId) => {
    const today = getISTDate();
    const now = getISTTime();

    const attendance = await Attendance.findOne({ employeeId, date: today });
    if (!attendance || !attendance.checkIn) {
        throw new Error('No check-in found for today');
    }
    if (attendance.checkOut) {
        throw new Error('Already checked out');
    }

    // Auto-end active break if on break
    if (attendance.status === 'on-break') {
        const lastBreak = attendance.breaks[attendance.breaks.length - 1];
        if (lastBreak && !lastBreak.endTime) {
            lastBreak.endTime = now;
            lastBreak.duration = (lastBreak.endTime - lastBreak.startTime) / (1000 * 60);
            attendance.totalBreakTime += lastBreak.duration;
        }
    }

    // Auto-end paused state if paused
    if (attendance.status === 'paused') {
        const lastPausedEvent = attendance.pausedEvents[attendance.pausedEvents.length - 1];
        if (lastPausedEvent && !lastPausedEvent.endTime) {
            lastPausedEvent.endTime = now;
            lastPausedEvent.duration = (lastPausedEvent.endTime - lastPausedEvent.startTime) / (1000 * 60);
            attendance.totalPausedTime += lastPausedEvent.duration;
        }
    }

    // Calculate total working hours
    const totalTimeMs = now - attendance.checkIn;
    const totalHours = totalTimeMs / (1000 * 60 * 60);
    
    // Working Time = (Checkout Time - Check-in Time) - Total Break Time - Total Paused Time
    const workingHours = totalHours - (attendance.totalBreakTime / 60) - (attendance.totalPausedTime / 60);

    attendance.checkOut = now;
    attendance.totalWorkHours = Math.max(0, workingHours); // Ensure non-negative
    attendance.status = 'completed';

    const User = require('../models/user');
    await User.findByIdAndUpdate(employeeId, { availability: 'not available' });

    return await attendance.save();
};

const startBreak = async (employeeId) => {
    const today = getISTDate();
    const now = getISTTime();

    const attendance = await Attendance.findOne({ employeeId, date: today });
    if (!attendance || !attendance.checkIn) {
        throw new Error('Check in first');
    }
    if (attendance.status === 'on-break') {
        throw new Error('Already on break');
    }
    if (attendance.status !== 'working') {
        throw new Error('Must be in working status to take break');
    }

    attendance.breaks.push({ startTime: now });
    attendance.status = 'on-break';

    return await attendance.save();
};

const endBreak = async (employeeId) => {
    const today = getISTDate();
    const now = getISTTime();

    const attendance = await Attendance.findOne({ employeeId, date: today });
    if (!attendance || attendance.status !== 'on-break') {
        throw new Error('No active break found');
    }

    const lastBreak = attendance.breaks[attendance.breaks.length - 1];
    lastBreak.endTime = now;
    lastBreak.duration = (lastBreak.endTime - lastBreak.startTime) / (1000 * 60);

    attendance.totalBreakTime += lastBreak.duration;
    attendance.status = 'working'; // Resume working status

    return await attendance.save();
};
const getCurrentSession = async (employeeId) => {
    const today = getISTDate();
    const session = await Attendance.findOne({ employeeId, date: today });

    if (!session) return null;

    // Check if it's a previous day with missing checkout
    const now = new Date();
    const sessionDate = new Date(session.date);
    const isToday = sessionDate.toDateString() === now.toDateString();
    
    let status = session.status;
    let hasMissingCheckout = false;
    
    // If session is from previous day and no checkout, mark as missing checkout
    if (!isToday && session.checkIn && !session.checkOut) {
        hasMissingCheckout = true;
        status = 'missing_checkout';
    }

    return {
        checkIn: session.checkIn,
        checkOut: session.checkOut,
        status: status,
        hasMissingCheckout: hasMissingCheckout,
        totalBreakTime: session.totalBreakTime || 0,
        totalPausedTime: session.totalPausedTime || 0,
        totalWorkHours: session.totalWorkHours || 0,
        breaks: session.breaks || [],
        pausedEvents: session.pausedEvents || [],
        date: session.date
    };
};

// Get attendance with missing checkout detection based on role
const getMissingCheckoutsByRole = async (userId, userRole) => {
    const User = require('../models/user');
    const Team = require('../models/Team');
    const today = getISTDate();
    
    let employeeIds = [];
    
    if (userRole === 'admin') {
        // Admin can see all missing checkouts
        const allUsers = await User.find({ isDeleted: false }).select('_id');
        employeeIds = allUsers.map(u => u._id);
    } else if (userRole === 'hr') {
        // HR can see all except admin
        const users = await User.find({ role: { $ne: 'admin' }, isDeleted: false }).select('_id');
        employeeIds = users.map(u => u._id);
    } else if (userRole === 'manager') {
        // Manager can see their team leads and employees
        const currentUser = await User.findById(userId).select('username');
        const teams = await Team.find({ manager: currentUser.username, isActive: true });
        const usernames = [...new Set(teams.flatMap(t => [t.teamLead, ...t.members]))];
        const users = await User.find({ username: { $in: usernames }, isDeleted: false }).select('_id');
        employeeIds = users.map(u => u._id);
    } else if (userRole === 'team_lead') {
        // Team lead can see their team members
        const currentUser = await User.findById(userId).select('username');
        const team = await Team.findOne({ teamLead: currentUser.username, isActive: true });
        if (team) {
            const users = await User.find({ username: { $in: team.members }, isDeleted: false }).select('_id');
            employeeIds = users.map(u => u._id);
        }
    } else {
        // Employee can only see their own
        employeeIds = [userId];
    }
    
    // Find missing checkouts
    const missingSessions = await Attendance.find({
        employeeId: { $in: employeeIds },
        date: { $lt: today },
        checkIn: { $ne: null },
        checkOut: null,
        status: { $nin: ['completed', 'missing_checkout'] }
    }).populate('employeeId', 'firstName lastName username role department')
      .sort({ date: -1 })
      .limit(50);
    
    return missingSessions.map(session => ({
        ...session.toObject(),
        status: 'missing_checkout',
        hasMissingCheckout: true,
        employee: {
            name: session.employeeId.firstName + ' ' + session.employeeId.lastName,
            username: session.employeeId.username,
            role: session.employeeId.role,
            department: session.employeeId.department
        }
    }));
};

// Handle logout during work - pause the timer
const pauseWork = async (employeeId) => {
    const today = getISTDate();
    const now = getISTTime();

    const attendance = await Attendance.findOne({ employeeId, date: today });
    if (!attendance || !attendance.checkIn || attendance.checkOut) {
        return; // No active session to pause
    }

    if (attendance.status === 'working') {
        attendance.pausedEvents.push({ startTime: now });
        attendance.status = 'paused';
        await attendance.save();
    }
};

// Handle login during paused work - resume the timer
const resumeWork = async (employeeId) => {
    const today = getISTDate();
    const now = getISTTime();

    const attendance = await Attendance.findOne({ employeeId, date: today });
    if (!attendance || attendance.status !== 'paused') {
        return; // No paused session to resume
    }

    // End the last paused event
    const lastPausedEvent = attendance.pausedEvents[attendance.pausedEvents.length - 1];
    if (lastPausedEvent && !lastPausedEvent.endTime) {
        lastPausedEvent.endTime = now;
        lastPausedEvent.duration = (lastPausedEvent.endTime - lastPausedEvent.startTime) / (1000 * 60);
        attendance.totalPausedTime += lastPausedEvent.duration;
    }

    attendance.status = 'working';
    await attendance.save();
};

const getAttendanceRecords = async (employeeId, date = null, page = 1, limit = 10) => {
    const query = { employeeId };
    if (date) {
        const targetDate = new Date(date);
        query.date = new Date(Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()));
    }

    const skip = (page - 1) * limit;
    const total = await Attendance.countDocuments(query);
    const attendance = await Attendance.find(query)
        .populate('employeeId', 'firstName lastName username')
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit);

    return {
        attendance,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    };
};

const getAttendanceByDateRange = async (employeeId, startDate, endDate) => {
    return await Attendance.find({
        employeeId,
        date: { $gte: new Date(startDate), $lte: new Date(endDate) }
    });
};

const getTodayAttendance = async (employeeId) => {
    const today = getISTDate();
    return await Attendance.findOne({ employeeId, date: today });
};

const getAttendanceByRole = async (userId, userRole, filters = {}) => {
    const User = require('../models/user');
    const { date, page = 1, limit = 10 } = filters;

    const roleHierarchy = {
        admin: ['hr', 'manager', 'team_lead', 'employee'],
        hr: ['manager', 'team_lead', 'employee'],
        manager: ['team_lead', 'employee']
    };

    let query = {};

    if (roleHierarchy[userRole]) {
        const users = await User.find({
            role: { $in: [...roleHierarchy[userRole], userRole] },
            isDeleted: false
        }).select('_id');
        query.employeeId = { $in: users.map(u => u._id) };
    } else if (userRole === 'team_lead') {
        const teamLead = await User.findById(userId).select('team');
        const teamNames = teamLead?.team || [];
        const teamMembers = await User.find({
            $or: [
                { _id: userId },
                { team: { $in: teamNames }, isDeleted: false }
            ]
        }).select('_id');
        query.employeeId = { $in: teamMembers.map(u => u._id) };
    } else {
        query.employeeId = userId;
    }

    if (date) {
        const targetDate = new Date(date);
        query.date = new Date(Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()));
    }

    const skip = (page - 1) * limit;
    const [attendance, total] = await Promise.all([
        Attendance.find(query)
            .populate('employeeId', 'firstName lastName username role team')
            .sort({ date: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Attendance.countDocuments(query)
    ]);

    // Format attendance records
    const formatted = attendance.map(record => {
        const data = {
            ...record,
            totalWorkHours: record.totalWorkHours ? parseFloat(record.totalWorkHours.toFixed(2)) : 0,
            totalBreakTime: record.totalBreakTime ? parseFloat(record.totalBreakTime.toFixed(2)) : 0,
            breaks: record.breaks?.map(b => ({
                ...b,
                duration: b.duration ? parseFloat(b.duration.toFixed(2)) : 0
            })) || []
        };

        // Remove employeeId and team for employee role
        if (userRole === 'employee') {
            delete data.employeeId;
            delete data.team;
        }

        return data;
    });

    // Categorize by date, then by team for admin, hr, manager
    let categorized = formatted;
    if (['admin', 'hr', 'manager'].includes(userRole)) {
        categorized = formatted.reduce((acc, record) => {
            const dateKey = new Date(record.date).toISOString().split('T')[0];
            if (!acc[dateKey]) acc[dateKey] = {};

            const team = record.employeeId?.team || 'No Team';
            if (!acc[dateKey][team]) acc[dateKey][team] = [];
            acc[dateKey][team].push(record);
            return acc;
        }, {});
    } else if (userRole === 'team_lead') {
        // Categorize by date for team lead
        categorized = formatted.reduce((acc, record) => {
            const dateKey = new Date(record.date).toISOString().split('T')[0];
            if (!acc[dateKey]) acc[dateKey] = [];
            acc[dateKey].push(record);
            return acc;
        }, {});
    } else {
        // Categorize by date for employee
        categorized = formatted.reduce((acc, record) => {
            const dateKey = new Date(record.date).toISOString().split('T')[0];
            if (!acc[dateKey]) acc[dateKey] = [];
            acc[dateKey].push(record);
            return acc;
        }, {});
    }

    return {
        attendance: categorized,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    };
};

module.exports = {
    checkIn,
    checkOut,
    startBreak,
    endBreak,
    pauseWork,
    resumeWork,
    getAttendanceRecords,
    getAttendanceByDateRange,
    getTodayAttendance,
    getCurrentSession,
    getMissingCheckoutsByRole,
    getAttendanceByRole
};
