import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Get all expenses with filters and pagination
router.get('/', async (req, res) => {
  try {
    const { search, program, type, status, page = '1', limit = '10' } = req.query;

    // Construire les filtres
    const where: any = {};

    // Filtre par recherche
    if (search) {
      where.OR = [
        { description: { contains: search as string, mode: 'insensitive' } },
        { program: { name: { contains: search as string, mode: 'insensitive' } } },
        { type: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    // Filtre par programme
    if (program && program !== 'tous') {
      where.program = { name: program as string };
    }

    // Filtre par type
    if (type && type !== 'tous') {
      where.type = type as string;
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    // Récupérer les dépenses avec pagination
    const [expenses, totalCount] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: {
          program: {
            select: {
              id: true,
              name: true
            }
          },
          reservation: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: {
          date: 'desc'
        },
        skip: (pageNum - 1) * limitNum,
        take: limitNum
      }),
      prisma.expense.count({ where })
    ]);

    // Calculer les statistiques
    const stats = await prisma.expense.aggregate({
      where,
      _sum: {
        amount: true
      },
      _count: {
        id: true
      }
    });

    // Statistiques par type
    const statsByType = await prisma.expense.groupBy({
      by: ['type'],
      where,
      _sum: {
        amount: true
      },
      _count: {
        id: true
      }
    });

    // Transformer les données pour le frontend
    const transformedExpenses = expenses.map(expense => ({
      id: expense.id,
      date: expense.date.toISOString().split('T')[0],
      programme: expense.program?.name || 'Autre',
      type: expense.type,
      description: expense.description,
      montant: expense.amount,
      statut: 'payé', // Pour l'instant, toutes les dépenses sont considérées comme payées
      reservation: expense.reservation ? {
        id: expense.reservation.id,
        nom: `${expense.reservation.firstName} ${expense.reservation.lastName}`
      } : null
    }));

    // Calculer les totaux par type
    const totalByType = {
      Vol: 0,
      'Hotel Madina': 0,
      'Hotel Makkah': 0,
      Visa: 0,
      Autre: 0
    };

    statsByType.forEach(stat => {
      if (stat.type === 'Vol') totalByType.Vol = stat._sum.amount || 0;
      else if (stat.type === 'Hotel Madina') totalByType['Hotel Madina'] = stat._sum.amount || 0;
      else if (stat.type === 'Hotel Makkah') totalByType['Hotel Makkah'] = stat._sum.amount || 0;
      else if (stat.type === 'Visa') totalByType.Visa = stat._sum.amount || 0;
      else totalByType.Autre += stat._sum.amount || 0;
    });

    const totalPages = Math.ceil(totalCount / limitNum);

    res.json({
      expenses: transformedExpenses,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      },
      stats: {
        total: stats._sum.amount || 0,
        count: stats._count.id || 0,
        byType: totalByType
      }
    });

  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ error: 'Error fetching expenses' });
  }
});

// Get expense statistics
router.get('/stats', async (req, res) => {
  try {
    const { search, program, type } = req.query;

    // Construire les filtres
    const where: any = {};

    if (search) {
      where.OR = [
        { description: { contains: search as string, mode: 'insensitive' } },
        { program: { name: { contains: search as string, mode: 'insensitive' } } },
        { type: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    if (program && program !== 'tous') {
      where.program = { name: program as string };
    }

    if (type && type !== 'tous') {
      where.type = type as string;
    }

    // Statistiques générales
    const totalStats = await prisma.expense.aggregate({
      where,
      _sum: {
        amount: true
      },
      _count: {
        id: true
      }
    });

    // Statistiques par type
    const statsByType = await prisma.expense.groupBy({
      by: ['type'],
      where,
      _sum: {
        amount: true
      },
      _count: {
        id: true
      }
    });

    // Calculer les totaux par type
    const totalByType = {
      Vol: 0,
      'Hotel Madina': 0,
      'Hotel Makkah': 0,
      Visa: 0,
      Autre: 0
    };

    statsByType.forEach(stat => {
      if (stat.type === 'Vol') totalByType.Vol = stat._sum.amount || 0;
      else if (stat.type === 'Hotel Madina') totalByType['Hotel Madina'] = stat._sum.amount || 0;
      else if (stat.type === 'Hotel Makkah') totalByType['Hotel Makkah'] = stat._sum.amount || 0;
      else if (stat.type === 'Visa') totalByType.Visa = stat._sum.amount || 0;
      else totalByType.Autre += stat._sum.amount || 0;
    });

    res.json({
      total: {
        amount: totalStats._sum.amount || 0,
        count: totalStats._count.id || 0
      },
      byType: totalByType
    });

  } catch (error) {
    console.error('Error fetching expense stats:', error);
    res.status(500).json({ error: 'Error fetching expense statistics' });
  }
});

// Get single expense
router.get('/:id', async (req, res) => {
  try {
    const expense = await prisma.expense.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    res.json(expense);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching expense' });
  }
});

// Create new expense
router.post('/', async (req, res) => {
  try {
    console.log('POST /api/expenses - body:', req.body);
    const { description, amount, date, type, fichierId, programId, reservationId } = req.body;
    const prismaData = {
      description,
      amount: parseFloat(amount),
      date: new Date(date),
      type,
      fichierId: fichierId ? Number(fichierId) : undefined,
      programId: programId ? Number(programId) : undefined,
      reservationId: reservationId ? Number(reservationId) : undefined,
    };
    console.log('Data envoyée à Prisma:', prismaData);
    const expense = await prisma.expense.create({ data: prismaData });
    console.log('Expense créée:', expense);
    res.status(201).json(expense);
  } catch (error) {
    console.error('Erreur création expense:', error);
    res.status(500).json({ error: 'Error creating expense' });
  }
});

// Update expense
router.put('/:id', async (req, res) => {
  try {
    const { description, amount, date, type, fichierId, programId, reservationId } = req.body;

    const expense = await prisma.expense.update({
      where: { id: parseInt(req.params.id) },
      data: {
        description,
        amount: parseFloat(amount),
        date: new Date(date),
        type,
        fichierId: fichierId ? Number(fichierId) : undefined,
        programId: programId ? Number(programId) : undefined,
        reservationId: reservationId ? Number(reservationId) : undefined,
      },
    });

    res.json(expense);
  } catch (error) {
    res.status(500).json({ error: 'Error updating expense' });
  }
});

// Delete expense
router.delete('/:id', async (req, res) => {
  try {
    await prisma.expense.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Error deleting expense' });
  }
});

export default router; 