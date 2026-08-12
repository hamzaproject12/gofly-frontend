import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { PrismaClient, Role } from '@prisma/client';
import {
  RANG_ROLE,
  auMoins,
  peutAgirSur,
  peutAttribuerRole,
  peutVoir,
  rolesVisiblesPar,
} from '../services/roleService';
import {
  logJournalSuppression,
  buildAgentDeactivationDetail,
  buildAgentDeletionDetail,
  JOURNAL_ACTION,
} from '../services/journalSuppressionService';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: any;
}

// --- Règles communes aux comptes utilisateurs -------------------------------

/** Longueur minimale d'un mot de passe de compte agence. */
const MOT_DE_PASSE_MIN = 8;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * L'unicité de `Agent.email` est sensible à la casse côté PostgreSQL :
 * sans normalisation, « A@x.ma » et « a@x.ma » créent deux comptes distincts.
 */
const normaliserEmail = (email: string): string => email.trim().toLowerCase();

/** Renvoie un message d'erreur, ou null si l'email est exploitable. */
const validerEmail = (email: string): string | null =>
  EMAIL_REGEX.test(email) ? null : 'Adresse email invalide';

/** Renvoie un message d'erreur, ou null si le mot de passe est acceptable. */
const validerMotDePasse = (motDePasse: string): string | null =>
  motDePasse.length >= MOT_DE_PASSE_MIN
    ? null
    : `Le mot de passe doit contenir au moins ${MOT_DE_PASSE_MIN} caractères`;

