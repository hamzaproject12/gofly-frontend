import { Router } from 'express';
import { 
  requireAdmin, 
  getAllAgents, 
  createAgent, 
  updateAgent, 
  deleteAgent 
} from '../controllers/authController';

const router = Router();

// All routes require admin privileges
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
