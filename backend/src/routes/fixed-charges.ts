import express from 'express';
import { PrismaClient, FixedChargeCategory } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { requireAdmin } from '../controllers/authController';
import { generateFixedChargesForYearMonth, formatYearMonth } from '../services/fixedChargeGenerator';

const router = express.Router();
const prisma = new PrismaClient();

const CATEGORIES = Object.values(FixedChargeCategory);

router.use(authenticateToken);
router.use(requireAdmin);

router.get('/', async (_req, res) => {
  try {
    const items = await prisma.fixedCharge.findMany({
      orderBy: [{ isActive: 'desc' }, { label: 'asc' }],
      include: {
        agent: { select: { id: true, nom: true, email: true } },
        _count: { select: { occurrences: true } },
      },
    });
    res.json({ fixedCharges: items });
  } catch (e) {
    console.error('GET /fixed-charges', e);
    res.status(500).json({ error: 'Erreur lors du chargement des charges fixes' });
  }
});

router.get('/occurrences', async (req, res) => {
  try {
    const yearMonth = (req.query.yearMonth as string) || formatYearMonth(new Date());
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
      return res.status(400).json({ error: 'yearMonth invalide (YYYY-MM)' });
    }
    const rows = await prisma.fixedChargeOccurrence.findMany({
      where: { yearMonth },
      include: {
        fixedCharge: {
          include: { agent: { select: { id: true, nom: true } } },
        },
        expense: { select: { id: true, date: true, description: true, amount: true, type: true } },
      },
      orderBy: { generatedAt: 'desc' },
    });
    res.json({ yearMonth, occurrences: rows });
  } catch (e) {
    console.error('GET /fixed-charges/occurrences', e);
    res.status(500).json({ error: 'Erreur lors du chargement des occurrences' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { label, amount, category, agentId, isActive } = req.body;
    if (!label || typeof label !== 'string' || label.trim().length === 0) {
      return res.status(400).json({ error: 'label requis' });
    }
    const num = parseFloat(amount);
    if (Number.isNaN(num) || num < 0) {
      return res.status(400).json({ error: 'amount invalide' });
    }
    if (!category || !CATEGORIES.includes(category)) {
      return res.status(400).json({ error: 'category invalide', allowed: CATEGORIES });
    }
    let agentIdNum: number | undefined;
    if (agentId != null && agentId !== '') {
      agentIdNum = Number(agentId);
      if (Number.isNaN(agentIdNum)) {
        return res.status(400).json({ error: 'agentId invalide' });
      }
      const agent = await prisma.agent.findUnique({ where: { id: agentIdNum } });
      if (!agent) {
        return res.status(400).json({ error: 'Agent introuvable' });
      }
    }

    const row = await prisma.fixedCharge.create({
      data: {
        label: label.trim(),
        amount: num,
        category: category as FixedChargeCategory,
        agentId: agentIdNum ?? null,
        isActive: isActive === false ? false : true,
      },
      include: {
        agent: { select: { id: true, nom: true, email: true } },
        _count: { select: { occurrences: true } },
      },
    });
    res.status(201).json(row);
  } catch (e) {
    console.error('POST /fixed-charges', e);
    res.status(500).json({ error: 'Erreur lors de la création' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'id invalide' });
    }
    const existing = await prisma.fixedCharge.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Charge fixe introuvable' });
    }

    const { label, amount, category, agentId, isActive } = req.body;
    const data: Record<string, unknown> = {};

    if (label !== undefined) {
      if (typeof label !== 'string' || label.trim().length === 0) {
        return res.status(400).json({ error: 'label invalide' });
      }
      data.label = label.trim();
    }
    if (amount !== undefined) {
      const num = parseFloat(amount);
      if (Number.isNaN(num) || num < 0) {
        return res.status(400).json({ error: 'amount invalide' });
      }
      data.amount = num;
    }
    if (category !== undefined) {
      if (!CATEGORIES.includes(category)) {
        return res.status(400).json({ error: 'category invalide', allowed: CATEGORIES });
      }
      data.category = category as FixedChargeCategory;
    }
    if (agentId !== undefined) {
      if (agentId === null || agentId === '') {
        data.agentId = null;
      } else {
        const agentIdNum = Number(agentId);
        if (Number.isNaN(agentIdNum)) {
          return res.status(400).json({ error: 'agentId invalide' });
        }
        const agent = await prisma.agent.findUnique({ where: { id: agentIdNum } });
        if (!agent) {
          return res.status(400).json({ error: 'Agent introuvable' });
        }
        data.agentId = agentIdNum;
      }
    }
    if (isActive !== undefined) {
      data.isActive = Boolean(isActive);
    }

    const row = await prisma.fixedCharge.update({
      where: { id },
      data,
      include: {
        agent: { select: { id: true, nom: true, email: true } },
        _count: { select: { occurrences: true } },
      },
    });
    res.json(row);
  } catch (e) {
    console.error('PUT /fixed-charges/:id', e);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'id invalide' });
    }
    const existing = await prisma.fixedCharge.findUnique({
      where: { id },
      include: { _count: { select: { occurrences: true } } },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Charge fixe introuvable' });
    }
    if (existing._count.occurrences > 0) {
      const row = await prisma.fixedCharge.update({
        where: { id },
        data: { isActive: false },
        include: {
          agent: { select: { id: true, nom: true, email: true } },
          _count: { select: { occurrences: true } },
        },
      });
      return res.json({
        message: 'Désactivée (des dépenses ont déjà été générées pour cette charge).',
        fixedCharge: row,
      });
    }
    await prisma.fixedCharge.delete({ where: { id } });
    res.json({ message: 'Supprimée' });
  } catch (e) {
    console.error('DELETE /fixed-charges/:id', e);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

router.post('/generate-month', async (req, res) => {
  try {
    const bodyYm = req.body?.yearMonth as string | undefined;
    const yearMonth = bodyYm && /^\d{4}-\d{2}$/.test(bodyYm) ? bodyYm : formatYearMonth(new Date());
    const result = await generateFixedChargesForYearMonth(prisma, yearMonth);
    res.json(result);
  } catch (e) {
    console.error('POST /fixed-charges/generate-month', e);
    const msg = e instanceof Error ? e.message : 'Erreur génération';
    res.status(500).json({ error: msg });
  }
});

export default router;
