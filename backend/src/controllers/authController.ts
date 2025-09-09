import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: any;
}

// Register new agent
export const register = async (req: Request, res: Response) => {
  try {
    const { nom, email, motDePasse } = req.body;

    // Validation
    if (!nom || !email || !motDePasse) {
      return res.status(400).json({ 
        error: 'Tous les champs sont requis' 
      });
    }

    // Check if agent already exists
    const existingAgent = await prisma.agent.findUnique({
      where: { email }
    });

    if (existingAgent) {
      return res.status(400).json({ 
        error: 'Un agent avec cet email existe déjà' 
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(motDePasse, saltRounds);

    // Create agent
    const agent = await prisma.agent.create({
      data: {
        nom,
        email,
        motDePasse: hashedPassword,
        isActive: true
      },
      select: {
        id: true,
        nom: true,
        email: true,
        isActive: true,
        createdAt: true
      }
    });

    // Generate JWT token
    const token = jwt.sign(
      { 
        agentId: agent.id, 
        email: agent.email,
        nom: agent.nom 
      },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as SignOptions
    );

    // Set secure cookie
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(201).json({
      message: 'Agent créé avec succès',
      agent,
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la création de l\'agent' 
    });
  }
};

// Login agent
export const login = async (req: Request, res: Response) => {
  try {
    const { email, motDePasse } = req.body;

    // Validation
    if (!email || !motDePasse) {
      return res.status(400).json({ 
        error: 'Email et mot de passe requis' 
      });
    }

    // Find agent
    const agent = await prisma.agent.findUnique({
      where: { email }
    });

    if (!agent) {
      return res.status(401).json({ 
        error: 'Email ou mot de passe incorrect' 
      });
    }

    // Check if agent is active
    if (!agent.isActive) {
      return res.status(403).json({ 
        error: 'Compte désactivé. Contactez l\'administrateur.' 
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(motDePasse, agent.motDePasse);
    
    if (!isValidPassword) {
      return res.status(401).json({ 
        error: 'Email ou mot de passe incorrect' 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        agentId: agent.id, 
        email: agent.email,
        nom: agent.nom 
      },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as SignOptions
    );

    // Set secure cookie
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      message: 'Connexion réussie',
      agent: {
        id: agent.id,
        nom: agent.nom,
        email: agent.email,
        isActive: agent.isActive,
        createdAt: agent.createdAt
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la connexion' 
    });
  }
};

// Logout agent
export const logout = async (req: Request, res: Response) => {
  try {
    // Clear cookie
    res.clearCookie('authToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    res.json({ message: 'Déconnexion réussie' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la déconnexion' 
    });
  }
};

// Get current agent profile
export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const agentId = req.user?.agentId;

    if (!agentId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        nom: true,
        email: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent non trouvé' });
    }

    res.json({ agent });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération du profil' 
    });
  }
};

// Update agent profile
export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const agentId = req.user?.agentId;
    const { nom, email } = req.body;

    if (!agentId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    // Check if email is already taken by another agent
    if (email) {
      const existingAgent = await prisma.agent.findFirst({
        where: { 
          email,
          id: { not: agentId }
        }
      });

      if (existingAgent) {
        return res.status(400).json({ 
          error: 'Cet email est déjà utilisé par un autre agent' 
        });
      }
    }

    const updatedAgent = await prisma.agent.update({
      where: { id: agentId },
      data: {
        ...(nom && { nom }),
        ...(email && { email })
      },
      select: {
        id: true,
        nom: true,
        email: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json({
      message: 'Profil mis à jour avec succès',
      agent: updatedAgent
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la mise à jour du profil' 
    });
  }
};

// Change password
export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    const agentId = req.user?.agentId;
    const { currentPassword, newPassword } = req.body;

    if (!agentId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        error: 'Mot de passe actuel et nouveau mot de passe requis' 
      });
    }

    // Get agent with password
    const agent = await prisma.agent.findUnique({
      where: { id: agentId }
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent non trouvé' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, agent.motDePasse);
    
    if (!isValidPassword) {
      return res.status(400).json({ 
        error: 'Mot de passe actuel incorrect' 
      });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await prisma.agent.update({
      where: { id: agentId },
      data: { motDePasse: hashedNewPassword }
    });

    res.json({ message: 'Mot de passe modifié avec succès' });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ 
      error: 'Erreur lors du changement de mot de passe' 
    });
  }
};
