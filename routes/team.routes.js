const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const teamController = require('../controllers/team.controller');

// Get all teams
router.get('/myteam', authenticate, teamController.getMyTeam);

router.get('/:id', authenticate, teamController.getTeamById);

router.get('/', authenticate, teamController.getTeams);

router.post('/', authenticate, authorize('admin'), teamController.createTeam);

router.put('/:id', authenticate, authorize('admin'), teamController.updateTeam);

router.delete('/:id', authenticate, authorize('admin'), teamController.deleteTeam);

module.exports = router;