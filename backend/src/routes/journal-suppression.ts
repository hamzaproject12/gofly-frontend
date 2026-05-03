import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { requireAdmin } from '../controllers/authController';

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticateToken);
router.use(requireAdmin);

router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 30));
    const action = typeof req.query.action === 'string' && req.query.action ? req.query.action : undefined;
    const entityType =
      typeof req.query.entityType === 'string' && req.query.entityType ? req.query.entityType : undefined;
    const skip = (page - 1) * limit;

    const where: { action?: string; entityType?: string } = {};
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;

    const [items, total] = await Promise.all([
      prisma.journalSuppression.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { actor: { select: { id: true, nom: true, email: true } } },
      }),
      prisma.journalSuppression.count({ where }),
    ]);

    res.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (e) {
    console.error('GET /journal-suppressions', e);
    res.status(500).json({ error: 'Erreur lors du chargement du journal' });
  }
});

export default router;
