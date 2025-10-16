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
    const [paymentsStats, expensesStats, gainPrevuStats] = await Promise.all([
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
      }),
      
      // Gain prévu (somme des prix des réservations)
      prisma.reservation.aggregate({
        where: {
          ...(Object.keys(dateFilter).length > 0 && { reservationDate: dateFilter }),
          ...(programFilter && { 
            program: programFilter 
          })
        },
        _sum: { price: true },
        _count: { id: true }
      })
    ]);

    const totalPaiements = paymentsStats._sum.amount || 0;
    const totalDepenses = expensesStats._sum.amount || 0;
    const gainPrevu = gainPrevuStats._sum.price || 0;
    const soldeFinal = totalPaiements - totalDepenses;
    const soldeFinalPrevu = gainPrevu - totalDepenses;

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
        gainPrevu,
        soldeFinal,
        soldeFinalPrevu,
        countPaiements: paymentsStats._count.id || 0,
        countDepenses: expensesStats._count.id || 0,
        countReservations: gainPrevuStats._count.id || 0
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
      gainPrevu,
      soldeFinal,
      soldeFinalPrevu,
      moisCount: moisData.length
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


// 📊 API pour graphique des types de chambres
router.get('/charts/rooms', async (req, res) => {
  try {
    const { programme } = req.query;
    
    console.log('🏠 API Rooms Chart appelée avec:', { programme });

    // Filtre par programme
    const programFilter = programme && programme !== 'tous' ? { name: programme as string } : undefined;

    // Récupérer les données des chambres par type
    const roomStats = await prisma.room.groupBy({
      by: ['roomType'],
      where: {
        ...(programFilter && { program: programFilter })
      },
      _count: {
        id: true
      }
    });

    // Récupérer les réservations pour calculer les chambres occupées
    const reservations = await prisma.reservation.findMany({
      where: {
        ...(programFilter && { 
          program: programFilter 
        })
      },
      select: {
        roomType: true
      }
    });

    // Calculer les statistiques par type de chambre
    const roomTypeStats = roomStats.map(room => {
      const type = room.roomType;
      const totalRooms = room._count.id;
      
      // Compter les réservations pour ce type
      const reservationsCount = reservations.filter(r => r.roomType === type).length;
      const roomsRestantes = Math.max(0, totalRooms - reservationsCount);
      
      return {
        roomType: type,
        nbRoomsReserver: reservationsCount,
        nbRoomsRestant: roomsRestantes,
        totalRooms: totalRooms
      };
    });

    // Ajouter les types de chambres qui n'ont pas de rooms mais ont des réservations
    const allRoomTypes: ('SINGLE' | 'DOUBLE' | 'TRIPLE' | 'QUAD' | 'QUINT')[] = ['SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD', 'QUINT'];
    const existingTypes = roomTypeStats.map(r => r.roomType);
    const missingTypes = allRoomTypes.filter(type => !existingTypes.includes(type));
    
    missingTypes.forEach(type => {
      const reservationsCount = reservations.filter(r => r.roomType === type).length;
      if (reservationsCount > 0) {
        roomTypeStats.push({
          roomType: type,
          nbRoomsReserver: reservationsCount,
          nbRoomsRestant: 0,
          totalRooms: reservationsCount
        });
      }
    });

    console.log('✅ Rooms Chart - Données générées:', roomTypeStats);

    res.json({
      data: roomTypeStats.sort((a, b) => {
        const order = ['SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD', 'QUINT'];
        return order.indexOf(a.roomType) - order.indexOf(b.roomType);
      }),
      metadata: {
        programme: programme || 'tous',
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Erreur Rooms Chart API:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des données des chambres',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 🏨 API pour graphique des hôtels
router.get('/charts/hotels', async (req, res) => {
  try {
    const { programme } = req.query;
    
    console.log('🏨 API Hotels Chart appelée avec:', { programme });

    // Filtre par programme
    const programFilter = programme && programme !== 'tous' ? { name: programme as string } : undefined;

    // Récupérer les réservations avec les hôtels
    const reservations = await prisma.reservation.findMany({
      where: {
        ...(programFilter && { 
          program: programFilter 
        })
      },
      select: {
        hotelMadina: true,
        hotelMakkah: true
      }
    });

    // Compter les personnes par hôtel
    const hotelStats: { [key: string]: number } = {};
    
    reservations.forEach(reservation => {
      // Hôtel à Madina
      if (reservation.hotelMadina && reservation.hotelMadina !== 'Sans hôtel') {
        hotelStats[reservation.hotelMadina] = (hotelStats[reservation.hotelMadina] || 0) + 1;
      }
      
      // Hôtel à Makkah
      if (reservation.hotelMakkah && reservation.hotelMakkah !== 'Sans hôtel') {
        hotelStats[reservation.hotelMakkah] = (hotelStats[reservation.hotelMakkah] || 0) + 1;
      }
    });

    // Transformer en array pour le graphique
    const hotelData = Object.entries(hotelStats).map(([hotelName, nbPersonnes]) => ({
      hotelName,
      nbPersonnes
    })).sort((a, b) => b.nbPersonnes - a.nbPersonnes);

    console.log('✅ Hotels Chart - Données générées:', hotelData);

    res.json({
      data: hotelData,
      metadata: {
        programme: programme || 'tous',
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Erreur Hotels Chart API:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des données des hôtels',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 👥 API pour graphique des genres
router.get('/charts/gender', async (req, res) => {
  try {
    const { programme } = req.query;
    
    console.log('👥 API Gender Chart appelée avec:', { programme });

    // Filtre par programme
    const programFilter = programme && programme !== 'tous' ? { name: programme as string } : undefined;

    // Récupérer les réservations groupées par genre
    const genderStats = await prisma.reservation.groupBy({
      by: ['gender'],
      where: {
        ...(programFilter && { 
          program: programFilter 
        })
      },
      _count: {
        id: true
      }
    });

    // Transformer en array pour le graphique
    const genderData = genderStats.map(stat => ({
      gender: stat.gender,
      nbReservations: stat._count.id
    })).sort((a, b) => b.nbReservations - a.nbReservations);

    console.log('✅ Gender Chart - Données générées:', genderData);

    res.json({
      data: genderData,
      metadata: {
        programme: programme || 'tous',
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Erreur Gender Chart API:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des données des genres',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 💰 API pour graphique du solde
router.get('/charts/solde', async (req, res) => {
  try {
    const { programme } = req.query;
    
    console.log('💰 API Solde Chart appelée avec:', { programme });

    // Filtre par programme
    const programFilter = programme && programme !== 'tous' ? { name: programme as string } : undefined;

    // Récupérer les données en parallèle
    const [gainPrevu, paiementsReels, depenses] = await Promise.all([
      // Gain prévu (somme des prix des réservations)
      prisma.reservation.aggregate({
        where: {
          ...(programFilter && { 
            program: programFilter 
          })
        },
        _sum: {
          price: true
        }
      }),
      
      // Paiements réels (somme des paidAmount)
      prisma.reservation.aggregate({
        where: {
          ...(programFilter && { 
            program: programFilter 
          })
        },
        _sum: {
          paidAmount: true
        }
      }),
      
      // Dépenses du programme
      prisma.expense.aggregate({
        where: {
          ...(programFilter && { 
            program: programFilter 
          })
        },
        _sum: {
          amount: true
        }
      })
    ]);

    const soldeData = [
      {
        type: 'Gain prévu',
        montant: gainPrevu._sum.price || 0
      },
      {
        type: 'Paiements',
        montant: paiementsReels._sum.paidAmount || 0
      },
      {
        type: 'Dépenses',
        montant: depenses._sum.amount || 0
      }
    ];

    console.log('✅ Solde Chart - Données générées:', soldeData);

    res.json({
      data: soldeData,
      metadata: {
        programme: programme || 'tous',
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Erreur Solde Chart API:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des données du solde',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;