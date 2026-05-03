import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { requireAdmin } from '../controllers/authController';

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticateToken);
router.use(requireAdmin);

/** Jour calendaire en UTC (YYYY-MM-DD) → [début, fin] pour filtrer les DateTime. */
function parseDayBoundsUTC(day: string): { start: Date; end: Date } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const [y, m, d] = day.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
  return { start, end };
}

router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 30));
    const action = typeof req.query.action === 'string' && req.query.action ? req.query.action : undefined;
    const entityType =
      typeof req.query.entityType === 'string' && req.query.entityType ? req.query.entityType : undefined;
    const dayParam = typeof req.query.day === 'string' && req.query.day ? req.query.day : undefined;
    const dayBounds = dayParam ? parseDayBoundsUTC(dayParam) : null;
    if (dayParam && !dayBounds) {
      return res.status(400).json({ error: 'Paramètre day invalide (attendu: YYYY-MM-DD)' });
    }

    const skip = (page - 1) * limit;

    const where: {
      action?: string;
      entityType?: string;
      createdAt?: { gte: Date; lte: Date };
    } = {};
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (dayBounds) {
      where.createdAt = { gte: dayBounds.start, lte: dayBounds.end };
    }

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

    let expensesOfDay: Awaited<ReturnType<typeof prisma.expense.findMany>> = [];
    let paymentsOfDay: Awaited<ReturnType<typeof prisma.payment.findMany>> = [];
    let expensesTotal = 0;
    let paymentsTotal = 0;

    if (dayBounds) {
      const [exps, pays, expAgg, payAgg] = await Promise.all([
        prisma.expense.findMany({
          where: { date: { gte: dayBounds.start, lte: dayBounds.end } },
          include: {
            program: { select: { id: true, name: true } },
            agent: { select: { id: true, nom: true } },
            reservation: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                agent: { select: { id: true, nom: true } },
              },
            },
          },
          orderBy: { date: 'desc' },
        }),
        prisma.payment.findMany({
          where: { paymentDate: { gte: dayBounds.start, lte: dayBounds.end } },
          include: {
            program: { select: { id: true, name: true } },
            reservation: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                program: { select: { id: true, name: true } },
                agent: { select: { id: true, nom: true } },
              },
            },
            agent: { select: { id: true, nom: true } },
          },
          orderBy: { paymentDate: 'desc' },
        }),
        prisma.expense.aggregate({
          where: { date: { gte: dayBounds.start, lte: dayBounds.end } },
          _sum: { amount: true },
        }),
        prisma.payment.aggregate({
          where: { paymentDate: { gte: dayBounds.start, lte: dayBounds.end } },
          _sum: { amount: true },
        }),
      ]);
      expensesOfDay = exps;
      paymentsOfDay = pays;
      expensesTotal = expAgg._sum.amount ?? 0;
      paymentsTotal = payAgg._sum.amount ?? 0;
    }

    res.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      day: dayBounds ? dayParam : null,
      expensesOfDay,
      paymentsOfDay,
      expensesTotal,
      paymentsTotal,
    });
  } catch (e) {
    console.error('GET /journal-suppressions', e);
    res.status(500).json({ error: 'Erreur lors du chargement du journal' });
  }
});

export default router;
