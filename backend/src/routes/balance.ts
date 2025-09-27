import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Get balance data with filters
router.get('/', async (req, res) => {
  try {
    const { dateDebut, dateFin, programme, periode } = req.query;

    // Construire les filtres de date
    const dateFilter: any = {};
    if (dateDebut && dateFin) {
      dateFilter.gte = new Date(dateDebut as string);
      dateFilter.lte = new Date(dateFin as string);
    } else if (dateDebut) {
      dateFilter.gte = new Date(dateDebut as string);
    } else if (dateFin) {
      dateFilter.lte = new Date(dateFin as string);
    }

    // Récupérer les paiements avec filtres
    const paymentsWhere: any = {};
    if (Object.keys(dateFilter).length > 0) {
      paymentsWhere.paymentDate = dateFilter;
    }

    const payments = await prisma.payment.findMany({
      where: paymentsWhere,
      include: {
        reservation: {
          include: {
            program: true
          }
        }
      }
    });

    // Récupérer les dépenses avec filtres
    const expensesWhere: any = {};
    if (Object.keys(dateFilter).length > 0) {
      expensesWhere.date = dateFilter;
    }

    const expenses = await prisma.expense.findMany({
      where: expensesWhere,
      include: {
        program: true,
        reservation: true
      }
    });

    // Filtrer par programme si spécifié
    let filteredPayments = payments;
    let filteredExpenses = expenses;

    if (programme && programme !== 'tous') {
      filteredPayments = payments.filter(p => p.reservation.program.name === programme);
      filteredExpenses = expenses.filter(e => e.program?.name === programme);
    }

    // Calculer les statistiques globales
    const totalPaiements = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalDepenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const soldeFinal = totalPaiements - totalDepenses;

    // Calculer les données par mois
    const moisData = await calculateMonthlyData(filteredPayments, filteredExpenses, periode as string);

    // Créer les détails des transactions
    const detailsData = createTransactionDetails(filteredPayments, filteredExpenses);

    // Trouver le mois avec le plus grand bénéfice
    const moisMaxBenefice = moisData.reduce((max, item) => (item.solde > max.solde ? item : max), { mois: "", solde: 0 });

    // Calculer les totaux pour le résumé
    const totalPaiementsMois = moisData.reduce((sum, item) => sum + item.paiements, 0);
    const totalDepensesMois = moisData.reduce((sum, item) => sum + item.depenses, 0);
    const soldeTotalMois = moisData.reduce((sum, item) => sum + item.solde, 0);

    res.json({
      statistics: {
        totalPaiements,
        totalDepenses,
        soldeFinal
      },
      moisData,
      detailsData,
      moisMaxBenefice,
      summary: {
        totalPaiements: totalPaiementsMois,
        totalDepenses: totalDepensesMois,
        soldeTotal: soldeTotalMois
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du solde:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du solde' });
  }
});

// Fonction pour calculer les données par mois
async function calculateMonthlyData(payments: any[], expenses: any[], periode: string) {
  const moisData: any[] = [];
  
  // Déterminer le nombre de mois à analyser
  const monthsToAnalyze = periode === 'trimestre' ? 3 : periode === 'annee' ? 12 : 6;
  
  // Générer les mois à analyser (les X derniers mois)
  const currentDate = new Date();
  for (let i = monthsToAnalyze - 1; i >= 0; i--) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    const mois = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const moisCapitalized = mois.charAt(0).toUpperCase() + mois.slice(1);
    
    // Filtrer les paiements pour ce mois
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
    
    const paiementsMois = payments.filter(p => {
      const paymentDate = new Date(p.paymentDate);
      return paymentDate >= monthStart && paymentDate <= monthEnd;
    });
    
    const depensesMois = expenses.filter(e => {
      const expenseDate = new Date(e.date);
      return expenseDate >= monthStart && expenseDate <= monthEnd;
    });
    
    const totalPaiementsMois = paiementsMois.reduce((sum, p) => sum + p.amount, 0);
    const totalDepensesMois = depensesMois.reduce((sum, e) => sum + e.amount, 0);
    const soldeMois = totalPaiementsMois - totalDepensesMois;
    
    moisData.push({
      mois: moisCapitalized,
      paiements: totalPaiementsMois,
      depenses: totalDepensesMois,
      solde: soldeMois
    });
  }
  
  return moisData;
}

// Fonction pour créer les détails des transactions
function createTransactionDetails(payments: any[], expenses: any[]) {
  const details: any[] = [];
  
  // Ajouter les paiements
  payments.forEach(payment => {
    details.push({
      id: `payment_${payment.id}`,
      date: payment.paymentDate,
      type: 'paiement',
      description: `Paiement - ${payment.reservation.firstName} ${payment.reservation.lastName}`,
      montant: payment.amount,
      programme: payment.reservation.program.name,
      reservationId: payment.reservationId
    });
  });
  
  // Ajouter les dépenses
  expenses.forEach(expense => {
    details.push({
      id: `expense_${expense.id}`,
      date: expense.date,
      type: 'depense',
      description: expense.description,
      montant: -expense.amount, // Négatif pour les dépenses
      programme: expense.program?.name || 'Programme non spécifié',
      programId: expense.programId
    });
  });
  
  // Trier par date (plus récent en premier)
  return details.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export default router;
