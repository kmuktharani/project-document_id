const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const {
    createProject,
    getAllProjects,
    getProjectById,
    updateProject,
    pauseProject,
    closeProject,
    deleteProject,
    getProjectStats
} = require('../controllers/projectController');

const router = express.Router();

// Create project
router.post('/create', authenticate, createProject);

// Get all projects
router.get('/all', authenticate, getAllProjects);

// Get project statistics
router.get('/stats', authenticate, getProjectStats);

// Get project by ID
router.get('/:id', authenticate, getProjectById);

// Update project
router.put('/update/:id', authenticate, updateProject);

// Pause project
router.patch('/:id/pause', authenticate, pauseProject);

// Close project
router.patch('/:id/close', authenticate, closeProject);

// Delete project
router.delete('/delete/:id', authenticate, deleteProject);

module.exports = router;