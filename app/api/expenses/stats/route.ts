import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const program = searchParams.get('program') || '';
    const type = searchParams.get('type') || '';

    // Construire les filtres
    const where: any = {};

    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { program: { name: { contains: search, mode: 'insensitive' } } },
        { type: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (program && program !== 'tous') {
      where.program = { name: program };
    }

    if (type && type !== 'tous') {
      where.type = type;
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

    // Statistiques par programme
    const statsByProgram = await prisma.expense.groupBy({
      by: ['programId'],
      where: {
        ...where,
        programId: { not: null }
      },
      _sum: {
        amount: true
      },
      _count: {
        id: true
      }
    });

    // Récupérer les noms des programmes
    const programIds = statsByProgram.map(stat => stat.programId).filter(Boolean);
    const programs = await prisma.program.findMany({
      where: {
        id: { in: programIds }
      },
      select: {
        id: true,
        name: true
      }
    });

    const programStats = statsByProgram.map(stat => {
      const program = programs.find(p => p.id === stat.programId);
      return {
        program: program?.name || 'Autre',
        total: stat._sum.amount || 0,
        count: stat._count.id || 0
      };
    });

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

    return NextResponse.json({
      total: {
        amount: totalStats._sum.amount || 0,
        count: totalStats._count.id || 0
      },
      byType: totalByType,
      byProgram: programStats
    });

  } catch (error) {
    console.error('Error fetching expense stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch expense statistics' },
      { status: 500 }
    );
  }
}
