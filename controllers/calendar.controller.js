const Event = require('../models/Event');
const Leave = require('../models/Leave');
const {Task} = require('../models/Task');
const User = require('../models/user');
const Team = require('../models/Team');
const { createNotification } = require('./notificationController');

const createYearlyEvents = async (req, res, next) => {
    try {
        const { events, year } = req.body;
        const { role, id: userId } = req.user;

        if (role !== 'hr' && role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Only HR and Admin can create yearly events' });
        }

        const [currentUser, allUsers] = await Promise.all([
            User.findById(userId).select('username'),
            User.find({ isDeleted: false }).select('username')
        ]);

        await Event.deleteMany({ is_yearly: true, year });

        const yearlyEvents = events.map(event => ({
            title: event.title,
            event_type: event.type,
            date: new Date(event.date),
            participants: allUsers.map(u => u.username),
            created_by: currentUser.username,
            is_yearly: true,
            year,
            scope: 'company'
        }));

        const createdEvents = await Event.insertMany(yearlyEvents);
        res.status(201).json({ 
            success: true, 
            message: `${createdEvents.length} yearly events created for ${year}`, 
            data: createdEvents 
        });
    } catch (error) {
        next(error);
    }
};

const getParticipants = async (role, username, target_type, target_ids) => {
    let participants = [username];
    let scope = 'personal';
    let target_teams = [];

    if (role === 'admin') {
        // Admin events are always company-wide
        const users = await User.find({ isDeleted: false }).select('username');
        participants = users.map(u => u.username);
        scope = 'company';
    } else if (role === 'hr') {
        if (target_type === 'company') {
            const users = await User.find({ isDeleted: false }).select('username');
            participants = users.map(u => u.username);
            scope = 'company';
        } else if (target_type === 'teams' && target_ids?.length) {
            const teams = await Team.find({ _id: { $in: target_ids }, isActive: true });
            const userIds = [...new Set(teams.flatMap(t => [t.teamLead, t.manager, ...t.members]))];
            const users = await User.find({ username: { $in: userIds }, isDeleted: false }).select('username');
            participants = users.map(u => u.username);
            scope = 'teams';
            target_teams = target_ids;
        } else if (target_type === 'managers') {
            const managers = await User.find({ role: 'manager', isDeleted: false }).select('username');
            participants = managers.map(u => u.username);
            scope = 'managers';
        }
    } else if (role === 'manager') {
        if (target_type === 'team_leads') {
            const teams = await Team.find({ manager: username, isActive: true });
            const teamLeads = await User.find({ username: { $in: teams.map(t => t.teamLead) }, isDeleted: false }).select('username');
            participants = [username, ...teamLeads.map(u => u.username)];
            scope = 'team_leads';
        } else if (target_type === 'teams' && target_ids?.length) {
            const teams = await Team.find({ _id: { $in: target_ids }, manager: username, isActive: true });
            const userIds = [...new Set(teams.flatMap(t => [t.teamLead, ...t.members, username]))];
            const users = await User.find({ username: { $in: userIds }, isDeleted: false }).select('username');
            participants = users.map(u => u.username);
            scope = 'teams';
            target_teams = target_ids;
        } else if (target_type === 'all_teams') {
            const teams = await Team.find({ manager: username, isActive: true });
            const userIds = [...new Set(teams.flatMap(t => [t.teamLead, ...t.members, username]))];
            const users = await User.find({ username: { $in: userIds }, isDeleted: false }).select('username');
            participants = users.map(u => u.username);
            scope = 'teams';
            target_teams = teams.map(t => t._id);
        }
    } else if (role === 'team_lead') {
        const team = await Team.findOne({ teamLead: username, isActive: true });
        if (team) {
            participants = [username, ...team.members];
            scope = 'teams';
            target_teams = [team._id];
        }
    }

    return { participants, scope, target_teams };
};

const sendMeetingNotifications = async (event, participants) => {
    if (event.event_type !== 'meeting') return;
    const users = await User.find({ username: { $in: participants }, isDeleted: false }).select('_id');
    for (const user of users) {
        await createNotification(
            user._id,
            'New Meeting Scheduled',
            `You have a meeting: "${event.title}" on ${new Date(event.date).toDateString()}`,
            'meeting',
            event._id
        );
    }
};

