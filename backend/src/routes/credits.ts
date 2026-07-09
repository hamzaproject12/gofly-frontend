import express from 'express';
import { PrismaClient, Role } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { ensureWallet } from '../services/creditService';

const router = express.Router();
const prisma = new PrismaClient();

interface AuthRequest extends express.Request {
  user?: any;
}

// Toutes les routes crédits exigent une session authentifiée
router.use(authenticateToken);

/**
 * Vérification de rôle en base (même modèle que requireAdmin) : le rôle du
 * token ne suffit pas, on relit l'agent pour tenir compte des désactivations.
 */
const requireRoles =
  (...roles: Role[]) =>
  async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    try {
      const agentId = req.user?.agentId;
      if (!agentId) {
        return res.status(401).json({ error: 'Non authentifié' });
      }
      const agent = await prisma.agent.findUnique({
        where: { id: agentId },
        select: { role: true, isActive: true },
      });
      if (!agent || !agent.isActive || !roles.includes(agent.role)) {
        return res.status(403).json({ error: 'Accès refusé. Droits insuffisants.' });
      }
      next();
    } catch (error) {
      console.error('Erreur vérification rôle crédits:', error);
      res.status(500).json({ error: 'Erreur de vérification des droits' });
    }
  };

/** Libellé de l'auteur pour les lignes du ledger (email > nom > id). */
function actorLabel(req: AuthRequest): string {
  const u = req.user || {};
  return (
    u.email || u.nom || (u.agentId != null ? `agent id=${u.agentId}` : 'inconnu')
  );
}

// GET /api/credits/balance — tout utilisateur authentifié (compteur du header)
router.get('/balance', async (_req, res) => {
  try {
    const wallet = await ensureWallet(prisma);
    res.json({ balance: wallet.balance });
  } catch (error) {
    console.error('Erreur lecture solde crédits:', error);
    res.status(500).json({ error: 'Erreur lors de la lecture du solde de crédits' });
  }
});

// GET /api/credits/ledger — ADMIN et SUPER_ADMIN, paginé, plus récent en premier
router.get('/ledger', requireRoles('ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 25));
    const skip = (page - 1) * limit;

    const wallet = await ensureWallet(prisma);
    const [items, total] = await Promise.all([
      prisma.creditLedger.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.creditLedger.count({ where: { walletId: wallet.id } }),
    ]);

    res.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      balance: wallet.balance,
    });
  } catch (error) {
    console.error('Erreur lecture ledger crédits:', error);
    res.status(500).json({ error: "Erreur lors du chargement de l'historique des crédits" });
  }
});

// POST /api/credits/recharge — SUPER_ADMIN uniquement (paiement reçu hors ligne)
router.post('/recharge', requireRoles('SUPER_ADMIN'), async (req: AuthRequest, res) => {
  try {
    const { amount, packLabel, paymentRef, note } = req.body;
    const n = Number(amount);
    if (!Number.isInteger(n) || n <= 0) {
      return res.status(400).json({ error: 'Montant invalide : entier strictement positif requis.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const wallet = await ensureWallet(tx);
      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: n } },
      });
      const line = await tx.creditLedger.create({
        data: {
          walletId: wallet.id,
          type: 'ACHAT_PACK',
          amount: n,
          balanceAfter: updated.balance,
          packLabel: typeof packLabel === 'string' && packLabel.trim() ? packLabel.trim() : null,
          paymentRef: typeof paymentRef === 'string' && paymentRef.trim() ? paymentRef.trim() : null,
          note: typeof note === 'string' && note.trim() ? note.trim() : null,
          createdBy: actorLabel(req),
        },
      });
      return { balance: updated.balance, line };
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Erreur recharge crédits:', error);
    res.status(500).json({ error: 'Erreur lors de la recharge de crédits' });
  }
});

// POST /api/credits/ajustement — SUPER_ADMIN uniquement, note obligatoire,
// un ajustement négatif ne peut pas rendre le solde négatif.
router.post('/ajustement', requireRoles('SUPER_ADMIN'), async (req: AuthRequest, res) => {
  try {
    const { amount, note } = req.body;
    const n = Number(amount);
    if (!Number.isInteger(n) || n === 0) {
      return res.status(400).json({ error: 'Montant invalide : entier non nul requis (positif ou négatif).' });
    }
    if (typeof note !== 'string' || !note.trim()) {
      return res.status(400).json({ error: 'La note est obligatoire pour un ajustement.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const wallet = await ensureWallet(tx);
      if (n < 0) {
        // Décrément conditionnel : refuse si le solde deviendrait négatif
        const updated = await tx.wallet.updateMany({
          where: { id: wallet.id, balance: { gte: -n } },
          data: { balance: { decrement: -n } },
        });
        if (updated.count === 0) {
          return { rejected: true as const, balance: wallet.balance };
        }
      } else {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: n } },
        });
      }
      const after = await tx.wallet.findUnique({ where: { id: wallet.id } });
      const balanceAfter = after?.balance ?? wallet.balance + n;
      const line = await tx.creditLedger.create({
        data: {
          walletId: wallet.id,
          type: 'AJUSTEMENT',
          amount: n,
          balanceAfter,
          note: note.trim(),
          createdBy: actorLabel(req),
        },
      });
      return { rejected: false as const, balance: balanceAfter, line };
    });

    if (result.rejected) {
      return res.status(409).json({
        error: `Ajustement refusé : le solde (${result.balance}) deviendrait négatif.`,
        solde: result.balance,
      });
    }

    res.status(201).json({ balance: result.balance, line: result.line });
  } catch (error) {
    console.error('Erreur ajustement crédits:', error);
    res.status(500).json({ error: "Erreur lors de l'ajustement de crédits" });
  }
});

export default router;
