const Team = require('../models/Team');
const User = require('../models/user');

exports.createTeam = async (req, res, next) => {
    try {
        const { name, description, teamLead, members, project, assignedManager } = req.body;
        const { role, id: userId } = req.user;

        if (role !== 'admin') {
            return res.status(403).json({ message: 'Only admin can create teams' });
        }

        const leadUser = await User.findOne({ username: teamLead.toUpperCase() });
        if (!leadUser) return res.status(404).json({ message: `Team lead ${teamLead} not found` });

        const memberUsers = await User.find({
            username: { $in: members.map(m => m.toUpperCase()) }
        });

        if (memberUsers.length !== members.length) {
            return res.status(404).json({ message: 'One or more members not found' });
        }

        let managerUser;

        if (assignedManager) {
            managerUser = await User.findOne({
                username: assignedManager.toUpperCase(),
                role: 'manager'
            });

            if (!managerUser) {
                return res.status(404).json({ message: `Manager ${assignedManager} not found` });
            }
        } else {
            managerUser = await User.findOne({ role: 'manager', isDeleted: false });

            if (!managerUser) {
                return res.status(400).json({
                    message: 'No manager available. Please specify assignedManager.'
                });
            }
        }

        const team = await Team.create({
            name,
            description,
            project,
            teamLead: leadUser._id,
            members: memberUsers.map(m => m._id),
            manager: managerUser._id
        });

        await User.updateMany(
            { _id: { $in: [...memberUsers.map(m => m._id), leadUser._id] } },
            { $addToSet: { teams: team._id } }
        );

        const populatedTeam = await Team.findById(team._id)
            .populate("teamLead", "username role firstName lastName")
            .populate("members", "username role firstName lastName")
            .populate("manager", "username role firstName lastName")
            .populate("project", "projectName");

        res.status(201).json(populatedTeam);

    } catch (error) {
        next(error);
    }
};

exports.getTeams = async (req, res, next) => {
    try {

        const teams = await Team.find({ isActive: true })
            .populate("teamLead", "username role firstName lastName")
            .populate("members", "username role firstName lastName")
            .populate("manager", "username role firstName lastName")
            .populate("project", "name");

        res.json(teams);

    } catch (error) {
        next(error);
    }
};

exports.getMyTeam = async (req, res, next) => {
    try {

        const user = await User.findById(req.user.id);
        const role = req.user.role.toLowerCase();

        if (role === 'admin' || role === 'hr') {
            return res.json({
                message: `${role.toUpperCase()} does not belong to any team`,
                teams: []
            });
        }

        let query = { isActive: true };

        if (role === 'manager') query.manager = user._id;
        else if (role === 'team_lead') query.teamLead = user._id;
        else query.members = user._id;

        const teams = await Team.find(query)
            .populate("teamLead", "username role firstName lastName")
            .populate("members", "username role firstName lastName")
            .populate("manager", "username role firstName lastName")
            .populate("project", "name");

        res.json({ teams });

    } catch (error) {
        next(error);
    }
};

exports.getTeamById = async (req, res, next) => {
    try {

        const team = await Team.findById(req.params.id)
            .populate("teamLead", "username role firstName lastName")
            .populate("members", "username role firstName lastName")
            .populate("manager", "username role firstName lastName")
            .populate("project", "name");

        if (!team) return res.status(404).json({ message: 'Team not found' });

        const user = await User.findById(req.user.id);
        const role = req.user.role.toLowerCase();

        const canAccess =
            role === 'admin' ||
            role === 'hr' ||
            team.manager._id.toString() === user._id.toString() ||
            team.teamLead._id.toString() === user._id.toString() ||
            team.members.some(m => m._id.toString() === user._id.toString());

        if (!canAccess) {
            return res.status(403).json({ message: 'Access denied' });
        }

        res.json(team);

    } catch (error) {
        next(error);
    }
};

exports.updateTeam = async (req, res, next) => {
    try {

        const { name, description, teamLead, members } = req.body;
        const { role, id: userId } = req.user;

        const team = await Team.findById(req.params.id);
        if (!team) return res.status(404).json({ message: 'Team not found' });

        const currentUser = await User.findById(userId);

        if (role !== 'admin' && team.manager.toString() !== currentUser._id.toString()) {
            return res.status(403).json({ message: 'Only team manager or admin can update' });
        }

        if (teamLead) {
            const leadUser = await User.findOne({ username: teamLead.toUpperCase() });
            if (!leadUser) return res.status(404).json({ message: `Team lead ${teamLead} not found` });

            team.teamLead = leadUser._id;
        }

        if (members) {
            const memberUsers = await User.find({
                username: { $in: members.map(m => m.toUpperCase()) }
            });

            if (memberUsers.length !== members.length) {
                return res.status(404).json({ message: 'One or more members not found' });
            }

            team.members = memberUsers.map(m => m._id);
        }

        if (name) team.name = name;
        if (description) team.description = description;

        await team.save();

        res.json(team);

    } catch (error) {
        next(error);
    }
};

exports.deleteTeam = async (req, res, next) => {
    try {

        const { role, id: userId } = req.user;
        const team = await Team.findById(req.params.id);

        if (!team) return res.status(404).json({ message: 'Team not found' });

        const currentUser = await User.findById(userId);

        if (role !== 'admin' && team.manager.toString() !== currentUser._id.toString()) {
            return res.status(403).json({ message: 'Only team manager or admin can delete' });
        }

        await User.updateMany(
            { _id: { $in: [...team.members, team.teamLead] } },
            { $pull: { teams: team._id } }
        );

        await Team.findByIdAndDelete(req.params.id);

        res.json({
            message: 'Team deleted successfully',
            deletedTeam: team
        });

    } catch (error) {
        next(error);
    }
};