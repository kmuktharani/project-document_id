const Project = require('../models/Project');
const User = require('../models/user');
const Team = require('../models/Team');

const createProject = async (req, res, next) => {
    try {
        const { role } = req.user;
        
        if (role !== 'admin' && role !== 'hr') {
            return res.status(403).json({ success: false, message: 'Only Admin and HR can create projects' });
        }

        const { projectId, projectName, description, startDate, endDate, assignedManager, teams } = req.body;

        // Validate assigned manager exists and is a manager
        const manager = await User.findOne({ username: assignedManager, role: 'manager', isDeleted: false });
        if (!manager) {
            return res.status(400).json({ success: false, message: 'Invalid manager assigned' });
        }

        // Validate teams exist
        if (teams && teams.length > 0) {
            const validTeams = await Team.find({ _id: { $in: teams }, isActive: true });
            if (validTeams.length !== teams.length) {
                return res.status(400).json({ success: false, message: 'One or more teams are invalid' });
            }
        }

        const project = await Project.create({
            projectId,
            projectName,
            description,
            startDate,
            endDate,
            assignedManager,
            teams: teams || []
        });

        const populatedProject = await Project.findById(project._id).populate('teams');
        
        res.status(201).json({ 
            success: true, 
            message: 'Project created successfully', 
            data: populatedProject 
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Project ID already exists' });
        }
        next(error);
    }
};

const getAllProjects = async (req, res, next) => {
    try {
        const { role } = req.user;
        
        if (role !== 'admin' && role !== 'hr') {
            return res.status(403).json({ success: false, message: 'Only Admin and HR can view all projects' });
        }

        const projects = await Project.find().populate('teams').sort({ createdAt: -1 });
        
        res.status(200).json({ 
            success: true, 
            data: projects,
            count: projects.length 
        });
    } catch (error) {
        next(error);
    }
};

const getProjectById = async (req, res, next) => {
    try {
        const { role } = req.user;
        const { id } = req.params;
        
        if (role !== 'admin' && role !== 'hr') {
            return res.status(403).json({ success: false, message: 'Only Admin and HR can view project details' });
        }

        const project = await Project.findById(id).populate('teams');
        
        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found' });
        }

        res.status(200).json({ success: true, data: project });
    } catch (error) {
        next(error);
    }
};

const updateProject = async (req, res, next) => {
    try {
        const { role } = req.user;
        const { id } = req.params;
        
        if (role !== 'admin' && role !== 'hr') {
            return res.status(403).json({ success: false, message: 'Only Admin and HR can edit projects' });
        }

        const { projectName, description, startDate, endDate, assignedManager, teams } = req.body;

        // Validate assigned manager if provided
        if (assignedManager) {
            const manager = await User.findOne({ username: assignedManager, role: 'manager', isDeleted: false });
            if (!manager) {
                return res.status(400).json({ success: false, message: 'Invalid manager assigned' });
            }
        }

        // Validate teams if provided
        if (teams && teams.length > 0) {
            const validTeams = await Team.find({ _id: { $in: teams }, isActive: true });
            if (validTeams.length !== teams.length) {
                return res.status(400).json({ success: false, message: 'One or more teams are invalid' });
            }
        }

        const project = await Project.findByIdAndUpdate(
            id,
            { projectName, description, startDate, endDate, assignedManager, teams },
            { new: true, runValidators: true }
        ).populate('teams');

        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found' });
        }

        res.status(200).json({ 
            success: true, 
            message: 'Project updated successfully', 
            data: project 
        });
    } catch (error) {
        next(error);
    }
};

const pauseProject = async (req, res, next) => {
    try {
        const { role } = req.user;
        const { id } = req.params;
        
        if (role !== 'admin' && role !== 'hr') {
            return res.status(403).json({ success: false, message: 'Only Admin and HR can pause projects' });
        }

        const project = await Project.findByIdAndUpdate(
            id,
            { status: 'paused' },
            { new: true }
        ).populate('teams');

        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found' });
        }

        res.status(200).json({ 
            success: true, 
            message: 'Project paused successfully', 
            data: project 
        });
    } catch (error) {
        next(error);
    }
};

const closeProject = async (req, res, next) => {
    try {
        const { role } = req.user;
        const { id } = req.params;
        
        if (role !== 'admin' && role !== 'hr') {
            return res.status(403).json({ success: false, message: 'Only Admin and HR can close projects' });
        }

        const project = await Project.findByIdAndUpdate(
            id,
            { status: 'completed' },
            { new: true }
        ).populate('teams');

        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found' });
        }

        res.status(200).json({ 
            success: true, 
            message: 'Project closed successfully', 
            data: project 
        });
    } catch (error) {
        next(error);
    }
};

const deleteProject = async (req, res, next) => {
    try {
        const { role } = req.user;
        const { id } = req.params;
        
        if (role !== 'admin' && role !== 'hr') {
            return res.status(403).json({ success: false, message: 'Only Admin and HR can delete projects' });
        }

        const project = await Project.findByIdAndDelete(id);

        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found' });
        }

        res.status(200).json({ 
            success: true, 
            message: 'Project deleted successfully' 
        });
    } catch (error) {
        next(error);
    }
};

const getProjectStats = async (req, res, next) => {
    try {
        const { role } = req.user;
        
        if (role !== 'admin' && role !== 'hr') {
            return res.status(403).json({ success: false, message: 'Only Admin and HR can view project statistics' });
        }

        const stats = await Project.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        const totalProjects = await Project.countDocuments();
        
        const formattedStats = {
            total: totalProjects,
            active: stats.find(s => s._id === 'active')?.count || 0,
            paused: stats.find(s => s._id === 'paused')?.count || 0,
            closed: stats.find(s => s._id === 'completed')?.count || 0
        };

        res.status(200).json({ 
            success: true, 
            data: formattedStats 
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createProject,
    getAllProjects,
    getProjectById,
    updateProject,
    pauseProject,
    closeProject,
    deleteProject,
    getProjectStats
};