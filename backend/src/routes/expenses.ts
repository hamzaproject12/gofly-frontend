import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Get all expenses
router.get('/', async (req, res) => {
  try {
    const expenses = await prisma.expense.findMany();
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching expenses' });
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