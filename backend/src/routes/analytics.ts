import { Router } from 'express'
import { PrismaClient } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()

// 📊 API Analytics pour tableau de bord décisionnel
// GET /api/analytics/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const { periode = 'mois', dateDebut, dateFin, programme } = req.query

    // 🔍 Construction des filtres de date
    const dateFilter: any = {}
    if (dateDebut && dateFin) {
      dateFilter.createdAt = {
        gte: new Date(dateDebut as string),
        lte: new Date(dateFin as string)
      }
    }

    // 🏢 Filtre par programme
    const programFilter: any = {}
    if (programme && programme !== 'tous') {
      programFilter.programId = parseInt(programme as string)
    }

    // 📈 1. CLASSEMENT PAR PROGRAMME (qui rapporte le plus)
    const programRanking = await prisma.payment.aggregate({
      where: {
        ...dateFilter,
        reservation: programFilter
      },
      _sum: { amount: true },
      _count: { id: true }
    })

    const programDetails = await prisma.payment.groupBy({
      by: ['reservationId'],
      where: {
        ...dateFilter,
        reservation: programFilter
      },
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 10
    })

    const programRankingDetailed = await Promise.all(
      programDetails.map(async (item) => {
        const reservation = await prisma.reservation.findUnique({
          where: { id: item.reservationId },
          include: { program: true }
        })
        return {
          programId: reservation?.programId,
          programName: reservation?.program?.name || 'Programme inconnu',
          totalAmount: item._sum.amount || 0,
          countPayments: item._count.id,
          avgAmount: item._count.id > 0 ? (item._sum.amount || 0) / item._count.id : 0
        }
      })
    )

    // 👥 2. CLASSEMENT PAR AGENT (qui encaisse le plus)
    const agentRanking = await prisma.payment.groupBy({
      by: ['agentId'],
      where: {
        ...dateFilter,
        reservation: programFilter,
        agentId: { not: null }
      },
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: 'desc' } }
    })

    const agentRankingDetailed = await Promise.all(
      agentRanking.map(async (item) => {
        const agent = await prisma.agent.findUnique({
          where: { id: item.agentId! }
        })
        return {
          agentId: item.agentId,
          agentName: agent?.nom || 'Agent inconnu',
          agentEmail: agent?.email || '',
          totalAmount: item._sum?.amount || 0,
          countPayments: item._count?.id || 0,
          avgAmount: (item._count?.id || 0) > 0 ? (item._sum?.amount || 0) / (item._count?.id || 1) : 0
        }
      })
    )

    // 📅 3. MOUVEMENTS PAR PÉRIODE (tendances)
    const getTrendData = async (period: string) => {
      let groupByFormat = '%Y-%m' // Par défaut par mois
      
      if (period === 'jour') groupByFormat = '%Y-%m-%d'
      else if (period === 'semaine') groupByFormat = '%Y-%u'
      else if (period === 'trimestre') groupByFormat = '%Y-%q'
      else if (period === 'annee') groupByFormat = '%Y'

      // Paiements par période
      const paymentsTrend = await prisma.$queryRaw`
        SELECT 
          TO_CHAR("paymentDate", ${groupByFormat}) as period,
          SUM(amount) as "totalPayments",
          COUNT(*) as "countPayments"
        FROM "Payment" 
        WHERE "paymentDate" >= COALESCE(${dateDebut || '2024-01-01'}::timestamp, '2024-01-01'::timestamp)
          AND "paymentDate" <= COALESCE(${dateFin || '2025-12-31'}::timestamp, '2025-12-31'::timestamp)
        GROUP BY period
        ORDER BY period DESC
        LIMIT 12
      `

      // Dépenses par période
      const expensesTrend = await prisma.$queryRaw`
        SELECT 
          TO_CHAR(date, ${groupByFormat}) as period,
          SUM(amount) as "totalExpenses",
          COUNT(*) as "countExpenses"
        FROM "Expense" 
        WHERE date >= COALESCE(${dateDebut || '2024-01-01'}::timestamp, '2024-01-01'::timestamp)
          AND date <= COALESCE(${dateFin || '2025-12-31'}::timestamp, '2025-12-31'::timestamp)
        GROUP BY period
        ORDER BY period DESC
        LIMIT 12
      `

      return { paymentsTrend, expensesTrend }
    }

    const trendData = await getTrendData(periode as string)

    // 💰 4. ÉVOLUTION CAISSE (cashflow)
    const cashflowData = await prisma.$queryRaw`
      SELECT 
        TO_CHAR(transaction_date, 'YYYY-MM') as month,
        SUM(CASE WHEN transaction_type = 'payment' THEN amount ELSE 0 END) as payments,
        SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END) as expenses,
        SUM(CASE WHEN transaction_type = 'payment' THEN amount ELSE -amount END) as "netCashflow"
      FROM (
        SELECT "paymentDate" as transaction_date, amount, 'payment' as transaction_type FROM "Payment"
        UNION ALL
        SELECT date as transaction_date, amount, 'expense' as transaction_type FROM "Expense"
      ) as transactions
      WHERE transaction_date >= COALESCE(${dateDebut || '2024-01-01'}::timestamp, '2024-01-01'::timestamp)
        AND transaction_date <= COALESCE(${dateFin || '2025-12-31'}::timestamp, '2025-12-31'::timestamp)
      GROUP BY month
      ORDER BY month DESC
      LIMIT 12
    `

    // 📊 5. MÉTRIQUES DE PERFORMANCE
    const performanceMetrics = {
      // Tendance générale (comparaison mois précédent)
      trend: await calculateTrend(dateFilter, programFilter),
      
      // Meilleur jour/mois
      bestPeriod: await findBestPeriod(dateFilter, programFilter),
      
      // Ratio dépenses/paiements
      expenseRatio: await calculateExpenseRatio(dateFilter, programFilter),
      
      // Diversité des programmes
      programDiversity: await calculateProgramDiversity(dateFilter, programFilter)
    }

    // 🔧 Conversion des BigInt en Number pour la sérialisation JSON
    const convertBigIntToNumber = (obj: any): any => {
      if (obj === null || obj === undefined) return obj;
      if (typeof obj === 'bigint') return Number(obj);
      if (Array.isArray(obj)) return obj.map(convertBigIntToNumber);
      if (typeof obj === 'object') {
        const converted: any = {};
        for (const [key, value] of Object.entries(obj)) {
          converted[key] = convertBigIntToNumber(value);
        }
        return converted;
      }
      return obj;
    };

    res.json({
      success: true,
      data: convertBigIntToNumber({
        // 🏆 Classements
        programRanking: {
          summary: {
            totalPrograms: programRankingDetailed.length,
            totalRevenue: programRanking._sum?.amount || 0,
            totalPayments: programRanking._count?.id || 0
          },
          details: programRankingDetailed
        },
        
        agentRanking: {
          summary: {
            totalAgents: agentRankingDetailed.length,
            totalCollected: agentRanking.reduce((sum, agent) => sum + (agent._sum?.amount || 0), 0),
            totalTransactions: agentRanking.reduce((sum, agent) => sum + (agent._count?.id || 0), 0)
          },
          details: agentRankingDetailed
        },
        
        // 📈 Tendances
        trends: {
          period: periode,
          data: trendData,
          insights: generateTrendInsights(trendData)
        },
        
        // 💰 Cashflow
        cashflow: {
          data: cashflowData,
          summary: calculateCashflowSummary(cashflowData as any[])
        },
        
        // 📊 Performance
        performance: performanceMetrics,
        
        // 🔧 Métadonnées
        metadata: {
          generatedAt: new Date().toISOString(),
          period: periode,
          dateDebut,
          dateFin,
          programme,
          filters: { dateFilter, programFilter }
        }
      })
    })

  } catch (error) {
    console.error('❌ Analytics error:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors du calcul des analytics',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// 🔧 Fonctions utilitaires
async function calculateTrend(dateFilter: any, programFilter: any) {
  const now = new Date()
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const lastMonthData = await prisma.payment.aggregate({
    where: {
      paymentDate: {
        gte: lastMonth,
        lt: thisMonth
      },
      reservation: programFilter
    },
    _sum: { amount: true }
  })

  const thisMonthData = await prisma.payment.aggregate({
    where: {
      paymentDate: {
        gte: thisMonth
      },
      reservation: programFilter
    },
    _sum: { amount: true }
  })

  const lastMonthTotal = lastMonthData._sum?.amount || 0
  const thisMonthTotal = thisMonthData._sum?.amount || 0
  
  const change = lastMonthTotal > 0 ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 : 0

  return {
    direction: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
    percentage: Math.abs(change),
    lastMonth: lastMonthTotal,
    thisMonth: thisMonthTotal,
    change: thisMonthTotal - lastMonthTotal
  }
}

async function findBestPeriod(dateFilter: any, programFilter: any) {
  const bestDay = await prisma.$queryRaw`
    SELECT 
      DATE("paymentDate") as date,
      SUM(amount) as total
    FROM "Payment"
    WHERE "paymentDate" >= COALESCE(${dateFilter.paymentDate?.gte || '2024-01-01'}::timestamp, '2024-01-01'::timestamp)
      AND "paymentDate" <= COALESCE(${dateFilter.paymentDate?.lte || '2025-12-31'}::timestamp, '2025-12-31'::timestamp)
    GROUP BY DATE("paymentDate")
    ORDER BY total DESC
    LIMIT 1
  ` as Array<{ date: string; total: number }>

  return bestDay[0] || null
}

async function calculateExpenseRatio(dateFilter: any, programFilter: any) {
  const totalPayments = await prisma.payment.aggregate({
    where: { ...dateFilter, reservation: programFilter },
    _sum: { amount: true }
  })

  const totalExpenses = await prisma.expense.aggregate({
    where: dateFilter,
    _sum: { amount: true }
  })

  const paymentsTotal = totalPayments._sum?.amount || 0
  const expensesTotal = Math.abs(totalExpenses._sum?.amount || 0)

  return {
    ratio: paymentsTotal > 0 ? (expensesTotal / paymentsTotal) * 100 : 0,
    payments: paymentsTotal,
    expenses: expensesTotal,
    net: paymentsTotal - expensesTotal
  }
}

async function calculateProgramDiversity(dateFilter: any, programFilter: any) {
  const programCount = await prisma.payment.groupBy({
    by: ['reservationId'],
    where: { ...dateFilter, reservation: programFilter },
    _count: { id: true }
  })

  const totalPrograms = await prisma.program.count()

  return {
    activePrograms: programCount.length,
    totalPrograms,
    diversity: totalPrograms > 0 ? (programCount.length / totalPrograms) * 100 : 0
  }
}

function generateTrendInsights(trendData: any) {
  // Logique pour générer des insights basés sur les données de tendance
  return {
    message: "Analyse des tendances en cours...",
    recommendation: "Continuer la stratégie actuelle",
    risk: "low"
  }
}

function calculateCashflowSummary(cashflowData: any[]) {
  if (!cashflowData || cashflowData.length === 0) {
    return {
      totalPayments: 0,
      totalExpenses: 0,
      totalCashflow: 0,
      avgMonthly: 0,
      trend: 'stable' as const,
      volatility: 0
    }
  }

  const totals = cashflowData.reduce((acc: any, month: any) => ({
    payments: acc.payments + (parseFloat(month.payments) || 0),
    expenses: acc.expenses + (parseFloat(month.expenses) || 0),
    cashflow: acc.cashflow + (parseFloat(month.netCashflow) || 0)
  }), { payments: 0, expenses: 0, cashflow: 0 })

  const avgMonthly = totals.cashflow / cashflowData.length

  return {
    totalPayments: totals.payments,
    totalExpenses: totals.expenses,
    totalCashflow: totals.cashflow,
    avgMonthly,
    trend: avgMonthly > 0 ? 'positive' : avgMonthly < 0 ? 'negative' : 'stable',
    volatility: calculateVolatility(cashflowData.map((m: any) => parseFloat(m.netCashflow) || 0))
  }
}

function calculateVolatility(values: number[]) {
  if (values.length < 2) return 0
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
  
  return Math.sqrt(variance)
}

export default router