/** Identifiant de route numérique et positif, sinon null. */
const parseEntityId = (raw: string): number | null => {
  const id = Number.parseInt(raw, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
};

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

    const nomPropre = String(nom).trim();
    if (!nomPropre) {
      return res.status(400).json({ error: 'Le nom est requis' });
    }

    const emailPropre = normaliserEmail(String(email));
    const erreurEmail = validerEmail(emailPropre);
    if (erreurEmail) {
      return res.status(400).json({ error: erreurEmail });
    }

    const erreurMotDePasse = validerMotDePasse(String(motDePasse));
    if (erreurMotDePasse) {
      return res.status(400).json({ error: erreurMotDePasse });
    }

    // Check if agent already exists
    const existingAgent = await prisma.agent.findUnique({
      where: { email: emailPropre }
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
        nom: nomPropre,
        email: emailPropre,
        motDePasse: hashedPassword,
        role: 'AGENT',
        isActive: true
      },
      select: {
        id: true,
        nom: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    });

    // Generate JWT token
    const token = jwt.sign(
      {
        agentId: agent.id,
        email: agent.email,
        nom: agent.nom,
        role: agent.role
      },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as SignOptions
    );

    // Set secure cookie
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' pour cross-origin en production
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

    // Find agent — l'email saisi est essayé tel quel (comptes historiques créés
    // avec une casse libre) puis en version normalisée (comptes récents).
    const emailSaisi = String(email).trim();
    const emailNormalise = normaliserEmail(emailSaisi);

    let agent = await prisma.agent.findUnique({
      where: { email: emailSaisi }
    });

    if (!agent && emailNormalise !== emailSaisi) {
      agent = await prisma.agent.findUnique({
        where: { email: emailNormalise }
      });
    }

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
        nom: agent.nom,
        role: agent.role
      },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as SignOptions
    );

    // Set secure cookie
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' pour cross-origin en production
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      message: 'Connexion réussie',
      agent: {
        id: agent.id,
        nom: agent.nom,
        email: agent.email,
        role: agent.role,
        isActive: agent.isActive,
        createdAt: agent.createdAt
      },
      token // Token accessible côté frontend
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
        role: true,
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

    const erreurMotDePasse = validerMotDePasse(String(newPassword));
    if (erreurMotDePasse) {
      return res.status(400).json({ error: erreurMotDePasse });
    }

    if (String(newPassword) === String(currentPassword)) {
      return res.status(400).json({
        error: 'Le nouveau mot de passe doit être différent de l\'actuel'
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

// ===== ADMIN FUNCTIONS =====

/**
 * Fabrique de middleware : exige un rôle d'au moins `minimum`, relu en base.
 *
 * Le rôle porté par le JWT ne suffit pas — il peut dater d'avant une
 * rétrogradation ou une désactivation. Le rôle relu est attaché à
 * `req.user.dbRole`, seule source de vérité pour les handlers.
 */
const requireRang = (minimum: Role) => async (req: AuthRequest, res: Response, next: any) => {
  try {
    const agentId = req.user?.agentId;

    if (!agentId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { role: true, isActive: true }
    });

    if (!agent || !agent.isActive || !auMoins(agent.role, minimum)) {
      return res.status(403).json({ error: 'Accès refusé. Droits insuffisants.' });
    }

    req.user.dbRole = agent.role;
    next();
  } catch (error) {
    console.error('Role check error:', error);
    res.status(500).json({ error: 'Erreur de vérification des droits' });
  }
};

/** Exploitation de l'agence : ADMIN, GERANT ou SUPER_ADMIN. */
export const requireAdmin = requireRang('ADMIN');

/** Alias historique de `requireAdmin` — même règle (rang ADMIN minimum). */
export const requireAdminOrSuperAdmin = requireAdmin;

/**
 * Gestion des comptes : réservée au GERANT (patron) et au SUPER_ADMIN.
 * Un ADMIN pilote l'exploitation mais ne touche jamais aux utilisateurs.
 */
export const requireGestionUtilisateurs = requireRang('GERANT');

/** Rôle de l'appelant relu en base par `requireRang`. */
const callerRole = (req: Request): Role =>
  ((req as AuthRequest).user?.dbRole as Role) ?? 'AGENT';


// Get all agents (Admin only)
export const getAllAgents = async (req: AuthRequest, res: Response) => {
  try {
    const agents = await prisma.agent.findMany({
      // On ne voit que les comptes de rang inférieur ou égal au sien : le
      // fournisseur (SUPER_ADMIN) reste invisible pour l'agence.
      where: { role: { in: rolesVisiblesPar(callerRole(req)) } },
      select: {
        id: true,
        nom: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ agents });
  } catch (error) {
    console.error('Get all agents error:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des agents' 
    });
  }
};

// Create new agent (Admin only)
export const createAgent = async (req: Request, res: Response) => {
  try {
    const { nom, email, motDePasse, role = 'AGENT' } = req.body;

    // Validation
    if (!nom || !email || !motDePasse) {
      return res.status(400).json({
        error: 'Nom, email et mot de passe sont requis'
      });
    }

    const nomPropre = String(nom).trim();
    if (!nomPropre) {
      return res.status(400).json({ error: 'Le nom est requis' });
    }

    const emailPropre = normaliserEmail(String(email));
    const erreurEmail = validerEmail(emailPropre);
    if (erreurEmail) {
      return res.status(400).json({ error: erreurEmail });
    }

    const erreurMotDePasse = validerMotDePasse(String(motDePasse));
    if (erreurMotDePasse) {
      return res.status(400).json({ error: erreurMotDePasse });
    }

    if (!(role in RANG_ROLE)) {
      return res.status(400).json({ error: 'Rôle invalide' });
    }

    // On n'attribue qu'un rôle de rang inférieur ou égal au sien : un gérant
    // peut nommer un autre gérant, jamais un super admin (fournisseur).
    if (!peutAttribuerRole(callerRole(req), role as Role)) {
      return res.status(403).json({
        error: 'Vous ne pouvez pas attribuer un rôle supérieur au vôtre'
      });
    }

    // Check if agent already exists
    const existingAgent = await prisma.agent.findUnique({
      where: { email: emailPropre }
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
        nom: nomPropre,
        email: emailPropre,
        motDePasse: hashedPassword,
        role: role as 'ADMIN' | 'AGENT' | 'SUPER_ADMIN',
        isActive: true
      },
      select: {
        id: true,
        nom: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    });

    res.status(201).json({
      message: 'Agent créé avec succès',
      agent
    });

  } catch (error) {
    console.error('Create agent error:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la création de l\'agent' 
    });
  }
};

// Update agent (Admin only)
export const updateAgent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { nom, email, motDePasse, role, isActive } = req.body;

    const agentId = parseEntityId(id);
    if (agentId === null) {
      return res.status(400).json({ error: 'Identifiant utilisateur invalide' });
    }

    if (role !== undefined && !(role in RANG_ROLE)) {
      return res.status(400).json({ error: 'Rôle invalide' });
    }

    // On n'attribue qu'un rôle de rang inférieur ou égal au sien
    if (role !== undefined && !peutAttribuerRole(callerRole(req), role as Role)) {
      return res.status(403).json({
        error: 'Vous ne pouvez pas attribuer un rôle supérieur au vôtre'
      });
    }

    // Check if agent exists
    const existingAgent = await prisma.agent.findUnique({
      where: { id: agentId }
    });

    if (!existingAgent) {
      return res.status(404).json({ error: 'Agent non trouvé' });
    }

    // Un compte invisible reste introuvable : ne pas révéler son existence
    if (!peutVoir(callerRole(req), existingAgent.role)) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    // On n'agit que sur un compte de rang strictement inférieur : deux gérants
    // sont pairs et ne peuvent ni se modifier ni se réinitialiser le mot de passe.
    if (!peutAgirSur(callerRole(req), existingAgent.role)) {
      return res.status(403).json({
        error: 'Vous ne pouvez pas modifier un compte de rang égal ou supérieur au vôtre'
      });
    }

    const desactivation = isActive === false && existingAgent.isActive;
    const changementDeRole = role !== undefined && role !== existingAgent.role;

    // On ne modifie ni son propre rôle ni son propre statut : sinon un compte
    // peut se retirer ses droits et perdre l'accès à l'administration.
    const callerId = (req as AuthRequest).user?.agentId;
    if (callerId === agentId && (desactivation || changementDeRole)) {
      return res.status(400).json({
        error: 'Vous ne pouvez pas modifier votre propre rôle ni désactiver votre propre compte'
      });
    }

    // Le dernier gérant actif ne peut être ni désactivé ni rétrogradé : plus
    // personne ne pourrait créer de compte ni réinitialiser un mot de passe.
    const perteDuDernierGerant =
      existingAgent.role === 'GERANT' &&
      existingAgent.isActive &&
      (desactivation || (changementDeRole && !auMoins(role as Role, 'GERANT')));

    if (perteDuDernierGerant) {
      const gerantCount = await prisma.agent.count({
        where: { role: 'GERANT', isActive: true }
      });

      if (gerantCount <= 1) {
        return res.status(400).json({
          error: desactivation
            ? 'Impossible de désactiver le dernier gérant actif'
            : 'Impossible de retirer le rôle du dernier gérant actif'
        });
      }
    }

    // Nom
    let nomPropre: string | undefined;
    if (nom !== undefined) {
      nomPropre = String(nom).trim();
      if (!nomPropre) {
        return res.status(400).json({ error: 'Le nom ne peut pas être vide' });
      }
    }

    // Email : normalisé puis vérifié comme à la création
    let emailPropre: string | undefined;
    if (email !== undefined && String(email).trim() !== '') {
      emailPropre = normaliserEmail(String(email));
      const erreurEmail = validerEmail(emailPropre);
      if (erreurEmail) {
        return res.status(400).json({ error: erreurEmail });
      }

      if (emailPropre !== existingAgent.email) {
        const emailTaken = await prisma.agent.findUnique({
          where: { email: emailPropre }
        });

        if (emailTaken) {
          return res.status(400).json({
            error: 'Cet email est déjà utilisé par un autre agent'
          });
        }
      }
    }

    // Mot de passe : facultatif, un champ vide signifie « ne pas changer »
    let motDePasseHash: string | undefined;
    if (motDePasse !== undefined && String(motDePasse) !== '') {
      const erreurMotDePasse = validerMotDePasse(String(motDePasse));
      if (erreurMotDePasse) {
        return res.status(400).json({ error: erreurMotDePasse });
      }
      motDePasseHash = await bcrypt.hash(String(motDePasse), 12);
    }

    // Update agent
    const updatedAgent = await prisma.agent.update({
      where: { id: agentId },
      data: {
        ...(nomPropre && { nom: nomPropre }),
        ...(emailPropre && { email: emailPropre }),
        ...(motDePasseHash && { motDePasse: motDePasseHash }),
        ...(role && { role: role as 'ADMIN' | 'AGENT' | 'SUPER_ADMIN' }),
        ...(isActive !== undefined && { isActive })
      },
      select: {
        id: true,
        nom: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Trace de désactivation (bouton « Désactiver ») : la suppression étant
    // devenue définitive, c'est ici que le passage actif → inactif est journalisé.
    if (existingAgent.isActive && updatedAgent.isActive === false) {
      const authUser = (req as AuthRequest).user as { agentId?: number; nom?: string; email?: string } | undefined;
      const actorLabel =
        [authUser?.nom, authUser?.email].filter(Boolean).join(' — ') ||
        (authUser?.agentId != null ? `agent id=${authUser.agentId}` : 'session inconnue');
      const { summary, detailText } = buildAgentDeactivationDetail(existingAgent, actorLabel);
      await logJournalSuppression(prisma, req, {
        action: JOURNAL_ACTION.AGENT_DEACTIVATED,
        entityType: 'Agent',
        entityId: existingAgent.id,
        summary,
        detailText,
        parDisplay: existingAgent.nom,
      });
    }

    res.json({
      message: 'Agent mis à jour avec succès',
      agent: updatedAgent
    });

  } catch (error) {
    console.error('Update agent error:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la mise à jour de l\'agent' 
    });
  }
};

// Delete agent (Admin only) — suppression DÉFINITIVE du compte.
// Les données métier (réservations, paiements, dépenses, charges fixes) sont
// conservées mais détachées de l'agent. Le journal garde une trace nominative.
export const deleteAgent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agentId = parseEntityId(id);

    if (agentId === null) {
      return res.status(400).json({ error: 'Identifiant utilisateur invalide' });
    }

    // Interdire l'auto-suppression : évite qu'un admin se déconnecte définitivement
    const callerId = (req as AuthRequest).user?.agentId;
    if (callerId === agentId) {
      return res.status(400).json({
        error: 'Vous ne pouvez pas supprimer votre propre compte'
      });
    }

    // Check if agent exists
    const existingAgent = await prisma.agent.findUnique({
      where: { id: agentId }
    });

    if (!existingAgent) {
      return res.status(404).json({ error: 'Agent non trouvé' });
    }

    // Un compte invisible reste introuvable : ne pas révéler son existence
    if (!peutVoir(callerRole(req), existingAgent.role)) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    // On ne supprime qu'un compte de rang strictement inférieur au sien
    if (!peutAgirSur(callerRole(req), existingAgent.role)) {
      return res.status(403).json({
        error: 'Vous ne pouvez pas supprimer un compte de rang égal ou supérieur au vôtre'
      });
    }

    // Ne jamais supprimer le dernier gérant actif : plus personne ne pourrait
    // créer de compte ni réinitialiser un mot de passe.
    if (existingAgent.role === 'GERANT' && existingAgent.isActive) {
      const gerantCount = await prisma.agent.count({
        where: {
          role: 'GERANT',
          isActive: true
        }
      });

      if (gerantCount <= 1) {
        return res.status(400).json({
          error: 'Impossible de supprimer le dernier gérant actif'
        });
      }
    }

    // Volumétrie liée, pour la trace du journal
    const [reservationCount, paymentCount, expenseCount, fixedChargeCount, journalCount] =
      await Promise.all([
        prisma.reservation.count({ where: { agentId } }),
        prisma.payment.count({ where: { agentId } }),
        prisma.expense.count({ where: { agentId } }),
        prisma.fixedCharge.count({ where: { agentId } }),
        prisma.journalSuppression.count({ where: { actorId: agentId } }),
      ]);

    // Détacher explicitement les références avant la suppression : Payment.agentId
    // est en onDelete: Restrict, la suppression échouerait sinon.
    await prisma.$transaction([
      prisma.payment.updateMany({ where: { agentId }, data: { agentId: null } }),
      prisma.expense.updateMany({ where: { agentId }, data: { agentId: null } }),
      prisma.reservation.updateMany({ where: { agentId }, data: { agentId: null } }),
      prisma.fixedCharge.updateMany({ where: { agentId }, data: { agentId: null } }),
      // Journal append-only : aucune ligne n'est supprimée, seul le lien technique
      // est vidé. Le nom de l'agent reste lisible via parDisplay / detailText.
      prisma.journalSuppression.updateMany({ where: { actorId: agentId }, data: { actorId: null } }),
      prisma.agent.delete({ where: { id: agentId } }),
    ]);

    const authUser = (req as AuthRequest).user as { agentId?: number; nom?: string; email?: string } | undefined;
    const actorLabel =
      [authUser?.nom, authUser?.email].filter(Boolean).join(' — ') ||
      (authUser?.agentId != null ? `agent id=${authUser.agentId}` : 'session inconnue');
    const { summary, detailText } = buildAgentDeletionDetail(existingAgent, actorLabel, {
      reservationCount,
      paymentCount,
      expenseCount,
      fixedChargeCount,
      journalCount,
    });
    await logJournalSuppression(prisma, req, {
      action: JOURNAL_ACTION.AGENT_DELETED,
      entityType: 'Agent',
      entityId: agentId,
      summary,
      detailText,
      parDisplay: existingAgent.nom,
    });

    res.json({ message: 'Utilisateur supprimé définitivement' });

  } catch (error) {
    console.error('Delete agent error:', error);
    res.status(500).json({
      error: 'Erreur lors de la suppression de l\'agent'
    });
  }
};
