import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  requireGestionUtilisateurs,
  getAllAgents,
  createAgent,
  updateAgent,
  deleteAgent
} from '../controllers/authController';

const router = Router();

// La gestion des comptes est réservée au GERANT (patron de l'agence) et au
// SUPER_ADMIN (fournisseur). Un ADMIN pilote l'exploitation mais ne peut ni
// créer un compte ni réinitialiser le mot de passe de qui que ce soit.
router.use(authenticateToken);
router.use(requireGestionUtilisateurs);

// Get all agents
router.get('/agents', getAllAgents);

// Create new agent
router.post('/agents', createAgent);

// Update agent
router.put('/agents/:id', updateAgent);

// Delete agent (suppression définitive)
router.delete('/agents/:id', deleteAgent);

export default router;
