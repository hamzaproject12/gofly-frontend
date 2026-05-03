import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Créer un paiement
router.post('/', async (req, res) => {
  console.log('POST /api/payments appelé');
  console.log('Body reçu:', req.body);
  try {
    const { amount, type, reservationId, fichierId, programId, paymentDate: paymentDateRaw } = req.body;
    if (!amount || !type || !reservationId) {
      return res.status(400).json({ error: 'amount, type, reservationId sont requis' });
    }
    const reservationIdNum = parseInt(reservationId, 10);
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationIdNum },
      select: { programId: true, agentId: true, parentId: true },
    });
    if (!reservation) {
      return res.status(404).json({ error: 'Réservation introuvable' });
    }

    let paymentDate: Date | undefined;
    if (paymentDateRaw) {
      const d = new Date(paymentDateRaw);
      if (!Number.isNaN(d.getTime())) paymentDate = d;
    }

    const payment = await prisma.payment.create({
      data: {
        amount: parseFloat(amount),
        paymentMethod: type,
        reservationId: reservationIdNum,
        ...(paymentDate ? { paymentDate } : {}),
        ...(fichierId ? { fichierId: parseInt(fichierId, 10) } : {}),
        programId: programId ? parseInt(programId, 10) : reservation.programId,
        ...(reservation.agentId ? { agentId: reservation.agentId } : {}),
      },
    });
    console.log('Paiement inséré en base:', payment);

    // Aligner paidAmount du dossier leader avec la somme des paiements
    if (!reservation.parentId) {
      const sumPay = await prisma.payment.aggregate({
        where: { reservationId: reservationIdNum },
        _sum: { amount: true },
      });
      await prisma.reservation.update({
        where: { id: reservationIdNum },
        data: { paidAmount: sumPay._sum.amount ?? 0 },
      });
    }

    // Supprimer les doublons sans fichierId pour ce paiement (si un reçu vient d'être ajouté)
    if (fichierId) {
      const deleted = await prisma.payment.deleteMany({
        where: {
          reservationId: reservationIdNum,
          amount: parseFloat(amount),
          paymentMethod: type,
          fichierId: null
        }
      });
      console.log('Paiements supprimés (doublons sans fichierId):', deleted);
    }

    res.status(201).json(payment);
  } catch (error) {
    console.error('Erreur lors de la création du paiement:', error);
    res.status(500).json({ error: 'Erreur lors de la création du paiement' });
  }
});

// Récupérer tous les paiements
router.get('/', async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      orderBy: { paymentDate: 'desc' },
      include: {
        fichier: true,
        agent: { select: { id: true, nom: true } },
        reservation: {
          include: {
            program: true,
            agent: { select: { id: true, nom: true } },
          },
        },
      },
    });
    res.json(payments);
  } catch (error) {
    console.error('Erreur lors de la récupération des paiements:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des paiements' });
  }
});

export default router; 