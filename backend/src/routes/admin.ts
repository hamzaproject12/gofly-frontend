import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { 
  requireAdmin, 
  getAllAgents, 
  createAgent, 
  updateAgent, 
  deleteAgent 
} from '../controllers/authController';

const router = Router();

// All routes require authentication first, then admin privileges
router.use(authenticateToken);
router.use(requireAdmin);

// Get all agents
router.get('/agents', getAllAgents);

// Create new agent
router.post('/agents', createAgent);

// Update agent
router.put('/agents/:id', updateAgent);

// Delete agent (soft delete)
router.delete('/agents/:id', deleteAgent);

export default router;
