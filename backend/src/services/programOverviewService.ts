import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ProgramOverview {
  id: number;
  name: string;
  created_at: string;
  flightDeadline: string | null;
  hotelDeadline: string | null;
  visaDeadline: string | null;
  passportDeadline: string | null;
  exchange: number;
  nbJoursMadina: number;
  nbJoursMakkah: number;
  prixAvionDH: number;
  prixVisaRiyal: number;
  profit: number;
  
  // Hôtels
  hotelsMadina: Array<{
    id: number;
    name: string;
    city: string;
  }>;
  hotelsMakkah: Array<{
    id: number;
    name: string;
    city: string;
  }>;
  
  // Réservations par chambre
  reservationsByRoom: {
    couple: number;
    three: number;
    four: number;
    five: number;
    total: number;
  };
  
  // Statistiques financières
  totalExpenses: number;
  totalRevenue: number;
  netProfit: number;
  
  // Répartition des dépenses
  expensesBreakdown: {
    hotel: number;
    flight: number;
    visa: number;
    other: number;
  };
  
  // Statistiques des réservations
  totalReservations: number;
  completedReservations: number;
  pendingReservations: number;
}

export class ProgramOverviewService {
  static async getProgramOverview(programId: number): Promise<ProgramOverview | null> {
    try {
      // 1. Récupérer les informations de base du programme
      const program = await prisma.program.findUnique({
        where: { id: programId },
        include: {
          hotelsMadina: {
            include: {
              hotel: true
            }
          },
          hotelsMakkah: {
            include: {
              hotel: true
            }
          }
        }
      });

      if (!program) {
        return null;
      }

      // 2. Récupérer les statistiques des chambres
      const roomsStats = await prisma.room.findMany({
        where: { programId: programId },
        select: {
          roomType: true,
          nbrPlaceTotal: true,
          nbrPlaceRestantes: true,
          listeIdsReservation: true
        }
      });

      // 3. Calculer les réservations par type de chambre
      const reservationsByRoom = this.calculateReservationsByRoom(roomsStats);

      // 4. Récupérer les revenus (payments)
      const revenueData = await prisma.payment.aggregate({
        where: { programId: programId },
        _sum: { amount: true },
        _count: { id: true }
      });

      // 5. Récupérer les dépenses par type
      const expensesData = await prisma.expense.findMany({
        where: { programId: programId },
        select: {
          amount: true,
          type: true
        }
      });

      // 6. Récupérer les statistiques des réservations
      const reservationsStats = await prisma.reservation.aggregate({
        where: { programId: programId },
        _count: { id: true }
      });

      const completedReservations = await prisma.reservation.count({
        where: { 
          programId: programId,
          status: 'Complet'
        }
      });

      // 7. Calculer les agrégations
      const totalRevenue = revenueData._sum.amount || 0;
      const totalExpenses = expensesData.reduce((sum, exp) => sum + exp.amount, 0);
      const netProfit = totalRevenue - totalExpenses;

      // 8. Calculer la répartition des dépenses
      const expensesBreakdown = this.calculateExpensesBreakdown(expensesData);

      // 9. Construire la réponse
      const overview: ProgramOverview = {
        id: program.id,
        name: program.name,
        created_at: program.created_at.toISOString(),
        flightDeadline: program.flightDeadline?.toISOString() || null,
        hotelDeadline: program.hotelDeadline?.toISOString() || null,
        visaDeadline: program.visaDeadline?.toISOString() || null,
        passportDeadline: program.passportDeadline?.toISOString() || null,
        exchange: program.exchange,
        nbJoursMadina: program.nbJoursMadina,
        nbJoursMakkah: program.nbJoursMakkah,
        prixAvionDH: program.prixAvionDH,
        prixVisaRiyal: program.prixVisaRiyal,
        profit: program.profit,
        
        hotelsMadina: program.hotelsMadina.map(ph => ({
          id: ph.hotel.id,
          name: ph.hotel.name,
          city: ph.hotel.city
        })),
        hotelsMakkah: program.hotelsMakkah.map(ph => ({
          id: ph.hotel.id,
          name: ph.hotel.name,
          city: ph.hotel.city
        })),
        
        reservationsByRoom,
        
        totalExpenses,
        totalRevenue,
        netProfit,
        
        expensesBreakdown,
        
        totalReservations: reservationsStats._count.id,
        completedReservations,
        pendingReservations: reservationsStats._count.id - completedReservations
      };

      return overview;
    } catch (error) {
      console.error('Error in getProgramOverview:', error);
      throw error;
    }
  }

  private static calculateReservationsByRoom(rooms: any[]) {
    const stats = {
      couple: 0,
      three: 0,
      four: 0,
      five: 0,
      total: 0
    };

    rooms.forEach(room => {
      const occupiedPlaces = room.nbrPlaceTotal - room.nbrPlaceRestantes;
      const reservationsCount = room.listeIdsReservation.length;
      
      switch (room.roomType) {
        case 'SINGLE':
          stats.couple += reservationsCount;
          break;
        case 'DOUBLE':
          stats.couple += reservationsCount;
          break;
        case 'TRIPLE':
          stats.three += reservationsCount;
          break;
        case 'QUAD':
          stats.four += reservationsCount;
          break;
        case 'QUINT':
          stats.five += reservationsCount;
          break;
      }
    });

    stats.total = stats.couple + stats.three + stats.four + stats.five;
    return stats;
  }

  private static calculateExpensesBreakdown(expenses: any[]) {
    const breakdown = {
      hotel: 0,
      flight: 0,
      visa: 0,
      other: 0
    };

    expenses.forEach(expense => {
      const type = expense.type.toLowerCase();
      if (type.includes('hotel') || type.includes('hôtel')) {
        breakdown.hotel += expense.amount;
      } else if (type.includes('vol') || type.includes('flight') || type.includes('avion')) {
        breakdown.flight += expense.amount;
      } else if (type.includes('visa')) {
        breakdown.visa += expense.amount;
      } else {
        breakdown.other += expense.amount;
      }
    });

    return breakdown;
  }

  // Méthode pour récupérer tous les programmes avec leurs statistiques
  static async getAllProgramsOverview(): Promise<ProgramOverview[]> {
    try {
      const programs = await prisma.program.findMany({
        orderBy: { created_at: 'desc' }
      });

      const overviews = await Promise.all(
        programs.map(program => this.getProgramOverview(program.id))
      );

      return overviews.filter(overview => overview !== null) as ProgramOverview[];
    } catch (error) {
      console.error('Error in getAllProgramsOverview:', error);
      throw error;
    }
  }
}
