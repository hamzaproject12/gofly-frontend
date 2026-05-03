import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Créer un paiement
router.post('/', async (req, res) => {
  console.log('POST /api/payments appelé');
  console.log('Body reçu:', req.body);
  try {
    const {
      amount,
      type,
      reservationId,
      fichierId,
      programId: programIdRaw,
      paymentDate: paymentDateRaw,
      description: descriptionRaw,
    } = req.body;

    if (amount === undefined || amount === null || !type) {
      return res.status(400).json({ error: 'amount et type (mode de paiement) sont requis' });
    }

    const amountNum = parseFloat(amount);
    if (Number.isNaN(amountNum)) {
      return res.status(400).json({ error: 'Montant invalide' });
    }

    const description =
      typeof descriptionRaw === 'string' && descriptionRaw.trim() ? descriptionRaw.trim() : null;

    let reservationIdNum: number | null =
      reservationId !== undefined && reservationId !== null && reservationId !== ''
        ? parseInt(String(reservationId), 10)
        : null;
    if (reservationIdNum !== null && Number.isNaN(reservationIdNum)) {
      return res.status(400).json({ error: 'reservationId invalide' });
    }

    const programIdParsed =
      programIdRaw !== undefined && programIdRaw !== null && programIdRaw !== '' && programIdRaw !== 'none'
        ? parseInt(String(programIdRaw), 10)
        : null;
    if (programIdParsed !== null && Number.isNaN(programIdParsed)) {
      return res.status(400).json({ error: 'programId invalide' });
    }

    let reservation: {
      programId: number;
      agentId: number | null;
      parentId: number | null;
    } | null = null;

    if (reservationIdNum !== null) {
      reservation = await prisma.reservation.findUnique({
        where: { id: reservationIdNum },
        select: { programId: true, agentId: true, parentId: true },
      });
      if (!reservation) {
        return res.status(404).json({ error: 'Réservation introuvable' });
      }
    }

    /** Sans dossier : date du jour à l’enregistrement (sauf si l’appel fournit encore paymentDate, ex. écrans réservation) */
    let paymentDate = new Date();
    if (paymentDateRaw) {
      const d = new Date(paymentDateRaw);
      if (!Number.isNaN(d.getTime())) paymentDate = d;
    }

    const resolvedProgramId = reservation
      ? programIdParsed !== null
        ? programIdParsed
        : reservation.programId
      : programIdParsed;

    const payment = await prisma.payment.create({
      data: {
        amount: amountNum,
        paymentMethod: type,
        paymentDate,
        description,
        reservationId: reservationIdNum,
        programId: resolvedProgramId,
        ...(fichierId ? { fichierId: parseInt(String(fichierId), 10) } : {}),
        ...(reservation?.agentId ? { agentId: reservation.agentId } : {}),
      },
    });
    console.log('Paiement inséré en base:', payment);

    // Aligner paidAmount du dossier leader avec la somme des paiements
    if (reservationIdNum !== null && reservation && !reservation.parentId) {
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
    if (fichierId && reservationIdNum !== null) {
      const deleted = await prisma.payment.deleteMany({
        where: {
          reservationId: reservationIdNum,
          amount: amountNum,
          paymentMethod: type,
          fichierId: null,
        },
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
        program: { select: { id: true, name: true } },
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