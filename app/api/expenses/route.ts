import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const program = searchParams.get('program') || '';
    const type = searchParams.get('type') || '';
    const status = searchParams.get('status') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    // Construire les filtres
    const where: any = {};

    // Filtre par recherche
    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { program: { name: { contains: search, mode: 'insensitive' } } },
        { type: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Filtre par programme
    if (program && program !== 'tous') {
      where.program = { name: program };
    }

    // Filtre par type
    if (type && type !== 'tous') {
      where.type = type;
    }

    // Filtre par statut (si on ajoute un champ status plus tard)
    if (status && status !== 'tous') {
      // Pour l'instant, on peut filtrer par montant ou autre critère
      // where.status = status;
    }

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
        skip: (page - 1) * limit,
        take: limit
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
      Hôtel: 0,
      Autre: 0
    };

    statsByType.forEach(stat => {
      if (stat.type === 'Vol') totalByType.Vol = stat._sum.amount || 0;
      else if (stat.type === 'Hôtel') totalByType.Hôtel = stat._sum.amount || 0;
      else totalByType.Autre += stat._sum.amount || 0;
    });

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      expenses: transformedExpenses,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      stats: {
        total: stats._sum.amount || 0,
        count: stats._count.id || 0,
        byType: totalByType
      }
    });

  } catch (error) {
    console.error('Error fetching expenses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch expenses' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { description, amount, type, programId, reservationId, date } = body;

    const expense = await prisma.expense.create({
      data: {
        description,
        amount: parseFloat(amount),
        type,
        programId: programId || null,
        reservationId: reservationId || null,
        date: date ? new Date(date) : new Date()
      },
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
      }
    });

    return NextResponse.json({
      expense: {
        id: expense.id,
        date: expense.date.toISOString().split('T')[0],
        programme: expense.program?.name || 'Autre',
        type: expense.type,
        description: expense.description,
        montant: expense.amount,
        statut: 'payé'
      }
    });

  } catch (error) {
    console.error('Error creating expense:', error);
    return NextResponse.json(
      { error: 'Failed to create expense' },
      { status: 500 }
    );
  }
}
