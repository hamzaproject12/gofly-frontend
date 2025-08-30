import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Créer un paiement
router.post('/', async (req, res) => {
  console.log('POST /api/payments appelé');
  console.log('Body reçu:', req.body);
  try {
    const { amount, type, reservationId, fichierId, programId } = req.body;
    if (!amount || !type || !reservationId) {
      return res.status(400).json({ error: 'amount, type, reservationId sont requis' });
    }
    const payment = await prisma.payment.create({
      data: {
        amount: parseFloat(amount),
        paymentMethod: type,
        reservationId: parseInt(reservationId),
        ...(fichierId ? { fichierId: parseInt(fichierId) } : {}),
        ...(programId ? { programId: parseInt(programId) } : {})
      }
    });
    console.log('Paiement inséré en base:', payment);

    // Supprimer les doublons sans fichierId pour ce paiement (si un reçu vient d'être ajouté)
    if (fichierId) {
      const deleted = await prisma.payment.deleteMany({
        where: {
          reservationId: parseInt(reservationId),
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
      include: {
        fichier: true,
        reservation: true
      }
    });
    res.json(payments);
  } catch (error) {
    console.error('Erreur lors de la récupération des paiements:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des paiements' });
  }
});

export default router; 