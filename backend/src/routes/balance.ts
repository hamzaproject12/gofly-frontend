import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// 🎯 API Balance - Source de vérité officielle
// GET /api/balance?program=Omra Mars&dateDebut=2025-01-01&dateFin=2025-09-30&periode=mois
router.get('/', async (req, res) => {
  try {
    const { 
      dateDebut, 
      dateFin, 
      programme, 
      periode = 'mois' 
    } = req.query;

    console.log('🔍 Balance API appelée avec:', { dateDebut, dateFin, programme, periode });

    // 🔧 Construire les filtres optimisés
    const dateFilter = buildDateFilter(dateDebut as string, dateFin as string);
    const programFilter = programme && programme !== 'tous' ? { name: programme as string } : undefined;

    // 📊 1. Statistiques globales (avec Prisma aggregate - OPTIMISÉ)
    const [paymentsStats, expensesStats] = await Promise.all([
      // Paiements avec filtres
      prisma.payment.aggregate({
        where: {
          ...(Object.keys(dateFilter).length > 0 && { paymentDate: dateFilter }),
          ...(programFilter && { 
            reservation: { 
              program: programFilter 
            } 
          })
        },
        _sum: { amount: true },
        _count: { id: true }
      }),
      
      // Dépenses avec filtres
      prisma.expense.aggregate({
        where: {
          ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
          ...(programFilter && { 
            program: programFilter 
          })
        },
        _sum: { amount: true },
        _count: { id: true }
      })
    ]);

    const totalPaiements = paymentsStats._sum.amount || 0;
    const totalDepenses = expensesStats._sum.amount || 0;
    const soldeFinal = totalPaiements - totalDepenses;

    // 📈 2. Données par mois (avec Prisma groupBy - OPTIMISÉ)
    const moisData = await calculateMonthlyDataOptimized(dateFilter, programFilter, periode as string);

    // 🏆 3. Statistiques par méthode de paiement (NOUVEAU)
    const paiementsParMethode = await prisma.payment.groupBy({
      by: ['paymentMethod'],
      where: {
        ...(Object.keys(dateFilter).length > 0 && { paymentDate: dateFilter }),
        ...(programFilter && { 
          reservation: { 
            program: programFilter 
          } 
        })
      },
      _sum: { amount: true },
      _count: { id: true }
    });

    // 💰 4. Statistiques par type de dépense (NOUVEAU)
    const depensesParType = await prisma.expense.groupBy({
      by: ['type'],
      where: {
        ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
        ...(programFilter && { 
          program: programFilter 
        })
      },
      _sum: { amount: true },
      _count: { id: true }
    });

    // 👥 5. Statistiques par agent (si disponible) (NOUVEAU)
    const paiementsParAgent = await prisma.payment.groupBy({
      by: ['reservationId'],
      where: {
        ...(Object.keys(dateFilter).length > 0 && { paymentDate: dateFilter }),
        ...(programFilter && { 
          reservation: { 
            program: programFilter 
          } 
        })
      },
      _sum: { amount: true },
      _count: { id: true }
    });

    // Récupérer les noms des agents
    const agentIds = paiementsParAgent.map(p => p.reservationId);
    const reservations = await prisma.reservation.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, firstName: true, lastName: true }
    });

    const paiementsParAgentAvecNoms = paiementsParAgent.map(p => {
      const reservation = reservations.find(r => r.id === p.reservationId);
      return {
        agentId: p.reservationId,
        agentName: reservation ? `${reservation.firstName} ${reservation.lastName}` : 'Agent inconnu',
        total: p._sum.amount || 0,
        count: p._count.id || 0
      };
    });

    // 📋 6. Détails des transactions (limitée pour performance)
    const [recentPayments, recentExpenses] = await Promise.all([
      prisma.payment.findMany({
        where: {
          ...(Object.keys(dateFilter).length > 0 && { paymentDate: dateFilter }),
          ...(programFilter && { 
            reservation: { 
              program: programFilter 
            } 
          })
        },
        include: {
          reservation: {
            select: {
              firstName: true,
              lastName: true,
              program: { select: { name: true } }
            }
          }
        },
        orderBy: { paymentDate: 'desc' },
        take: 50 // Limite pour performance
      }),
      
      prisma.expense.findMany({
        where: {
          ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
          ...(programFilter && { 
            program: programFilter 
          })
        },
        include: {
          program: { select: { name: true } }
        },
        orderBy: { date: 'desc' },
        take: 50 // Limite pour performance
      })
    ]);

    // 🎯 7. Trouver le mois le plus rentable
    const moisMaxBenefice = moisData.length > 0 
      ? moisData.reduce((max, item) => (item.solde > max.solde ? item : max))
      : { mois: "Aucun", solde: 0 };

    // 📊 8. Calculer les totaux pour le résumé
    const totalPaiementsMois = moisData.reduce((sum, item) => sum + item.paiements, 0);
    const totalDepensesMois = moisData.reduce((sum, item) => sum + item.depenses, 0);
    const soldeTotalMois = moisData.reduce((sum, item) => sum + item.solde, 0);

    // 🎯 Structure JSON standardisée
    const response = {
      // 📊 Statistiques principales
      statistics: {
        totalPaiements,
        totalDepenses,
        soldeFinal,
        countPaiements: paymentsStats._count.id || 0,
        countDepenses: expensesStats._count.id || 0
      },

      // 📈 Données par mois
      parMois: moisData,

      // 🏆 Statistiques détaillées
      parMethodePaiement: paiementsParMethode.map(p => ({
        methode: p.paymentMethod,
        total: p._sum.amount || 0,
        count: p._count.id || 0
      })),

      parTypeDepense: depensesParType.map(d => ({
        type: d.type,
        total: d._sum.amount || 0,
        count: d._count.id || 0
      })),

      parAgent: paiementsParAgentAvecNoms.sort((a, b) => b.total - a.total),

      // 📋 Détails des transactions
      details: createTransactionDetails(recentPayments, recentExpenses),

      // 🏆 Résumé et métriques
      summary: {
        moisMaxBenefice,
        totalPaiements: totalPaiementsMois,
        totalDepenses: totalDepensesMois,
        soldeTotal: soldeTotalMois
      },

      // 🔧 Métadonnées
      metadata: {
        periode,
        dateDebut: dateDebut || null,
        dateFin: dateFin || null,
        programme: programme || 'tous',
        generatedAt: new Date().toISOString()
      }
    };

    console.log('✅ Balance API - Données générées:', {
      totalPaiements,
      totalDepenses,
      soldeFinal,
      moisCount: moisData.length,
      transactionsCount: response.details.length
    });

    res.json(response);

  } catch (error) {
    console.error('❌ Erreur Balance API:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération du solde',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 🔧 Fonction utilitaire pour construire les filtres de date
function buildDateFilter(dateDebut?: string, dateFin?: string) {
  const filter: any = {};
  
  if (dateDebut && dateFin) {
    filter.gte = new Date(dateDebut);
    filter.lte = new Date(dateFin);
  } else if (dateDebut) {
    filter.gte = new Date(dateDebut);
  } else if (dateFin) {
    filter.lte = new Date(dateFin);
  }
  
  return filter;
}

// 📈 Calcul des données mensuelles optimisé avec Prisma
async function calculateMonthlyDataOptimized(dateFilter: any, programFilter: any, periode: string) {
  const moisData: any[] = [];
  
  // Déterminer le nombre de mois à analyser
  const monthsToAnalyze = periode === 'trimestre' ? 3 : periode === 'annee' ? 12 : 6;
  
  // Générer les mois à analyser (les X derniers mois)
  const currentDate = new Date();
  for (let i = monthsToAnalyze - 1; i >= 0; i--) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    const mois = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const moisCapitalized = mois.charAt(0).toUpperCase() + mois.slice(1);
    
    // Filtres pour ce mois
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
    
    const monthDateFilter = {
      gte: monthStart,
      lte: monthEnd
    };

    // 🚀 Requêtes Prisma optimisées pour ce mois
    const [paiementsStats, depensesStats] = await Promise.all([
      prisma.payment.aggregate({
        where: {
          paymentDate: monthDateFilter,
          ...(programFilter && { 
            reservation: { 
              program: programFilter 
            } 
          })
        },
        _sum: { amount: true }
      }),
      
      prisma.expense.aggregate({
        where: {
          date: monthDateFilter,
          ...(programFilter && { 
            program: programFilter 
          })
        },
        _sum: { amount: true }
      })
    ]);
    
    const totalPaiementsMois = paiementsStats._sum.amount || 0;
    const totalDepensesMois = depensesStats._sum.amount || 0;
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

// 📋 Créer les détails des transactions
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
      reservationId: payment.reservationId,
      methodePaiement: payment.paymentMethod
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
      programId: expense.programId,
      typeDepense: expense.type
    });
  });
  
  // Trier par date (plus récent en premier)
  return details.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export default router;