const createEvent = async (req, res, next) => {
    try {
        const { title, event_type, date, time, end_date, target_type, target_ids } = req.body;
        const { role, id: userId } = req.user;

        // Admin creates company-wide events
        if (role === 'admin') {
            const currentUser = await User.findById(userId).select('username');
            const allUsers = await User.find({ isDeleted: false }).select('username');
            
            const event = await Event.create({
                title, event_type, date, time, end_date,
                participants: allUsers.map(u => u.username),
                scope: 'company',
                target_teams: [],
                created_by: currentUser.username
            });
            
            await sendMeetingNotifications(event, event.participants);
            return res.status(201).json({ success: true, message: 'Company event created successfully', data: event });
        }

        // Allow personal events for all users (visible to everyone)
        if (!target_type || target_type === 'personal') {
            const currentUser = await User.findById(userId).select('username');
            const allUsers = await User.find({ isDeleted: false }).select('username');
            
            const event = await Event.create({
                title, event_type, date, time, end_date,
                participants: allUsers.map(u => u.username),
                scope: 'personal',
                target_teams: [],
                created_by: currentUser.username
            });
            await sendMeetingNotifications(event, event.participants);
            return res.status(201).json({ success: true, message: 'Personal event created successfully', data: event });
        }

        // Role-based restrictions for non-personal events
        if (role === 'employee') {
            return res.status(403).json({ success: false, message: 'Employees can only create personal events' });
        }

        const currentUser = await User.findById(userId).select('username');
        const { participants, scope, target_teams } = await getParticipants(role, currentUser.username, target_type, target_ids);

        const event = await Event.create({
            title, event_type, date, time, end_date,
            participants, scope, target_teams,
            created_by: currentUser.username
        });

        await sendMeetingNotifications(event, event.participants);
        res.status(201).json({ success: true, message: 'Event created successfully', data: event });
    } catch (error) {
        next(error);
    }
};

const getCalendarEvents = async (req, res, next) => {
    try {
        const { role, id: userId } = req.user;
        const { month, year } = req.query;

        if (!month || !year) {
            return res.status(400).json({ success: false, message: 'Month and year are required' });
        }

        const currentUser = await User.findById(userId).select('username');
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const calendar = Array.from({ length: endDate.getDate() }, (_, i) => {
            const currentDate = new Date(year, month - 1, i + 1);
            return {
                date: currentDate.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata' }),
                day: currentDate.toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'Asia/Kolkata' }),
                ...(currentDate.getTime() === today.getTime() && { isToday: true })
            };
        });

        const [events, leaves, tasks] = await Promise.all([
            Event.find({ date: { $gte: startDate, $lte: endDate }, participants: currentUser.username }).lean(),
            getLeaves(role, userId, startDate, endDate),
            getTasks(role, userId, startDate, endDate)
        ]);

        events.forEach(e => {
            const dayIndex = new Date(e.date).getDate() - 1;
            if (calendar[dayIndex]) {
                if (!calendar[dayIndex].events) calendar[dayIndex].events = [];
                calendar[dayIndex].events.push({
                    title: e.title,
                    time: e.time,
                    type: e.event_type,
                    isYearly: e.is_yearly || false
                });
            }
        });

        leaves.forEach(l => {
            const start = new Date(l.start_date);
            const end = new Date(l.end_date);
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                if (d.getMonth() === month - 1 && d.getFullYear() == year) {
                    const dayIndex = d.getDate() - 1;
                    if (calendar[dayIndex]) {
                        if (!calendar[dayIndex].events) calendar[dayIndex].events = [];
                        calendar[dayIndex].events.push(l.eventData);
                    }
                }
            }
        });

        tasks.forEach(t => {
            const dayIndex = new Date(t.deadline).getDate() - 1;
            if (calendar[dayIndex]) {
                if (!calendar[dayIndex].events) calendar[dayIndex].events = [];
                calendar[dayIndex].events.push(t.eventData);
            }
        });

        res.status(200).json({ success: true, data: calendar });
    } catch (error) {
        next(error);
    }
};

const getLeaves = async (role, userId, startDate, endDate) => {
    let query = { status: 'approved', start_date: { $lte: endDate }, end_date: { $gte: startDate } };
    
    if (role === 'employee' || role === 'team_lead') {
        query.employee_id = userId;
    } else if (role === 'manager') {
        const emp = await User.find({ role: { $in: ['employee', 'team_lead'] }, isDeleted: false }).select('_id');
        query.employee_id = { $in: [...emp.map(e => e._id), userId] };
    } else {
        const emp = await User.find({ isDeleted: false }).select('_id');
        query.employee_id = { $in: emp.map(e => e._id) };
    }

    const leaves = await Leave.find(query).populate('employee_id', 'firstName lastName').lean();
    return leaves.map(l => ({
        start_date: l.start_date,
        end_date: l.end_date,
        eventData: { title: `${l.employee_id.firstName} ${l.employee_id.lastName} - Leave`, type: 'leave' }
    }));
};

const getTasks = async (role, userId, startDate, endDate) => {
    let query = { deadline: { $gte: startDate, $lte: endDate, $exists: true, $ne: null } };
    if (role === 'employee' || role === 'team_lead') query.assignedTo = userId;
    
    const tasks = await Task.find(query).lean();
    return tasks.map(t => ({
        deadline: t.deadline,
        eventData: { title: `Deadline: ${t.title}`, type: 'deadline' }
    }));
};

const getYearlyEvents = async (req, res, next) => {
    try {
        const { role } = req.user;
        const { year = new Date().getFullYear() } = req.query;

        if (role !== 'hr' && role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const events = await Event.find({ is_yearly: true, year }).sort({ date: 1 });
        res.status(200).json({ success: true, data: events });
    } catch (error) {
        next(error);
    }
};

module.exports = { createEvent, getCalendarEvents, createYearlyEvents, getYearlyEvents };