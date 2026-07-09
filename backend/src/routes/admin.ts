import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  requireAdminOrSuperAdmin,
  getAllAgents,
  createAgent,
  updateAgent,
  deleteAgent
} from '../controllers/authController';

const router = Router();

// All routes require authentication first, then admin privileges
// (SUPER_ADMIN = fournisseur : accès complet, invisible pour les ADMIN)
router.use(authenticateToken);
router.use(requireAdminOrSuperAdmin);

// Get all agents
router.get('/agents', getAllAgents);

// Create new agent
router.post('/agents', createAgent);

// Update agent
router.put('/agents/:id', updateAgent);

// Delete agent (soft delete)
router.delete('/agents/:id', deleteAgent);

export default router;
